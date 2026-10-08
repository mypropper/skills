import assert from "node:assert/strict";
import test from "node:test";
import {
  dataLimits, normalizeAcceptance, parseWhen, pickForVerify, pickTemplates, reacceptance, redact, renderHtml, renderMarkdown, summarize,
} from "../skills/click-acceptance-reports/scripts/click-report.mjs";

// A fictional organization: one template, two majors, a production and a staging deployment.
const template = { id: "t-eula", name: "Northwind Console EULA", status: "PUBLISHED" };
const versions = [
  { id: "v1", version: "1.0.0", major: 1, label: "EULA 1.0", publishedAt: "2026-01-05T00:00:00Z" },
  { id: "v2", version: "2.0.0", major: 2, label: "EULA 2.0", publishedAt: "2026-03-01T00:00:00Z" },
];
const versionsById = new Map(versions.map((v) => [v.id, v]));
const deployments = [
  { id: "d-prod", templateId: "t-eula", environment: "PRODUCTION", versionId: "v2", active: true },
  { id: "d-prod-b", templateId: "t-eula", environment: "PRODUCTION", versionId: "v2", active: true },
  { id: "d-stage", templateId: "t-eula", environment: "STAGING", versionId: "v2", active: true },
];
const deploymentsById = new Map(deployments.map((d) => [d.id, d]));

const row = (id, deploymentId, versionId, userRef, timestamp) => ({
  id, receiptId: id, templateId: "t-eula", deploymentId, templateVersionId: versionId, timestamp, consentMethod: "BUTTON",
  ...(userRef ? { userRef } : {}),
});
const rows = [
  row("a0", "d-prod", "v1", null, "2026-01-10T09:00:00.000Z"),
  row("a1", "d-prod", "v1", "ana@example.com", "2026-02-01T09:00:00.000Z"),
  row("a2", "d-prod", "v2", "ana@example.com", "2026-03-02T09:00:00.000Z"),
  row("b1", "d-prod", "v1", "ben@example.com", "2026-02-02T09:00:00.000Z"),
  row("c1", "d-prod", "v1", "cy@example.com", "2026-02-03T09:00:00.000Z"),
  row("c2", "d-prod-b", "v2", "cy@example.com", "2026-03-03T09:00:00.000Z"),
  row("e1", "d-prod", "v1", "eli@example.com", "2026-02-04T09:00:00.000Z"),
  row("e2", "d-stage", "v2", "eli@example.com", "2026-03-04T09:00:00.000Z"),
].map((r) => normalizeAcceptance(r, { versionsById, deploymentsById }));

test("reads version and signer from the receipt when the row lacks them", () => {
  const bare = { id: "r1", receiptId: "r1", templateId: "t-eula", deploymentId: "d-prod", templateVersionId: null, timestamp: "2026-03-05T00:00:00Z", consentMethod: "BUTTON" };
  const receipt = { evidenceStatus: "complete", evidence: { userRef: "dee@example.com", versionId: "v2", metadata: { versionNumber: "2.0.0" } } };
  const n = normalizeAcceptance(bare, { versionsById, deploymentsById, receipt });
  assert.equal(n.version, "2.0.0");
  assert.equal(n.major, 2);
  assert.equal(n.versionSource, "receipt");
  assert.equal(n.signer, "dee@example.com");
  assert.equal(n.signerSource, "receipt");
  assert.equal(n.environment, "PRODUCTION");
});

test("prefers the row, and resolves its version id through the published versions", () => {
  const n = normalizeAcceptance(row("x", "d-prod", "v1", "fay@example.com", "2026-02-09T00:00:00Z"), {
    versionsById, deploymentsById, receipt: { evidence: { userRef: "other@example.com", metadata: { versionNumber: "2.0.0" } } },
  });
  assert.equal(n.version, "1.0.0");
  assert.equal(n.versionSource, "row");
  assert.equal(n.signer, "fay@example.com");
  assert.equal(n.signerSource, "row");
});

