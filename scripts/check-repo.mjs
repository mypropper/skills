#!/usr/bin/env node
// Structural checks for the Propper plugin repo. No dependencies.
import { readFileSync, readdirSync, existsSync, lstatSync, readlinkSync } from "node:fs";

const readlinkSafe = (p) => {
  try {
    return lstatSync(p).isSymbolicLink() ? readlinkSync(p) : null;
  } catch {
    return null;
  }
};
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);

const PRODUCTION_MCP_URL = "https://mcp.propper.ai/mcp";
const FORBIDDEN_PLUGIN_FIELDS = [
  "documentation", "support", "privacy_policies", "privacy_policy_url", "terms_url",
];
const MAX_SKILL_LINES = 500;
const MAX_DESCRIPTION_CHARS = 1536;

const walk = (dir, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === ".git" || e.name === "node_modules" || e.name === "results") continue;
    const p = join(dir, e.name);
    e.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
};
const rel = (p) => p.slice(ROOT.length + 1);
const read = (p) => readFileSync(p, "utf8");

// --- JSON: parses, 2-space indented, trailing newline ------------------------
const jsonFiles = walk(ROOT).filter((p) => p.endsWith(".json"));
for (const p of jsonFiles) {
  const raw = read(p);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    fail(rel(p), `invalid JSON — ${e.message}`);
    continue;
  }
  if (!raw.endsWith("\n")) fail(rel(p), "missing trailing newline");
  const canonical = JSON.stringify(parsed, null, 2) + "\n";
  if (raw !== canonical) fail(rel(p), "not formatted as 2-space JSON with a trailing newline");
}

// --- plugin.json -------------------------------------------------------------
const pluginPath = join(ROOT, ".claude-plugin/plugin.json");
if (!existsSync(pluginPath)) {
  fail(".claude-plugin/plugin.json", "missing");
} else {
  const plugin = JSON.parse(read(pluginPath));
  for (const f of ["name", "description", "version", "author", "homepage", "repository", "license", "keywords"]) {
    if (plugin[f] === undefined) fail(".claude-plugin/plugin.json", `missing required field "${f}"`);
  }
  for (const f of FORBIDDEN_PLUGIN_FIELDS) {
    if (plugin[f] !== undefined) {
      fail(".claude-plugin/plugin.json", `field "${f}" fails "claude plugin validate --strict" — put the link in the README instead`);
    }
  }
  if (plugin.name !== "propper") {
    fail(".claude-plugin/plugin.json", `name must stay "propper" — the slug is immutable once published (found "${plugin.name}")`);
  }
}

// --- marketplace.json --------------------------------------------------------
const marketPath = join(ROOT, ".claude-plugin/marketplace.json");
if (!existsSync(marketPath)) {
  fail(".claude-plugin/marketplace.json", "missing");
} else {
  const market = JSON.parse(read(marketPath));
  for (const f of ["name", "owner", "description", "plugins"]) {
    if (market[f] === undefined) fail(".claude-plugin/marketplace.json", `missing required field "${f}" (--strict warns without a description)`);
  }
  if (!Array.isArray(market.plugins) || market.plugins.length === 0) {
    fail(".claude-plugin/marketplace.json", "plugins[] must list at least one plugin");
  }
}

// --- .mcp.json: production only ---------------------------------------------
const mcpPath = join(ROOT, ".mcp.json");
if (!existsSync(mcpPath)) {
  fail(".mcp.json", "missing");
} else {
  const servers = JSON.parse(read(mcpPath)).mcpServers ?? {};
  for (const [name, cfg] of Object.entries(servers)) {
    if (cfg.type !== "streamable-http") fail(".mcp.json", `server "${name}" must use the hosted streamable-http transport, not "${cfg.type}"`);
    if (cfg.url !== PRODUCTION_MCP_URL) fail(".mcp.json", `server "${name}" must point at ${PRODUCTION_MCP_URL} — production is the only endpoint`);
    if (cfg.command || cfg.env) fail(".mcp.json", `server "${name}" must not use a stdio command or env vars — a new installer has no PROPPER_TOKEN`);
  }
}

// --- frontmatter helper ------------------------------------------------------
const parseFrontmatter = (raw) => {
  if (!raw.startsWith("---\n")) return null;
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return null;
  const fields = {};
  for (const line of raw.slice(4, end).split("\n")) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m) fields[m[1]] = m[2].trim();
  }
  return { fields, bodyLines: raw.slice(end + 4).split("\n").length };
};

