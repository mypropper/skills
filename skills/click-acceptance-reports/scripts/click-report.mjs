#!/usr/bin/env node
// Read-only Click acceptance reporting against the Propper public API.
// Node 20+, no dependencies. Credentials come from PROPPER_CLIENT_ID and
// PROPPER_CLIENT_SECRET; neither they nor the access token are ever printed or written.
//
//   node click-report.mjs templates
//   node click-report.mjs collect [--template <name|id>]... [--since 7d|<ISO>] [--until <ISO>]
//        [--verify sample|all|none] [--sample 25] [--target-version 2.0.0]
//        [--confirm-signers] [--out <dir>] [--title <text>] [--redact]
//   node click-report.mjs render --data <dir>/dataset.json [--out <dir>] [--title <text>] [--redact]
//
// Every request is a GET, except the signer-status check, which is a read that may take
// its signer reference in a POST body. Nothing is accepted, published, moved or changed.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const TOKEN_URL = 'https://auth.propper.ai/oauth2/token';
const API_URL = 'https://api.propper.ai';
const SCOPE = 'click:read';
const PAGE_SIZE = 100;
const CONCURRENCY = 4;
const MAX_SIGNER_CHECKS = 50;

// ---------------------------------------------------------------------------
// HTTP

class ApiError extends Error {
  constructor(message, { status, code, requestId, serverMessage } = {}) {
    super(message);
    Object.assign(this, { status, code, requestId, serverMessage });
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stats = { calls: 0, retries: 0 };
let token = null;

async function getToken() {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const clientId = process.env.PROPPER_CLIENT_ID;
  const clientSecret = process.env.PROPPER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new ApiError('Set PROPPER_CLIENT_ID and PROPPER_CLIENT_SECRET to an OAuth client granted click:read.');
  }
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret, scope: SCOPE }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    const reason = [body.error, body.error_description].filter(Boolean).join(': ');
    throw new ApiError(`Token request failed with ${res.status}${reason ? ` (${reason})` : ''}. Check the client id, secret and that the client is granted ${SCOPE}.`, { status: res.status });
  }
  token = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return token.value;
}

function retryDelayMs(res, attempt) {
  const after = Number(res.headers.get('retry-after'));
  if (after > 0) return Math.min(after * 1000, 60_000);
  const reset = Number(res.headers.get('x-ratelimit-reset'));
  if (reset > 0) return Math.min(Math.max(reset * 1000 - Date.now(), 1000), 60_000);
  return Math.min(1000 * 2 ** attempt, 30_000);
}

async function api(path, { method = 'GET', body } = {}) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(API_URL + path, {
      method,
      headers: {
        authorization: `Bearer ${await getToken()}`,
        accept: 'application/json',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    stats.calls++;
    if ((res.status === 429 || res.status === 502 || res.status === 503) && attempt < 6) {
      stats.retries++;
      await sleep(retryDelayMs(res, attempt));
      continue;
    }
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
    const requestId = res.headers.get('x-request-id') ?? json?.requestId ?? null;
    if (!res.ok) {
      throw new ApiError(`${method} ${path.split('?')[0]} returned ${res.status}${json?.errorCode ? ` ${json.errorCode}` : ''}${requestId ? ` (x-request-id ${requestId})` : ''}`, {
        status: res.status, code: json?.errorCode, requestId, serverMessage: json?.message ?? '',
      });
    }
    const remaining = Number(res.headers.get('x-ratelimit-remaining'));
    if (res.headers.has('x-ratelimit-remaining') && remaining <= 3) await sleep(retryDelayMs(res, 1));
    return json;
  }
}

export async function getAll(path, key, params = {}) {
  const rows = [];
  for (let page = 1; ; page++) {
    const q = new URLSearchParams({ ...params, page: String(page), limit: String(PAGE_SIZE) });
    const body = await api(`${path}?${q}`);
    const items = body?.[key] ?? [];
    rows.push(...items);
    if (!body?.pagination?.hasMore || items.length === 0) return rows;
  }
}

async function mapPool(items, fn, size = CONCURRENCY) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return out;
}

// ---------------------------------------------------------------------------
// Pure data shaping (exported for tests)

export const majorOf = (version) => {
  const m = /^(\d+)\./.exec(version ?? '');
  return m ? Number(m[1]) : null;
};