test("names the signers still on the earlier major, per deployment and environment", () => {
  const out = reacceptance({ rows, templates: [template], deployments, versionsByTemplate: { "t-eula": versions } });
  const prod = out.find((d) => d.deploymentId === "d-prod");
  // ana re-accepted here, cy re-accepted through the other production deployment.
  // eli re-accepted only in staging, which does not count for production.
  assert.deepEqual(prod.pending.map((p) => p.signer), ["ben@example.com", "eli@example.com"]);
  assert.equal(prod.acceptedTarget, 2);
  assert.equal(prod.unsignedAcceptances, 1);
  assert.equal(prod.pending[0].lastVersion, "1.0.0");
  const stage = out.find((d) => d.deploymentId === "d-stage");
  assert.deepEqual(stage.pending, []);
});

test("a target version overrides the served major", () => {
  const served1 = deployments.map((d) => ({ ...d, versionId: "v1" }));
  const out = reacceptance({ rows, templates: [template], deployments: served1, versionsByTemplate: { "t-eula": versions }, targetVersion: "2.0.0" });
  assert.equal(out.find((d) => d.deploymentId === "d-prod").targetMajor, 2);
  assert.equal(out.find((d) => d.deploymentId === "d-prod").servedVersion, "1.0.0");
});

test("states when signers were not recorded", () => {
  const limits = dataLimits({ window: {}, signerStatus: {} }, rows, { mode: "all", checked: rows.length, eligible: rows.length });
  assert(limits.some((l) => l.startsWith("Signer not recorded for acceptances before 2026-02-01 09:00 UTC (1 of 8)")));
  const mixed = dataLimits({ window: {}, signerStatus: {} }, [...rows, { ...rows[0], id: "late", timestamp: "2026-04-01T00:00:00Z" }], { mode: "sample", checked: 2, eligible: 9 });
  assert(mixed.some((l) => l.startsWith("Signer not recorded for 2 of 9 acceptances")));
  assert(mixed.some((l) => l.includes("sample of 2 of 9")));
});

test("template selection rejects an ambiguous name and accepts an exact one", () => {
  const all = [template, { id: "t2", name: "Northwind Console EULA (Legacy)" }, { id: "t3", name: "Northwind Store Terms" }];
  assert.throws(() => pickTemplates(all, ["console"]), /matches 2 templates/);
  assert.deepEqual(pickTemplates(all, ["northwind console eula"]).map((t) => t.id), ["t-eula"]);
  assert.deepEqual(pickTemplates(all, ["store"]).map((t) => t.id), ["t3"]);
  assert.throws(() => pickTemplates(all, ["nothing"]), /No template matches/);
});

test("samples evenly and parses relative windows", () => {
  const picked = pickForVerify(rows, "sample", 4);
  assert.equal(picked.length, 4);
  assert.equal(picked[0].id, "a0");
  assert.equal(pickForVerify(rows, "none", 4).length, 0);
  assert.equal(pickForVerify(rows, "all", 4).length, rows.length);
  assert.equal(parseWhen("7d", Date.parse("2026-03-08T00:00:00Z")), "2026-03-01T00:00:00.000Z");
  assert.equal(parseWhen("2026-03-07", 0, { isUntil: true }), "2026-03-08T00:00:00.000Z");
  assert.equal(parseWhen("2026-03-07", 0), "2026-03-07T00:00:00.000Z");
});