// --- skills ------------------------------------------------------------------
const skillsDir = join(ROOT, "skills");
if (!existsSync(skillsDir)) {
  fail("skills/", "missing");
} else {
  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    const skillPath = join(skillsDir, name, "SKILL.md");
    const id = `skills/${name}/SKILL.md`;
    if (!existsSync(skillPath)) {
      fail(`skills/${name}/`, "missing SKILL.md");
      continue;
    }
    const raw = read(skillPath);
    const fm = parseFrontmatter(raw);
    if (!fm) {
      fail(id, "missing or malformed YAML frontmatter");
      continue;
    }
    if (fm.fields.name !== name) fail(id, `frontmatter name "${fm.fields.name}" must match the directory name "${name}"`);
    if (!fm.fields.description) fail(id, "missing frontmatter description — it is the trigger surface");
    const combined = (fm.fields.description ?? "").length + (fm.fields.when_to_use ?? "").length;
    if (combined > MAX_DESCRIPTION_CHARS) fail(id, `description + when_to_use is ${combined} chars, over the ${MAX_DESCRIPTION_CHARS} limit`);
    if (fm.bodyLines > MAX_SKILL_LINES) fail(id, `${fm.bodyLines} lines, over the ${MAX_SKILL_LINES} budget — move mechanics into references/`);

    // every markdown file in the skill: links resolve, no host-specific tool prefixes
    for (const f of walk(join(skillsDir, name))) {
      if (!f.endsWith(".md")) continue;
      const body = read(f);
      for (const m of body.matchAll(/\]\((?!https?:|mailto:|#)([^)\s]+)\)/g)) {
        const target = resolve(dirname(f), m[1].split("#")[0]);
        if (!existsSync(target)) fail(rel(f), `broken relative link: ${m[1]}`);
      }
      if (/mcp__[a-z0-9_]+__/i.test(body)) {
        fail(rel(f), "namespaced MCP tool name — skills must use bare tool names so every host can apply its own prefix");
      }
    }
  }
}

// --- contributor skills and the .claude/skills symlink -----------------------
const agentsSkills = join(ROOT, ".agents/skills");
if (!existsSync(agentsSkills)) {
  fail(".agents/skills/", "missing — contributor skills live here");
} else {
  for (const entry of readdirSync(agentsSkills, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const p = join(agentsSkills, entry.name, "SKILL.md");
    if (!existsSync(p)) {
      fail(`.agents/skills/${entry.name}/`, "missing SKILL.md");
      continue;
    }
    const fm = parseFrontmatter(read(p));
    if (!fm) fail(`.agents/skills/${entry.name}/SKILL.md`, "missing or malformed frontmatter");
    else if (fm.fields.name !== entry.name) {
      fail(`.agents/skills/${entry.name}/SKILL.md`, `frontmatter name "${fm.fields.name}" must match the directory name`);
    }
  }
}
const claudeSkills = join(ROOT, ".claude/skills");
if (!existsSync(claudeSkills)) {
  fail(".claude/skills", "missing — it should symlink to ../.agents/skills so both layouts load one copy");
} else if (resolve(dirname(claudeSkills), readlinkSafe(claudeSkills) ?? "") !== agentsSkills) {
  fail(".claude/skills", "must be a symlink to ../.agents/skills");
}

// --- evals -------------------------------------------------------------------
const evalsDir = join(ROOT, "evals");
if (existsSync(evalsDir)) {
  const cases = readdirSync(evalsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== "results");
  if (cases.length < 4) fail("evals/", `only ${cases.length} eval case(s); at least 4 are expected`);
  for (const c of cases) {
    const dir = join(evalsDir, c.name);
    const promptPath = join(dir, "prompt.md");
    if (!existsSync(promptPath)) {
      if (!existsSync(join(dir, "case.yaml"))) fail(`evals/${c.name}/`, "missing prompt.md or case.yaml");
      continue;
    }
    if (!parseFrontmatter(read(promptPath))) fail(`evals/${c.name}/prompt.md`, "missing or malformed frontmatter");
    const gradersDir = join(dir, "graders");
    if (!existsSync(gradersDir)) {
      fail(`evals/${c.name}/`, "missing graders/");
      continue;
    }
    const graders = readdirSync(gradersDir).filter((f) => f.endsWith(".md"));
    if (graders.length === 0) fail(`evals/${c.name}/graders/`, "no grader files");
    for (const g of graders) {
      const fm = parseFrontmatter(read(join(gradersDir, g)));
      if (!fm) fail(`evals/${c.name}/graders/${g}`, "missing or malformed frontmatter");
      else if (!fm.fields.type) fail(`evals/${c.name}/graders/${g}`, "missing a grader type");
    }
    // fixtures are not carried into the eval sandbox
    if (existsSync(join(dir, "files"))) {
      fail(`evals/${c.name}/files/`, "eval runs get a bare working directory — inline the document in prompt.md instead");
    }
  }
}

// --- production-only + whitespace across all markdown ------------------------
const BAD_HOSTS = /\b(?:propper-demo|demo\.propper\.ai|staging\.propper\.ai|sandbox\.propper\.ai|localhost:\d+)\b/i;
for (const p of walk(ROOT).filter((f) => f.endsWith(".md") || f.endsWith(".json"))) {
  const raw = read(p);
  if (BAD_HOSTS.test(raw)) fail(rel(p), "references a non-production Propper environment");
  // The stdio ban applies to what ships and what configures the server. Contributor docs
  // name PROPPER_TOKEN in order to prohibit it, so they are exempt.
  const documentsTheRule = rel(p) === "CONTRIBUTING.md" || rel(p).startsWith(".agents/");
  if (!documentsTheRule && /PROPPER_TOKEN|npx @propper-ai\/propper-mcp/.test(raw)) {
    fail(rel(p), "references the stdio transport — install must be self-serve OAuth against the hosted server");
  }
  raw.split("\n").forEach((line, i) => {
    if (/[ \t]+$/.test(line)) fail(`${rel(p)}:${i + 1}`, "trailing whitespace");
  });
  if (raw.length && !raw.endsWith("\n")) fail(rel(p), "missing trailing newline");
}

if (errors.length) {
  console.error(`✘ ${errors.length} problem(s):\n`);
  for (const e of errors) console.error(`  • ${e}`);
  process.exit(1);
}
console.log("✔ repo checks passed");