// `until` is exclusive, so a bare date there means the end of that day.
export function parseWhen(value, now = Date.now(), { isUntil = false } = {}) {
  if (!value) return null;
  if (isUntil && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return new Date(Date.parse(`${value.trim()}T00:00:00Z`) + 86_400_000).toISOString();
  }
  const rel = /^(\d+)\s*([dhw])$/i.exec(value.trim());
  if (rel) {
    const unit = { h: 3_600_000, d: 86_400_000, w: 604_800_000 }[rel[2].toLowerCase()];
    return new Date(now - Number(rel[1]) * unit).toISOString();
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new ApiError(`Not a date or a relative window like 7d: ${value}`);
  return d.toISOString();
}

export function pickTemplates(templates, selectors) {
  if (!selectors?.length) return templates;
  const picked = new Map();
  for (const sel of selectors) {
    const s = sel.trim().toLowerCase();
    const exact = templates.filter((t) => t.id === sel.trim() || t.name.trim().toLowerCase() === s);
    const partial = templates.filter((t) => t.name.toLowerCase().includes(s));
    const matches = exact.length ? exact : partial;
    if (matches.length !== 1 && !exact.length) {
      throw new ApiError(matches.length
        ? `"${sel}" matches ${matches.length} templates: ${matches.map((t) => t.name).join('; ')}. Pass the exact name or the id.`
        : `No template matches "${sel}". Run the templates command to list them.`);
    }
    for (const t of matches) picked.set(t.id, t);
  }
  return [...picked.values()];
}

// One acceptance row, with its version and signer read from the row first and the
// receipt's evidence record second. `receipt` is the `data` object of GET /receipts/{id}.
export function normalizeAcceptance(row, { versionsById, deploymentsById, receipt }) {
  const ev = receipt?.evidence ?? null;
  const meta = ev?.metadata ?? {};
  let versionId = row.templateVersionId ?? row.versionId ?? null;
  let version = row.versionNumber ?? row.version ?? (versionId ? versionsById.get(versionId)?.version : null) ?? null;
  let versionSource = version ? 'row' : null;
  if (!version && ev) {
    versionId = ev.versionId ?? versionId;
    version = meta.versionNumber ?? (versionId ? versionsById.get(versionId)?.version : null) ?? null;
    if (version) versionSource = 'receipt';
  }
  const rowSigner = row.userRef ?? row.userId ?? null;
  const evSigner = ev?.userRef ?? meta.userRef ?? null;
  const signer = rowSigner || evSigner || null;
  const deploymentId = row.deploymentId ?? meta.deploymentId ?? null;
  return {
    id: row.id,
    receiptId: row.receiptId ?? row.id,
    templateId: row.templateId ?? ev?.templateId ?? null,
    deploymentId,
    environment: deploymentsById.get(deploymentId)?.environment ?? row.environment ?? meta.environment ?? null,
    timestamp: row.timestamp,
    versionId,
    version,
    major: majorOf(version),
    versionSource,
    signer,
    signerSource: rowSigner ? 'row' : evSigner ? 'receipt' : null,
    consentMethod: row.consentMethod ?? null,
    locale: row.locale ?? null,
    evidenceStatus: receipt?.evidenceStatus ?? null,
  };
}

export function needsReceipt(row) {
  return !(row.userRef || row.userId) || !(row.templateVersionId || row.versionId || row.versionNumber || row.version);
}

// Signers who accepted another major of the template but never the one a deployment
// serves (or `targetVersion`, when given). An acceptance of the target major through any
// deployment of the same template in the same environment counts as current.
export function reacceptance({ rows, templates, deployments, versionsByTemplate, targetVersion }) {
  const out = [];
  for (const d of deployments) {
    const versions = versionsByTemplate[d.templateId] ?? [];
    const served = versions.find((v) => v.id === d.versionId) ?? null;
    const targetMajor = majorOf(targetVersion) ?? served?.major ?? null;
    if (targetMajor == null) continue;
    const majors = [...new Set(versions.map((v) => v.major))].sort((a, b) => a - b);
    if (majors.length < 2) continue;
    const scoped = rows.filter((r) => r.templateId === d.templateId && r.environment === d.environment);
    const withSigner = scoped.filter((r) => r.signer && r.major != null);
    const current = new Set(withSigner.filter((r) => r.major === targetMajor).map((r) => r.signer));
    const pending = new Map();
    for (const r of withSigner) {
      if (r.deploymentId !== d.id || r.major === targetMajor || current.has(r.signer)) continue;
      const prev = pending.get(r.signer);
      if (!prev || r.timestamp > prev.lastAcceptedAt) pending.set(r.signer, { signer: r.signer, lastVersion: r.version, lastAcceptedAt: r.timestamp, receiptId: r.receiptId });
    }
    const viaThis = scoped.filter((r) => r.deploymentId === d.id);
    const latest = [...versions].sort((a, b) => b.major - a.major || (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))[0];
    out.push({
      deploymentId: d.id,
      templateId: d.templateId,
      templateName: templates.find((t) => t.id === d.templateId)?.name ?? d.templateId,
      environment: d.environment,
      domain: d.domain ?? null,
      path: d.path ?? null,
      active: d.active ?? null,
      servedVersion: served?.version ?? null,
      latestPublished: latest?.version ?? null,
      targetVersion: targetVersion ?? served?.version ?? null,
      targetMajor,
      acceptedTarget: [...current].length,
      acceptancesViaThis: viaThis.length,
      targetAcceptancesViaThis: viaThis.filter((r) => r.major === targetMajor).length,
      signedAcceptancesViaThis: viaThis.filter((r) => r.signer).length,
      pending: [...pending.values()].sort((a, b) => a.lastAcceptedAt.localeCompare(b.lastAcceptedAt)),
      unsignedAcceptances: viaThis.filter((r) => !r.signer).length,
      unknownVersionAcceptances: viaThis.filter((r) => r.signer && r.major == null).length,
    });
  }
  return out;
}

export function pickForVerify(rows, mode, size) {
  if (mode === 'none') return [];
  const ordered = [...rows].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  if (mode === 'all' || ordered.length <= size) return ordered;
  const step = ordered.length / size;
  return Array.from({ length: size }, (_, i) => ordered[Math.floor(i * step)]);
}

export function granularity(rows) {
  if (rows.length < 2) return 'day';
  const ts = rows.map((r) => Date.parse(r.timestamp));
  const span = Math.max(...ts) - Math.min(...ts);
  if (span <= 3 * 3_600_000) return '5 minutes';
  if (span <= 2 * 86_400_000) return 'hour';
  if (span <= 92 * 86_400_000) return 'day';
  return 'week';
}

export function bucketOf(iso, unit) {
  const d = new Date(iso);
  if (unit === '5 minutes') return `${iso.slice(0, 14)}${String(Math.floor(d.getUTCMinutes() / 5) * 5).padStart(2, '0')}Z`;
  if (unit === 'hour') return `${iso.slice(0, 13)}:00Z`;
  if (unit === 'day') return iso.slice(0, 10);
  const day = (d.getUTCDay() + 6) % 7; // Monday-based weeks
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)).toISOString().slice(0, 10);
}

const count = (items, key) => items.reduce((acc, x) => {
  const k = key(x) ?? 'unrecorded';
  acc[k] = (acc[k] ?? 0) + 1;
  return acc;
}, {});
const minMax = (rows) => {
  const ts = rows.map((r) => r.timestamp).sort();
  return { first: ts[0] ?? null, last: ts.at(-1) ?? null };
};