test("renders both reports from real numbers, and redaction hides signer references", () => {
  const ds = {
    generatedAt: "2026-03-10T00:00:00Z", window: {}, templates: [template], deployments, versionsByTemplate: { "t-eula": versions },
    acceptances: rows, verify: { mode: "all" }, signerStatus: { requested: false },
    verifications: [
      { receiptId: "a2", signer: "ana@example.com", version: "2.0.0", timestamp: rows[2].timestamp, valid: true, checks: { contentHash: "pass", tsaToken: "not_issued" }, environmentChecks: {}, errors: [] },
      { receiptId: "b1", signer: "ben@example.com", version: "1.0.0", timestamp: rows[3].timestamp, valid: false, checks: { contentHash: "fail" }, environmentChecks: {}, errors: ["contentHash: Content hash does not match"] },
    ],
    reacceptance: reacceptance({ rows, templates: [template], deployments, versionsByTemplate: { "t-eula": versions } }).map((d) => ({ ...d, revisions: [], change: null })),
    api: { calls: 12 },
  };
  const s = summarize(ds);
  assert.equal(s.totals.acceptances, 8);
  assert.equal(s.byTemplate[0].versions.find((v) => v.version === "1.0.0").acceptances, 5);
  assert.equal(s.integrity.invalid, 1);
  const html = renderHtml(ds, s, "EULA report");
  const md = renderMarkdown(ds, s, "EULA report");
  for (const out of [html, md]) {
    assert(!/undefined|NaN/.test(out));
    assert(out.includes("ben@example.com"));
    assert(out.includes("Content hash does not match"));
  }
  const hidden = redact(ds);
  const redactedHtml = renderHtml(hidden, summarize(hidden), "EULA report");
  assert(!redactedHtml.includes("@example.com"));
  assert(redactedHtml.includes("signer-00"));
});

// ---------------------------------------------------------------------------
// HTTP behaviour, with fetch stubbed: no network.

const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

const withFetch = async (handler, fn) => {
  const real = globalThis.fetch;
  const calls = [];
  process.env.PROPPER_CLIENT_ID = "client-example";
  process.env.PROPPER_CLIENT_SECRET = "secret-example";
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(url);
    if (u.pathname === "/oauth2/token") return json(200, { access_token: "token-example", expires_in: 3600 });
    calls.push({ method: init.method ?? "GET", path: u.pathname, query: Object.fromEntries(u.searchParams), body: init.body ?? null });
    return handler(calls.at(-1), calls.length);
  };
  try {
    return await fn(calls);
  } finally {
    globalThis.fetch = real;
  }
};

test("reads every page, and waits out a 429 before retrying", async () => {
  await withFetch((call, n) => {
    if (n === 2) return json(429, { errorCode: "RATE_LIMITED" }, { "retry-after": "1" });
    const page = Number(call.query.page);
    return json(200, { acceptances: [{ id: `p${page}` }], pagination: { total: 3, page, limit: 100, hasMore: page < 3 } });
  }, async (calls) => {
    const { getAll } = await import("../skills/click-acceptance-reports/scripts/click-report.mjs");
    const rows = await getAll("/v1/click/acceptances", "acceptances", { templateId: "t-eula" });
    assert.deepEqual(rows.map((r) => r.id), ["p1", "p2", "p3"]);
    assert.equal(calls.length, 4);
    assert(calls.every((c) => c.method === "GET" && c.query.limit === "100" && c.query.templateId === "t-eula"));
  });
});

test("signer status uses POST, falls back to GET, and reads a missing signer as never accepted", async () => {
  await withFetch((call) => {
    if (call.method === "POST") return json(404, { errorCode: "CLICK_NOT_FOUND", message: `Cannot POST ${call.path}` });
    return json(404, { errorCode: "CLICK_SIGNER_NOT_FOUND", message: "This signer has no acceptance of the template in this environment" });
  }, async (calls) => {
    const { signerStatus } = await import("../skills/click-acceptance-reports/scripts/click-report.mjs");
    assert.deepEqual(await signerStatus("d-prod", "ben@example.com"), { status: "stale", accepted: null, served: null, reason: "never_accepted" });
    assert.deepEqual(calls.map((c) => c.method), ["POST", "GET"]);
    assert.equal(JSON.parse(calls[0].body).userRef, "ben@example.com");
    assert.equal(calls[1].query.userRef, "ben@example.com");
    // Once POST is known to be unavailable, later lookups go straight to GET.
    await signerStatus("d-prod", "eli@example.com");
    assert.deepEqual(calls.map((c) => c.method), ["POST", "GET", "GET"]);
  });
});
