import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { checkTemplate } from "./template-checks.mjs";

const template = (content, properties) => ({ templateContent: content, dataSchema: { type: "object", properties } });

test("reports unused nested properties and undeclared merge fields", () => {
  const result = checkTemplate(template("{{party.name}} {{missing}}", {
    party: { type: "object", properties: { name: { type: "string" }, address: { type: "string" } } },
  }));
  assert(result.errors.some((error) => error.includes('unused dataSchema property "party.address"')));
  assert(result.errors.some((error) => error.includes('undeclared merge field "missing"')));
});

test("checks array item scope, this, root and parent references", () => {
  const result = checkTemplate(template("{{#each rows}}{{name}} {{this.name}} {{../title}} {{@root.title}}{{/each}}{{#each labels}}{{this}}{{/each}}", {
    title: { type: "string" },
    rows: { type: "array", items: { type: "object", properties: { name: { type: "string" } } } },
    labels: { type: "array", items: { type: "string" } },
  }));
  assert.deepEqual(result.errors, []);
  assert(!result.variants[0].html.includes("{{"));
  const invalid = checkTemplate(template("{{#each rows}}{{missing}}{{/each}}", {
    rows: { type: "array", items: { type: "object", properties: { name: { type: "string" } } } },
  }));
  assert(invalid.errors.some((error) => error.includes("rows[].missing")));
});

test("rejects unbalanced blocks, stray else and incomplete expressions", () => {
  for (const content of ["{{#if enabled}}", "{{/each}}", "{{#if enabled}}{{/each}}", "{{else}}", "{{enabled"]) {
    assert(checkTemplate(template(content, { enabled: { type: "boolean" } })).errors.length > 0, content);
  }
});

test("checks every optional combination and detects gaps only present with clauses off", () => {
  const result = checkTemplate(template('<h2>1. First</h2>{{#if enabled}}<h2>2. Optional</h2>{{/if}}<h2>3. Last</h2>', {
    enabled: { type: "boolean" },
  }));
  assert.equal(result.variants.length, 2);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /1, 3.*"enabled":false/);
});

test("validates fields even in conditional branches and renders else branches", () => {
  const result = checkTemplate(template("{{#if enabled}}{{label}}{{else}}Disabled{{/if}}", {
    enabled: { type: "boolean" }, label: { type: "string" },
  }), { label: "A & B" });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.variants.map((variant) => variant.html), ["Disabled", "A &amp; B"]);
  assert(checkTemplate(template("{{#if enabled}}{{missing}}{{/if}}", { enabled: { type: "boolean" } })).errors.some((error) => error.includes("missing")));
});

test("release and waiver render every optional clause both on and off", () => {
  const load = (name) => JSON.parse(readFileSync(new URL(`../skills/agreement-starter-pack/templates/${name}.json`, import.meta.url))).genTemplate;
  const release = checkTemplate(load("release"));
  const waiver = checkTemplate(load("waiver"));
  assert.deepEqual(release.errors, []);
  assert.deepEqual(waiver.errors, []);
  assert.equal(release.variants.length, 8);
  assert.equal(waiver.variants.length, 2);
  for (const { conditions, html } of release.variants) {
    assert.equal(html.includes("Civil Code section 1542"), conditions.includes1542);
    assert.equal(html.includes("<h2>Confidentiality</h2>"), conditions.includesConfidentiality);
    assert.equal(html.includes("<h2>Non-Disparagement</h2>"), conditions.includesNonDisparagement);
    assert(html.includes("<h2>Execution</h2>"));
    assert(!html.includes("{{"));
  }
  for (const { conditions, html } of waiver.variants) {
    assert.equal(html.includes("Participant Under 18"), conditions.isMinor);
    assert(html.includes("<h2>Execution</h2>"));
    assert(!html.includes("{{"));
  }
});