export function summarize(ds) {
  const { templates, versionsByTemplate, window } = ds;
  const inWindow = ds.acceptances.filter((r) => (!window.since || r.timestamp >= window.since) && (!window.until || r.timestamp < window.until));
  const name = (id) => templates.find((t) => t.id === id)?.name ?? id;

  const byTemplate = templates.map((t) => {
    const rows = inWindow.filter((r) => r.templateId === t.id);
    const published = versionsByTemplate[t.id] ?? [];
    const keys = [...new Set([...published.map((v) => v.version), ...rows.map((r) => r.version ?? 'unknown')])];
    const versions = keys.map((version) => {
      const vr = rows.filter((r) => (r.version ?? 'unknown') === version);
      const meta = published.find((v) => v.version === version);
      return {
        version,
        label: meta?.label ?? null,
        publishedAt: meta?.publishedAt ?? null,
        acceptances: vr.length,
        signers: new Set(vr.map((r) => r.signer).filter(Boolean)).size,
        ...minMax(vr),
        consentMethods: count(vr, (r) => r.consentMethod),
      };
    }).sort((a, b) => (majorOf(b.version) ?? -1) - (majorOf(a.version) ?? -1) || b.version.localeCompare(a.version));
    return { templateId: t.id, name: t.name, acceptances: rows.length, signers: new Set(rows.map((r) => r.signer).filter(Boolean)).size, ...minMax(rows), versions };
  });

  const unit = granularity(inWindow);
  const series = [...new Set(inWindow.map((r) => `${name(r.templateId)} ${r.version ?? 'unknown'}`))].sort();
  const buckets = {};
  for (const r of inWindow) {
    const b = bucketOf(r.timestamp, unit);
    buckets[b] ??= {};
    const s = `${name(r.templateId)} ${r.version ?? 'unknown'}`;
    buckets[b][s] = (buckets[b][s] ?? 0) + 1;
  }
  // Fill empty buckets between the first and last so the axis is continuous in time.
  const step = { '5 minutes': 300_000, hour: 3_600_000, day: 86_400_000, week: 604_800_000 }[unit];
  const keys = Object.keys(buckets).sort();
  if (keys.length > 1) {
    const toMs = (k) => Date.parse(k.length === 10 ? `${k}T00:00:00Z` : k.replace(/Z$/, ':00Z'));
    const span = (toMs(keys.at(-1)) - toMs(keys[0])) / step;
    for (let i = 1; span <= 240 && i < span; i++) buckets[bucketOf(new Date(toMs(keys[0]) + i * step).toISOString(), unit)] ??= {};
  }
  const trend = { unit, series, buckets: Object.keys(buckets).sort().map((bucket) => ({ bucket, counts: buckets[bucket], total: Object.values(buckets[bucket]).reduce((a, b) => a + b, 0) })) };

  const checks = {};
  for (const v of ds.verifications) {
    for (const [k, status] of Object.entries({ ...v.checks, ...v.environmentChecks })) {
      checks[k] ??= {};
      checks[k][status] = (checks[k][status] ?? 0) + 1;
    }
  }
  const verified = ds.verifications.filter((v) => !v.error);
  const integrity = {
    mode: ds.verify.mode,
    eligible: inWindow.length,
    checked: ds.verifications.length,
    valid: verified.filter((v) => v.valid).length,
    invalid: verified.filter((v) => !v.valid).length,
    errored: ds.verifications.filter((v) => v.error).length,
    testEvidence: verified.filter((v) => v.isTestEvidence).length,
    checks,
    failures: ds.verifications.filter((v) => v.error || !v.valid),
  };

  return {
    totals: {
      acceptances: inWindow.length,
      signers: new Set(inWindow.map((r) => r.signer).filter(Boolean)).size,
      templates: byTemplate.filter((t) => t.acceptances).length,
      ...minMax(inWindow),
    },
    byTemplate,
    reacceptance: ds.reacceptance,
    integrity,
    trend,
    limits: dataLimits(ds, inWindow, integrity),
  };
}

const fmtDate = (iso) => (iso ? iso.replace('T', ' ').replace(/:\d\d(\.\d+)?Z$/, ' UTC') : 'n/a');

export function dataLimits(ds, rows, integrity) {
  const out = [];
  const unsigned = rows.filter((r) => !r.signer);
  if (unsigned.length) {
    const firstSigned = rows.filter((r) => r.signer).map((r) => r.timestamp).sort()[0];
    const lastUnsigned = unsigned.map((r) => r.timestamp).sort().at(-1);
    out.push(firstSigned && lastUnsigned < firstSigned
      ? `Signer not recorded for acceptances before ${fmtDate(firstSigned)} (${unsigned.length} of ${rows.length}). They count toward totals but cannot be matched to a person.`
      : `Signer not recorded for ${unsigned.length} of ${rows.length} acceptances. They count toward totals but cannot be matched to a person.`);
  }
  const fromReceipt = rows.filter((r) => r.versionSource === 'receipt').length;
  if (fromReceipt) out.push(`Version read from the signed receipt for ${fromReceipt} of ${rows.length} acceptances.`);
  const signerFromReceipt = rows.filter((r) => r.signerSource === 'receipt').length;
  if (signerFromReceipt) out.push(`Signer read from the signed receipt for ${signerFromReceipt} of ${rows.length} acceptances.`);
  const noVersion = rows.filter((r) => !r.version).length;
  if (noVersion) out.push(`Version unknown for ${noVersion} acceptances; they are listed as "unknown".`);
  const methods = [...new Set(rows.map((r) => r.consentMethod ?? 'unrecorded'))];
  if (rows.length && methods.length === 1) out.push(`Every acceptance reports the consent method "${methods[0]}", so the method breakdown has a single value.`);
  const pendingEvidence = rows.filter((r) => r.evidenceStatus && r.evidenceStatus !== 'complete').length;
  if (pendingEvidence) out.push(`${pendingEvidence} acceptances have evidence that is not complete yet; only complete evidence verifies.`);
  if (integrity.mode === 'none') out.push('Evidence was not verified in this run.');
  else if (integrity.checked < integrity.eligible) out.push(`Evidence verified for an evenly spaced sample of ${integrity.checked} of ${integrity.eligible} acceptances, not every one.`);
  if (ds.window.since || ds.window.until) out.push(`Totals, trend and verification cover ${ds.window.since ? fmtDate(ds.window.since) : 'the first acceptance'} to ${ds.window.until ? fmtDate(ds.window.until) : 'now'}. Re-acceptance uses every acceptance on record.`);
  const unnamed = (ds.reacceptance ?? []).reduce((a, d) => a + (d.unsignedAcceptances ?? 0), 0);
  if (unnamed) out.push(`Re-acceptance: ${unnamed} acceptances through deployments with an earlier major carry no signer, so anyone behind them who still owes re-acceptance cannot be named.`);
  if (ds.signerStatus.requested && ds.signerStatus.mode === 'unavailable') out.push('The signer-status check is not available on this API, so re-acceptance is computed from acceptances only.');
  out.push('An acceptance time is when it completed, or when it started if it never completed.');
  return out;
}

// ---------------------------------------------------------------------------
// Collection

async function loadCatalog() {
  const templates = await getAll('/v1/click/templates', 'templates');
  const deployments = await getAll('/v1/click/deployments', 'deployments');
  return { templates, deployments };
}

const versionSummary = (v) => ({ id: v.id, version: v.version, major: v.major ?? majorOf(v.version), level: v.level ?? null, label: v.label ?? null, publishedAt: v.publishedAt ?? null, effectiveAt: v.effectiveAt ?? null });

async function cmdTemplates() {
  const { templates, deployments } = await loadCatalog();
  const out = await mapPool(templates, async (t) => {
    const versions = (await getAll(`/v1/click/templates/${t.id}/versions`, 'versions')).map(versionSummary);
    return {
      id: t.id,
      name: t.name,
      status: t.status,
      versions: versions.map((v) => `${v.version}${v.label ? ` (${v.label})` : ''}`),
      deployments: deployments.filter((d) => d.templateId === t.id).map((d) => ({
        id: d.id, environment: d.environment, active: d.active, serves: versions.find((v) => v.id === d.versionId)?.version ?? null,
      })),
    };
  });
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
}

