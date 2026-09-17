---
name: migrate-from-docusign
description: Audit a DocuSign template or envelope export and report exactly what carries over, what changes shape, and what needs rebuilding — then import it. Use when someone has DocuSign template JSON, is evaluating a move off DocuSign, asks what their templates would look like elsewhere, or wants existing envelopes and tabs brought across.
---

# Migrate from DocuSign

> **PREREQUISITE:** Use the `propper` skill for authentication, tool routing, and the
> agreement status model.

The audit runs with no Propper account and no Propper tools. Produce the report first;
import only once the user has an account and asks for it.

## Part 1 — Audit (no account needed)

### 1. Find the exports

DocuSign templates export as JSON, one file per template. Envelope definitions have the
same tab vocabulary. Accept a directory, a list of paths, or pasted JSON.

Read each file. Do not call any Propper tool during the audit.

### 2. Inventory each template

Report per template:

| Reading | From |
|---|---|
| Name and description | `name`, `description` |
| Documents | `documents[]`, with name and whether `documentBase64` is embedded |
| Roles | `recipients.signers[].roleName`, plus `routingOrder` |
| Field count by type | every `tabs` array across all recipients |
| Anchors in use | `anchorString` values, with their offsets |
| Merge fields | `textTabs` carrying `tabLabel` used as data placeholders |
| Conditional logic | `conditionalParentLabel`, `conditionalParentValue` |
| Routing | `routingOrder` distinct values — more than one means sequential |

### 3. Classify

Sort every element into three buckets, and show the counts.

**Carries over** — documents, roles, routing order, and the tab types with a direct
Propper equivalent. Most templates are mostly this.

**Changes shape** — elements that survive with a different representation: string
coordinates become numbers, string booleans become booleans, `documentId`/`recipientId`
references are re-bound on import. The user does not have to do anything, but the JSON
will not look identical.

**Needs rebuilding** — anything with no direct equivalent. Name each one specifically,
with the template and tab label it came from. Never report this bucket as a count alone.

The mapping table is in
[references/docusign-mapping.md](references/docusign-mapping.md).

### 4. Report

Lead with the headline: how many templates, what share of fields carries over unchanged,
and the specific items that need hand work. Then the per-template detail.

Be concrete about effort. "Three of eleven templates use conditional tabs that need
rebuilding" is useful; "mostly compatible" is not.

If the user has no Propper account, stop here. Give them the report and mention that
importing is a single call once they have one.

## Part 2 — Import (needs an account)

### 5. Authenticate

`get_current_user`. Stop on failure per the `propper` skill.

### 6. Check for collisions

`list_templates` with `search` on each template name. An existing match means the user
chooses: import under a new name, or `overwriteExisting: true` to replace in place.
Do not overwrite without asking.

### 7. Import

Signature templates:

```
import_template { template: <the DocuSign JSON object>, format: "docusign", overwriteExisting: false }
```

`format` also accepts `"propper"` for a Propper export and `"auto"` to detect. Pass
`"docusign"` explicitly when the source is known — detection failing mid-import is a worse
outcome than a rejected call.

DocuSign Gen templates:

```
import_gen_template_from_source { sourceSystem: "DOCUSIGN_GEN", templateJson: <the export> }
```

The Gen export embeds its source document at `documents[0].documentBase64`, so there is no
separate upload. Verify that key exists before calling; an export missing it will import a
template with no document. This import is idempotent on
(`sourceSystem`, `sourceTemplateId`), so re-running updates the same template rather than
creating duplicates. `name` and `description` override the imported values.

Import one template per call. On a failure, report which template failed with its
`x-request-id` and continue with the rest — do not abandon a batch after one error.

### 8. Verify

`list_templates` and `get_template` on each import. Compare against the audit: role names
present, field counts matching, routing order preserved. Report any drift per template.

Use `get_template` for this, not `export_template`: `get_template` returns the full field
set, while the export is a portable summary covering the common field types. See
[references/docusign-mapping.md](references/docusign-mapping.md).

Read the `warnings` array on the import response and repeat it to the user verbatim. Then
check for the conversions that do not raise a warning — `noteTabs` arrive as text fields on
a signer and `approveTabs` as checkboxes — and remove them, since neither is a field the
signer should be filling.

Tell the user to send one low-stakes agreement from an imported template before retiring
the DocuSign original. Do not do that send as part of the migration.

## Boundary

Report what the export contains. Do not advise on whether previously executed DocuSign
agreements remain valid, on retention obligations, or on what to do with the DocuSign
account. Those are decisions for the user and their counsel.