let signerStatusMode = null; // POST | GET | unavailable

export async function signerStatus(deploymentId, userRef) {
  const path = `/v1/click/deployments/${deploymentId}/signer-status`;
  const shape = (r) => ({ status: r.status, accepted: r.accepted?.version ?? null, served: r.served?.version ?? null, reason: r.reason ?? null });
  const neverAccepted = { status: 'stale', accepted: null, served: null, reason: 'never_accepted' };
  if (signerStatusMode !== 'GET') {
    try {
      const r = await api(path, { method: 'POST', body: { userRef } });
      signerStatusMode = 'POST';
      return shape(r);
    } catch (e) {
      if (e.code === 'CLICK_SIGNER_NOT_FOUND') return neverAccepted;
      if (!(e.status === 405 || (e.status === 404 && /cannot post/i.test(e.serverMessage)))) throw e;
      signerStatusMode = 'GET';
    }
  }
  try {
    return shape(await api(`${path}?${new URLSearchParams({ userRef })}`));
  } catch (e) {
    if (e.code === 'CLICK_SIGNER_NOT_FOUND') return neverAccepted;
    if (e.status === 405 || (e.status === 404 && /cannot get/i.test(e.serverMessage))) {
      signerStatusMode = 'unavailable';
      return null;
    }
    throw e;
  }
}

// The longest changed passages of a locale's wording diff; single-word edits are counted, not quoted.
const passages = (hunks, side) => (hunks ?? []).map((h) => (h[side] ?? '').trim())
  .filter((t) => t.split(/\s+/).length >= 4)
  .sort((a, b) => b.length - a.length)
  .slice(0, 3);

async function diffSummary(templateId, versions, targetMajor) {
  const ordered = [...versions].sort((a, b) => (a.publishedAt ?? '').localeCompare(b.publishedAt ?? ''));
  const to = ordered.filter((v) => v.major === targetMajor).at(0);
  const from = ordered.filter((v) => v.major < targetMajor).at(-1);
  if (!to || !from) return null;
  try {
    const { diff } = await api(`/v1/click/templates/${templateId}/versions/${from.id}/diff/${to.id}`);
    return {
      from: from.version,
      to: to.version,
      label: to.label,
      locales: (diff?.locales ?? []).map((l) => ({
        locale: l.locale,
        status: l.status,
        wordsAdded: l.body?.wordsAdded ?? 0,
        wordsRemoved: l.body?.wordsRemoved ?? 0,
        added: passages(l.body?.hunks, 'added'),
        removed: passages(l.body?.hunks, 'removed'),
      })),
      otherChanges: ['consentMechanics', 'appearance', 'settings', 'scope'].filter((k) => (diff?.[k] ?? []).length),
    };
  } catch (e) {
    return { from: from.version, to: to.version, label: to.label, error: e.message };
  }
}

async function cmdCollect(opts) {
  const log = (m) => process.stderr.write(`${m}\n`);
  const window = { since: parseWhen(opts.since), until: parseWhen(opts.until, Date.now(), { isUntil: true }) };
  const verifyMode = ['sample', 'all', 'none'].includes(opts.verify) ? opts.verify : 'sample';
  const sampleSize = Math.max(1, Number(opts.sample) || 25);

  const catalog = await loadCatalog();
  const templates = pickTemplates(catalog.templates, opts.template);
  const templateIds = new Set(templates.map((t) => t.id));
  const deployments = catalog.deployments.filter((d) => templateIds.has(d.templateId));
  const deploymentsById = new Map(catalog.deployments.map((d) => [d.id, d]));
  log(`Templates: ${templates.map((t) => t.name).join('; ')}`);

  const versionsByTemplate = {};
  await mapPool(templates, async (t) => {
    versionsByTemplate[t.id] = (await getAll(`/v1/click/templates/${t.id}/versions`, 'versions')).map(versionSummary);
  });
  const versionsById = new Map(Object.values(versionsByTemplate).flat().map((v) => [v.id, v]));
  const revisions = {};
  await mapPool(deployments, async (d) => {
    revisions[d.id] = (await getAll(`/v1/click/deployments/${d.id}/revisions`, 'revisions')).map((r) => ({
      number: r.number, kind: r.kind, version: r.version?.number ?? null, reason: r.reason ?? null, createdAt: r.createdAt,
    }));
  });

  // Every acceptance of the chosen templates: re-acceptance needs full history.
  const raw = [];
  for (const t of templates) raw.push(...await getAll('/v1/click/acceptances', 'acceptances', { templateId: t.id }));
  log(`Acceptances on record: ${raw.length}`);

  const multiMajor = new Set(templates.filter((t) => new Set((versionsByTemplate[t.id] ?? []).map((v) => v.major)).size > 1).map((t) => t.id));
  const inWindow = (r) => (!window.since || r.timestamp >= window.since) && (!window.until || r.timestamp < window.until);
  const wantReceipt = raw.filter((r) => needsReceipt(r) && (inWindow(r) || multiMajor.has(r.templateId)));
  log(`Reading ${wantReceipt.length} receipts for version and signer`);
  const receipts = new Map();
  await mapPool(wantReceipt, async (r) => {
    try {
      receipts.set(r.id, (await api(`/v1/click/receipts/${encodeURIComponent(r.receiptId ?? r.id)}`))?.data ?? null);
    } catch (e) {
      if (e.status !== 404) throw e;
    }
  });
  const acceptances = raw.map((r) => normalizeAcceptance(r, { versionsById, deploymentsById, receipt: receipts.get(r.id) }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const toVerify = pickForVerify(acceptances.filter((r) => inWindow(r)), verifyMode, sampleSize);
  log(`Verifying evidence for ${toVerify.length} acceptances (${verifyMode})`);
  const verifications = await mapPool(toVerify, async (r) => {
    const base = { acceptanceId: r.id, receiptId: r.receiptId, templateId: r.templateId, version: r.version, signer: r.signer, timestamp: r.timestamp };
    try {
      const v = await api(`/v1/click/evidence/verify/receipt/${encodeURIComponent(r.receiptId)}`);
      const statusOf = (o) => Object.fromEntries(Object.entries(o ?? {}).map(([k, c]) => [k, c.status]));
      const failed = Object.entries({ ...v.checks, ...v.environmentChecks }).filter(([, c]) => c.status === 'fail').map(([k, c]) => `${k}: ${c.message}`);
      return {
        ...base,
        valid: v.valid,
        evidenceStatus: v.evidenceStatus ?? null,
        checks: statusOf(v.checks),
        environmentChecks: statusOf(v.environmentChecks),
        errors: [...(v.errors ?? []), ...failed.filter((f) => !(v.errors ?? []).includes(f))],
        warnings: v.warnings ?? [],
        isTestEvidence: v.isTestEvidence ?? null,
        chainSequence: v.evidence?.chainSequence ?? null,
        verifiedAt: v.timestamp,
      };
    } catch (e) {
      return { ...base, error: e.message, checks: {}, environmentChecks: {} };
    }
  });

  const reaccept = reacceptance({ rows: acceptances, templates, deployments, versionsByTemplate, targetVersion: opts['target-version'] });
  for (const d of reaccept) {
    d.revisions = revisions[d.deploymentId] ?? [];
    d.change = await diffSummary(d.templateId, versionsByTemplate[d.templateId] ?? [], d.targetMajor);
  }
  const signerStatusInfo = { requested: Boolean(opts['confirm-signers']), mode: null, checked: 0, capped: false };
  if (opts['confirm-signers']) {
    for (const d of reaccept) {
      const batch = d.pending.slice(0, MAX_SIGNER_CHECKS);
      signerStatusInfo.capped ||= d.pending.length > batch.length;
      for (const p of batch) {
        if (signerStatusMode === 'unavailable') break;
        p.signerStatus = await signerStatus(d.deploymentId, p.signer);
        signerStatusInfo.checked++;
      }
    }
    signerStatusInfo.mode = signerStatusMode;
    log(`Signer-status checks: ${signerStatusInfo.checked} (${signerStatusMode ?? 'not needed'})`);
  }

  return {
    generatedAt: new Date().toISOString(),
    window,
    templates: templates.map((t) => ({ id: t.id, name: t.name, status: t.status })),
    deployments: deployments.map((d) => ({ id: d.id, templateId: d.templateId, environment: d.environment, active: d.active, servedVersion: versionsById.get(d.versionId)?.version ?? null })),
    versionsByTemplate,
    acceptances,
    verify: { mode: verifyMode, sampleSize },
    verifications,
    reacceptance: reaccept,
    signerStatus: signerStatusInfo,
    api: { calls: stats.calls, retries: stats.retries },
  };
}

// ---------------------------------------------------------------------------
// Rendering

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = (n) => Number(n ?? 0).toLocaleString('en-US');
const plural = (n, one, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;
const pct = (a, b) => (b ? `${Math.round((a / b) * 1000) / 10}%` : 'n/a');
const shortId = (id) => (id ? `${String(id).slice(0, 8)}` : '');

export function redact(ds) {
  const copy = structuredClone(ds);
  const names = new Map();
  const alias = (s) => {
    if (!s) return s;
    if (!names.has(s)) names.set(s, `signer-${String(names.size + 1).padStart(3, '0')}`);
    return names.get(s);
  };
  for (const r of copy.acceptances) r.signer = alias(r.signer);
  for (const v of copy.verifications) v.signer = alias(v.signer);
  for (const d of copy.reacceptance) for (const p of d.pending) p.signer = alias(p.signer);
  copy.redacted = true;
  return copy;
}

const PALETTE = ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#0891b2', '#db2777', '#65a30d'];

function trendSvg(trend) {
  const { buckets, series } = trend;
  if (!buckets.length) return '<p class="muted">No acceptances in this window.</p>';
  const W = 760; const H = 240; const L = 36; const B = 40; const T = 10;
  const max = Math.max(...buckets.map((b) => b.total));
  const bw = Math.min((W - L - 10) / buckets.length, 64);
  const x0 = L + ((W - L - 10) - bw * buckets.length) / 2;
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const ticks = [...new Set([0, Math.round(max / 2), max])];
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Acceptances per ${esc(trend.unit)}" class="chart">`;
  for (const t of ticks) svg += `<line x1="${L}" x2="${W - 10}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${L - 6}" y="${y(t) + 4}" class="tick" text-anchor="end">${t}</text>`;
  const labelEvery = Math.ceil(buckets.length / 12);
  buckets.forEach((b, i) => {
    let acc = 0;
    const x = x0 + i * bw + bw * 0.15;
    series.forEach((s, si) => {
      const v = b.counts[s] ?? 0;
      if (!v) return;
      svg += `<rect x="${x.toFixed(1)}" y="${y(acc + v).toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${(y(acc) - y(acc + v)).toFixed(1)}" fill="${PALETTE[si % PALETTE.length]}" rx="2"><title>${esc(b.bucket)} · ${esc(s)}: ${v}</title></rect>`;
      acc += v;
    });
    if (i % labelEvery === 0) {
      const label = trend.unit === '5 minutes' ? b.bucket.slice(11, 16) : trend.unit === 'hour' ? `${b.bucket.slice(5, 13).replace('T', ' ')}h` : b.bucket.slice(5);
      svg += `<text x="${(x + bw * 0.35).toFixed(1)}" y="${H - B + 16}" class="tick" text-anchor="middle">${esc(label)}</text>`;
    }
  });
  svg += '</svg>';
  const legend = series.map((s, si) => `<span class="key"><i style="background:${PALETTE[si % PALETTE.length]}"></i>${esc(s)}</span>`).join('');
  return `${svg}<div class="legend">${legend}</div>`;
}

const badge = (text, tone) => `<span class="badge ${tone}">${esc(text)}</span>`;
const methods = (m) => Object.entries(m).map(([k, v]) => `${esc(k)} ${num(v)}`).join(', ') || 'n/a';

export function renderHtml(ds, s, title) {
  const t = s.totals;
  const scope = ds.templates.map((x) => x.name).join(' · ');
  const windowText = ds.window.since || ds.window.until ? `${ds.window.since ? fmtDate(ds.window.since) : 'first acceptance'} to ${ds.window.until ? fmtDate(ds.window.until) : 'now'}` : 'All acceptances on record';
  const pendingTotal = s.reacceptance.reduce((a, d) => a + d.pending.length, 0);

  const versionRows = s.byTemplate.map((tp) => tp.versions.map((v, i) => `<tr>
    ${i === 0 ? `<th rowspan="${tp.versions.length}" scope="rowgroup">${esc(tp.name)}<div class="muted small">${num(tp.acceptances)} acceptances</div></th>` : ''}
    <td><b>${esc(v.version)}</b>${v.label ? `<div class="muted small">${esc(v.label)}</div>` : ''}</td>
    <td class="num">${num(v.acceptances)}</td><td class="num">${num(v.signers)}</td>
    <td class="dt">${esc(fmtDate(v.first))}</td><td class="dt">${esc(fmtDate(v.last))}</td><td>${methods(v.consentMethods)}</td></tr>`).join('')).join('');

  const reaccept = s.reacceptance.length ? s.reacceptance.map((d) => {
    const change = d.change && !d.change.error ? `<div class="change"><b>What changed, ${esc(d.change.from)} to ${esc(d.change.to)}</b>${d.change.label ? ` · ${esc(d.change.label)}` : ''}
      <ul>${d.change.locales.map((l) => `<li>${esc(l.locale)}: ${esc(l.status)}, ${num(l.wordsAdded)} words added, ${num(l.wordsRemoved)} removed${l.added.map((a) => `<blockquote>+ ${esc(a)}</blockquote>`).join('')}${l.removed.map((a) => `<blockquote class="rm">- ${esc(a)}</blockquote>`).join('')}</li>`).join('')}
      ${d.change.otherChanges.length ? `<li>Also changed: ${esc(d.change.otherChanges.join(', '))}</li>` : ''}</ul></div>` : '';
    const moved = d.revisions.find((r) => r.version === d.servedVersion && r.reason);
    const rows = d.pending.map((p) => `<tr><td>${esc(p.signer)}</td><td>${esc(p.lastVersion)}</td><td>${esc(fmtDate(p.lastAcceptedAt))}</td><td>${p.signerStatus === undefined ? '<span class="muted">not checked</span>' : p.signerStatus === null ? '<span class="muted">unavailable</span>' : badge(`${p.signerStatus.status}${p.signerStatus.reason ? ` · ${p.signerStatus.reason}` : ''}`, p.signerStatus.status === 'current' ? 'ok' : 'warn')}</td></tr>`).join('');
    return `<div class="card">
      <div class="card-head"><div><h3>${esc(d.templateName)}</h3><div class="muted small">Deployment ${esc(shortId(d.deploymentId))} · ${esc(d.environment ?? 'environment n/a')} · serves ${esc(d.servedVersion ?? 'n/a')}${d.targetVersion !== d.servedVersion ? ` · target ${esc(d.targetVersion)}` : ''}${moved ? ` · "${esc(moved.reason)}"` : ''}</div></div>
      <div class="pill-row">${badge(`${num(d.targetAcceptancesViaThis)} of ${plural(d.acceptancesViaThis, 'acceptance')} on ${d.targetMajor}.x`, 'muted')}${d.signedAcceptancesViaThis ? `${badge(`${plural(d.acceptedTarget, 'signer')} on ${d.targetMajor}.x`, 'ok')}${badge(`${num(d.pending.length)} still on an earlier major`, d.pending.length ? 'warn' : 'ok')}` : ''}${d.unsignedAcceptances ? badge(`${num(d.unsignedAcceptances)} with no signer`, 'muted') : ''}</div></div>
      ${change}
      ${majorOf(d.latestPublished) > d.targetMajor ? `<p class="muted">A newer major, ${esc(d.latestPublished)}, is published but this deployment still serves ${esc(d.servedVersion)}.</p>` : ''}
      ${d.pending.length ? `<table><thead><tr><th>Signer</th><th>Last accepted</th><th>When</th><th>Signer status</th></tr></thead><tbody>${rows}</tbody></table>`
        : d.signedAcceptancesViaThis ? '<p class="ok-text">Every identified signer through this deployment has accepted this major.</p>'
          : `<p class="warn-text">None of the ${num(d.acceptancesViaThis)} acceptances through this deployment carries a signer reference, so the signers still on an earlier major cannot be named.</p>`}
    </div>`;
  }).join('') : '<p class="muted">No chosen template has more than one published major, so there is nothing to re-accept.</p>';

  const ig = s.integrity;
  const checkNames = Object.keys(ig.checks);
  const statuses = ['pass', 'fail', 'not_verifiable', 'not_issued', 'not_applicable'];
  const checkRows = checkNames.map((k) => `<tr><td>${esc(k)}</td>${statuses.map((st) => `<td class="num ${st === 'fail' && ig.checks[k][st] ? 'bad-text' : ''}">${ig.checks[k][st] ? num(ig.checks[k][st]) : '<span class="muted">0</span>'}</td>`).join('')}</tr>`).join('');
  const failures = ig.failures.map((f) => `<tr><td>${esc(shortId(f.receiptId))}</td><td>${esc(f.signer ?? 'n/a')}</td><td>${esc(f.version ?? 'n/a')}</td><td>${esc(fmtDate(f.timestamp))}</td><td>${esc(f.error ?? (f.errors.join('; ') || `evidence ${f.evidenceStatus}`))}</td></tr>`).join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
:root{--bg:#f7f7f5;--card:#fff;--ink:#16181d;--muted:#5d6470;--line:#e4e4df;--accent:#2563eb;--ok:#0f7b4b;--okbg:#e5f5ec;--warn:#9a5b00;--warnbg:#fdf1dc;--bad:#b42318;--badbg:#fde8e7}
@media (prefers-color-scheme:dark){:root{--bg:#121417;--card:#1b1e23;--ink:#eceef1;--muted:#9aa3ae;--line:#2c3138;--accent:#7aa2ff;--ok:#5fd39b;--okbg:#14301f;--warn:#f5b955;--warnbg:#3a2a0e;--bad:#ff8a80;--badbg:#3d1714}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:1080px;margin:0 auto;padding:32px 16px 64px}
header h1{font-size:28px;margin:0 0 4px;letter-spacing:-.01em}.muted{color:var(--muted)}.small{font-size:12.5px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:24px 0}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}.kpi b{display:block;font-size:26px;font-variant-numeric:tabular-nums}
section{margin-top:36px}h2{font-size:19px;margin:0 0 4px}h2+p{margin-top:0}h3{font-size:16px;margin:0}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin:12px 0;overflow-x:auto}
.card-head{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:8px}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
thead th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:600}tbody th{font-weight:600}
td.dt{white-space:nowrap}td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
.badge{display:inline-block;border-radius:999px;padding:2px 10px;font-size:12.5px;font-weight:600;margin:2px 4px 2px 0;white-space:nowrap}
.badge.ok{background:var(--okbg);color:var(--ok)}.badge.warn{background:var(--warnbg);color:var(--warn)}.badge.bad{background:var(--badbg);color:var(--bad)}.badge.muted{background:var(--line);color:var(--muted)}
.ok-text{color:var(--ok)}.warn-text{color:var(--warn)}.bad-text{color:var(--bad);font-weight:600}
.change{border-left:3px solid var(--accent);padding:4px 12px;margin:8px 0 12px}.change ul{margin:6px 0 0;padding-left:18px}
blockquote{margin:6px 0;padding:6px 10px;background:var(--okbg);border-radius:6px;font-size:13.5px}blockquote.rm{background:var(--badbg)}
.chart{width:100%;height:auto}.chart .grid{stroke:var(--line)}.chart .tick{fill:var(--muted);font-size:11px}
.legend{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:8px;font-size:13px}.key i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px}
ul.limits li{margin:4px 0}footer{margin-top:40px;font-size:12.5px;color:var(--muted)}
@media print{body{background:#fff}.card,.kpi{break-inside:avoid}}
</style></head><body><main>
<header><div class="muted small">Click acceptance report${ds.redacted ? ' · signer references pseudonymized' : ''}</div>
<h1>${esc(title)}</h1><div class="muted">${esc(scope)}</div><div class="muted small">${esc(windowText)} · generated ${esc(fmtDate(ds.generatedAt))}</div></header>
<div class="kpis">
<div class="kpi"><span class="muted small">Acceptances</span><b>${num(t.acceptances)}</b><span class="muted small">${esc(fmtDate(t.first))} to ${esc(fmtDate(t.last))}</span></div>
<div class="kpi"><span class="muted small">Identified signers</span><b>${num(t.signers)}</b><span class="muted small">${num(t.acceptances - ds.acceptances.filter((r) => !r.signer && (!ds.window.since || r.timestamp >= ds.window.since) && (!ds.window.until || r.timestamp < ds.window.until)).length)} acceptances carry a signer</span></div>
<div class="kpi"><span class="muted small">Awaiting re-acceptance</span><b>${num(pendingTotal)}</b><span class="muted small">${s.reacceptance.some((d) => !d.signedAcceptancesViaThis && d.acceptancesViaThis) ? 'signers not recorded on some deployments; see section 2' : `across ${num(s.reacceptance.length)} deployment${s.reacceptance.length === 1 ? '' : 's'} with an earlier major`}</span></div>
<div class="kpi"><span class="muted small">Evidence verified</span><b>${ig.checked ? pct(ig.valid, ig.checked) : 'n/a'}</b><span class="muted small">${num(ig.valid)} of ${num(ig.checked)} valid${ig.mode === 'sample' && ig.checked < ig.eligible ? ' (sample)' : ''}</span></div>
</div>
<section><h2>1. Acceptances by template and version</h2><p class="muted">Counts, first and last acceptance, and how consent was given, per published version.</p>
<div class="card"><table><thead><tr><th>Template</th><th>Version</th><th class="num">Acceptances</th><th class="num">Signers</th><th>First</th><th>Last</th><th>Consent methods</th></tr></thead><tbody>${versionRows}</tbody></table></div></section>
<section><h2>2. Re-acceptance after a major version</h2><p class="muted">Signers who accepted an earlier major through a deployment but have not accepted the major it serves now, through any deployment of the template in the same environment.</p>${reaccept}</section>
<section><h2>3. Evidence integrity</h2><p class="muted">${ig.mode === 'none' ? 'Not run.' : `${num(ig.checked)} of ${num(ig.eligible)} acceptances re-verified: content hash, signature, chain link, stored screenshot and HTML, retention and signing key.`}</p>
${ig.checked ? `<div class="card"><div class="pill-row">${badge(`${num(ig.valid)} valid`, 'ok')}${ig.invalid ? badge(`${num(ig.invalid)} invalid`, 'bad') : ''}${ig.errored ? badge(`${num(ig.errored)} could not be read`, 'bad') : ''}${ig.testEvidence ? badge(`${num(ig.testEvidence)} test evidence`, 'muted') : ''}</div>
<table><thead><tr><th>Check</th>${statuses.map((st) => `<th class="num">${esc(st.replace('_', ' '))}</th>`).join('')}</tr></thead><tbody>${checkRows}</tbody></table>
<p class="muted small">"Not issued" means the platform does not issue that proof yet; it does not make a receipt invalid.</p></div>
${failures ? `<div class="card"><h3>Failures</h3><table><thead><tr><th>Receipt</th><th>Signer</th><th>Version</th><th>Accepted</th><th>Result</th></tr></thead><tbody>${failures}</tbody></table></div>` : '<p class="ok-text">No verified receipt failed a check.</p>'}` : ''}
</section>
<section><h2>4. Acceptances over time</h2><p class="muted">Per ${esc(s.trend.unit)}, stacked by template and version.</p><div class="card">${trendSvg(s.trend)}</div></section>
<section><h2>Data limits</h2><ul class="limits">${s.limits.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></section>
<footer>Read-only. Built from the Propper Click API with a click:read token: ${num(ds.api?.calls)} requests. Nothing was accepted, published or changed.</footer>
</main></body></html>
`;
}

export function renderMarkdown(ds, s, title) {
  const t = s.totals;
  const lines = [`# ${title}`, '', `${ds.templates.map((x) => x.name).join(' · ')}`, '',
    `Generated ${fmtDate(ds.generatedAt)}. ${ds.window.since || ds.window.until ? `Window: ${ds.window.since ? fmtDate(ds.window.since) : 'first acceptance'} to ${ds.window.until ? fmtDate(ds.window.until) : 'now'}.` : 'All acceptances on record.'}`, '',
    `- **${num(t.acceptances)}** acceptances from **${num(t.signers)}** identified signers, ${fmtDate(t.first)} to ${fmtDate(t.last)}`,
    s.reacceptance.length && s.reacceptance.every((d) => !d.signedAcceptancesViaThis)
      ? '- Re-acceptance: no acceptance carries a signer reference, so signers still on an earlier major cannot be named'
      : `- **${num(s.reacceptance.reduce((a, d) => a + d.pending.length, 0))}** signers still on an earlier major`,
    `- Evidence: **${num(s.integrity.valid)} of ${num(s.integrity.checked)}** verified receipts valid${s.integrity.mode === 'sample' && s.integrity.checked < s.integrity.eligible ? ' (sample)' : ''}`, '',
    '## Acceptances by template and version', '', '| Template | Version | Acceptances | Signers | First | Last | Consent methods |', '|---|---|---:|---:|---|---|---|'];
  for (const tp of s.byTemplate) for (const v of tp.versions) lines.push(`| ${tp.name} | ${v.version} | ${num(v.acceptances)} | ${num(v.signers)} | ${fmtDate(v.first)} | ${fmtDate(v.last)} | ${Object.entries(v.consentMethods).map(([k, n]) => `${k} ${n}`).join(', ') || 'n/a'} |`);
  lines.push('', '## Re-acceptance after a major version', '');
  if (!s.reacceptance.length) lines.push('No chosen template has more than one published major.');
  for (const d of s.reacceptance) {
    lines.push(`### ${d.templateName}, deployment ${shortId(d.deploymentId)} (${d.environment ?? 'n/a'}), serves ${d.servedVersion ?? 'n/a'}${d.targetVersion !== d.servedVersion ? `, measured against ${d.targetVersion}` : ''}`, '',
      `${num(d.targetAcceptancesViaThis)} of ${plural(d.acceptancesViaThis, 'acceptance')} through this deployment ${d.targetAcceptancesViaThis === 1 ? 'is' : 'are'} on ${d.targetMajor}.x. ${d.signedAcceptancesViaThis ? `${plural(d.acceptedTarget, 'signer')} accepted ${d.targetMajor}.x; ${num(d.pending.length)} accepted an earlier major through this deployment and not ${d.targetMajor}.x.` : 'None of them carries a signer reference, so the signers still on an earlier major cannot be named.'}${d.unsignedAcceptances && d.signedAcceptancesViaThis ? ` ${plural(d.unsignedAcceptances, 'acceptance')} here ${d.unsignedAcceptances === 1 ? 'carries' : 'carry'} no signer.` : ''}${majorOf(d.latestPublished) > d.targetMajor ? ` A newer major, ${d.latestPublished}, is published but not served here.` : ''}`, '');
    if (d.change && !d.change.error) lines.push(`What changed, ${d.change.from} to ${d.change.to}: ${d.change.locales.map((l) => `${l.locale} ${l.status}, +${l.wordsAdded}/-${l.wordsRemoved} words${l.added.length ? `; added "${l.added[0]}"` : ''}`).join('; ')}`, '');
    if (d.pending.length) {
      lines.push('| Signer | Last accepted | When | Signer status |', '|---|---|---|---|');
      for (const p of d.pending) lines.push(`| ${p.signer} | ${p.lastVersion} | ${fmtDate(p.lastAcceptedAt)} | ${p.signerStatus === undefined ? 'not checked' : p.signerStatus === null ? 'unavailable' : `${p.signerStatus.status}${p.signerStatus.reason ? ` (${p.signerStatus.reason})` : ''}`} |`);
      lines.push('');
    }
  }
  const ig = s.integrity;
  lines.push('## Evidence integrity', '', ig.mode === 'none' ? 'Not run.' : `${num(ig.checked)} of ${num(ig.eligible)} acceptances re-verified: ${num(ig.valid)} valid, ${num(ig.invalid)} invalid, ${num(ig.errored)} unreadable.`, '');
  if (ig.checked) {
    lines.push('| Check | pass | fail | not verifiable | not issued | not applicable |', '|---|---:|---:|---:|---:|---:|');
    for (const [k, c] of Object.entries(ig.checks)) lines.push(`| ${k} | ${c.pass ?? 0} | ${c.fail ?? 0} | ${c.not_verifiable ?? 0} | ${c.not_issued ?? 0} | ${c.not_applicable ?? 0} |`);
    lines.push('');
    for (const f of ig.failures) lines.push(`- Receipt ${shortId(f.receiptId)} (${f.signer ?? 'no signer'}, ${f.version ?? 'version n/a'}): ${f.error ?? (f.errors.join('; ') || `evidence ${f.evidenceStatus}`)}`);
    if (ig.failures.length) lines.push('');
  }
  lines.push(`## Acceptances over time (per ${s.trend.unit})`, '', '| Bucket | Total | Breakdown |', '|---|---:|---|');
  for (const b of s.trend.buckets) lines.push(`| ${b.bucket} | ${b.total} | ${Object.entries(b.counts).map(([k, n]) => `${k}: ${n}`).join('; ')} |`);
  lines.push('', '## Data limits', '', ...s.limits.map((l) => `- ${l}`), '');
  return lines.join('\n');
}

function writeReport(ds, outDir, title, doRedact) {
  const data = doRedact ? redact(ds) : ds;
  const s = summarize(data);
  const heading = title || `Click acceptances: ${data.templates.length === 1 ? data.templates[0].name : `${data.templates.length} templates`}`;
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'report.html'), renderHtml(data, s, heading));
  writeFileSync(join(outDir, 'report.md'), renderMarkdown(data, s, heading));
  writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify(s, null, 2)}\n`);
  return s;
}

// ---------------------------------------------------------------------------
// CLI

async function main() {
  const { values: opts, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      template: { type: 'string', multiple: true },
      since: { type: 'string' },
      until: { type: 'string' },
      verify: { type: 'string', default: 'sample' },
      sample: { type: 'string', default: '25' },
      'target-version': { type: 'string' },
      'confirm-signers': { type: 'boolean', default: false },
      out: { type: 'string', default: 'click-acceptance-report' },
      data: { type: 'string' },
      title: { type: 'string' },
      redact: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const cmd = positionals[0];
  if (opts.help || !['templates', 'collect', 'render'].includes(cmd)) {
    process.stdout.write(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 12).map((l) => l.replace(/^\/\/ ?/, '')).join('\n') + '\n');
    process.exit(cmd ? 2 : 0);
  }
  if (cmd === 'templates') return cmdTemplates();
  const outDir = resolve(opts.out);
  let ds;
  if (cmd === 'render') {
    if (!opts.data) throw new ApiError('render needs --data <path to dataset.json>');
    ds = JSON.parse(readFileSync(opts.data, 'utf8'));
  } else {
    ds = await cmdCollect(opts);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'dataset.json'), `${JSON.stringify(ds, null, 2)}\n`);
  }
  const s = writeReport(ds, outDir, opts.title, opts.redact);
  process.stdout.write(`${JSON.stringify({
    out: outDir,
    files: ['report.html', 'report.md', 'summary.json', ...(cmd === 'collect' ? ['dataset.json'] : [])],
    totals: s.totals,
    pendingReacceptance: s.reacceptance.map((d) => ({ template: d.templateName, deployment: d.deploymentId, serves: d.servedVersion, acceptedTarget: d.acceptedTarget, pending: d.pending.length })),
    integrity: { checked: s.integrity.checked, valid: s.integrity.valid, invalid: s.integrity.invalid, errored: s.integrity.errored },
    limits: s.limits,
  }, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e) => {
    process.stderr.write(`click-report: ${e.message}\n`);
    process.exit(1);
  });
}
