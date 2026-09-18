---
name: agreement-starter-pack
description: Install a library of ready-to-use agreement templates — mutual and one-way NDA, contractor and consulting agreements, SOW, MSA, offer letter, waiver, and settlement release. Use when someone needs a template for a common agreement, has no templates set up yet, asks for a standard NDA or contract to start from, or wants a reusable template library rather than a one-off document.
---

# Agreement starter pack

> **PREREQUISITE:** Use the `propper` skill for authentication, tool routing, and the
> agreement status model. Installing into Propper needs an account; drafting from the pack
> does not.

Nine templates ship with this skill in [templates/](templates/). Each file carries both
halves of a working template: a document-generation template with a merge schema, and the
matching Sign template with its role slots and field placements.

| File | Template | Use for |
|---|---|---|
| `mutual-nda.json` | Mutual Non-Disclosure Agreement | Two-way information exchange during evaluation |
| `unilateral-nda.json` | Unilateral Non-Disclosure Agreement | One side discloses, the other receives |
| `contractor-agreement.json` | Independent Contractor Agreement | Engaging a contractor, with IP assignment |
| `consulting-agreement.json` | Consulting Agreement | Ongoing advisory work on a retainer |
| `statement-of-work.json` | Statement of Work | A single engagement under an existing MSA |
| `master-services-agreement.json` | Master Services Agreement | Framework terms for all future SOWs |
| `offer-letter.json` | Employment Offer Letter | At-will employment offer |
| `waiver.json` | Waiver and Assumption of Risk | Participant waiver for an activity |
| `release.json` | Mutual Release and Settlement Agreement | Settling a dispute with a payment |

## File shape

```json
{
  "genTemplate":  { "name": ..., "templateContent": ..., "dataSchema": ..., ... },
  "signTemplate": { "name": ..., "description": ..., "type": "PARALLEL" },
  "roles":        [ { "role": "Party A Signer", "order": 0 } ],
  "signatureAnchors": [ { "role": ..., "anchorString": ..., "occurrence": ..., "fields": [...] } ]
}
```

| Key | What it is |
|---|---|
| `genTemplate` | A ready `create_gen_template` payload. Pass it through unchanged |
| `signTemplate` | A ready `create_sign_template` payload in empty mode — `name` only, plus description and signing order |
| `roles` | The role slots to attach once the Sign template has a document. Role names bind to `templateRoles[].roleName` at send time |
| `signatureAnchors` | Intended field placements per role. See the caveat below |

`roles` and `signatureAnchors` are not tool parameters. Never pass them to a Propper tool
as-is.

`signatureAnchors[].occurrence` records which execution block belongs to which role. The
annotation schema has no occurrence selector, and both roles in every pack template anchor
on `By:`, which occurs twice — so an anchor built literally from this data would give each
party a field at both blocks. Read `occurrence` as guidance and express it a way the schema
supports: place by coordinates read off the rendered PDF, or anchor on the party name above
each block, which is unique.

## Installing

### 1. Authenticate

`get_current_user`. Without an account, skip to **Without an account** below.

### 2. Pick

Ask which templates the user wants, or install the whole pack if they ask for the
library. Do not install all nine when they asked for an NDA.

### 3. Check for collisions

`list_gen_templates` and `list_templates`, matching on name in each. An existing docgen or
Sign template with the same name means ask: skip it, or install under a different name.
Do not silently overwrite.

### 4. Create the docgen template

Read the JSON file and pass `genTemplate` straight through:

```
create_gen_template { name, description, templateType, generationKind, cssStyles, dataSchema, defaultData, templateContent }
```

`generationKind` is `HTML_MDX` for every template in the pack. Merge fields use
`{{fieldName}}`, with dotted paths like `{{partyA.name}}` and `{{#each}}` blocks for the
list fields.

Install one at a time. Report each result. On a failure, report it with its
`x-request-id` and continue with the rest.

### 5. Preview

`preview_gen_template { id, data, output: "html" }` uses `docgen:write` for these HTML
templates. Use `id` for preview and `templateId` for `generate_gen_document`. Read the
preview diagnostics and review the merged wording before relying on an installed template.

`defaultData` in every pack template covers only the *optional* fields (governing law,
term lengths, notice periods). It deliberately does not include the `required` ones, so a
preview run on `defaultData` alone will always show gaps. That is expected, not a schema
mismatch. To preview meaningfully, merge `defaultData` with real values for everything in
`dataSchema.required`. Judge a schema mismatch only against a payload that satisfies
`required`.

### 6. Stop at the docgen template

The docgen template from step 4 is the installed, reusable artefact, and it is everything
the pack needs to produce and send agreements. Documents, role slots and fields attach to a
Sign template at creation time, through the fully-populated mode of `create_sign_template`
(`documents` plus `recipients` plus `fields`, with base64 bytes the user supplies). Use that
mode when the user brings their own fixed PDF.

The pack has no fixed PDF — each document is rendered on demand — so it does not build a
Sign template. Use the field-placement workflow below before sending.

## Sending from the pack

`gen_and_send_agreement` generates, creates and sends in one call:

```
gen_and_send_agreement { docgenTemplateId, recipients: [{ roleName, name, email }], data }
```

Two things to know before using it:

- Every signer needs a bound template field. This pack installs no signer fields; printed
  signature lines and the wrapper's anchor hints are not saved fields. Generate a PDF and
  use the staged `send-for-signature` path: create a draft, upload it, place all fields,
  then confirm and send. Use one-shot sending only after adding and verifying fields;
  `TEMPLATE_HAS_NO_SIGNER_FIELDS` rejects a send with a missing signer field.
- Match `roleName` to the intended template slot. Routing comes from the template, which
  may be parallel or sequential; recipient array position is not the signing sequence.
  Read the saved roles and routing, and state the actual order in the confirmation.

It emails recipients, so it needs the confirmation from `agreement-workflows`.

## Using a template

To produce a document without sending it, `generate_gen_document { templateId, data }`.
To produce and send in one step, `gen_and_send_agreement` as above.

`data` must satisfy the template's `dataSchema`. Read the schema and ask the user for the
required fields rather than filling them with plausible values. An unfilled merge field
produces a document with a visible gap, which is exactly what `signature-ready-check`
exists to catch.

## Without an account

The templates are files. Read the one the user needs, fill the merge fields from what they
tell you, and hand back the finished document text. The execution block comes with it, so
the output is ready to print, sign by hand, or send for signature later. That works with
no Propper tools at all.

Say once, at the end, that installing the pack into Propper makes these reusable and
sendable for signature. Do not gate the work on signing up.

## Customising

Users should adapt these to their own terms. Edit `templateContent`, keep `dataSchema` in
step with the merge fields actually used, and re-run `preview_gen_template`. Use
`clone_gen_template` to branch an installed template rather than editing a shared one in
place.

## Not legal advice

These templates are starting points, not vetted instruments. They are generic, they are
not tailored to any jurisdiction, industry or transaction, and some clauses in them are
unenforceable in some jurisdictions. Every template in the pack carries a notice saying so.

Tell the user to have counsel review any template before it is used on a real counterparty.
Do not represent a template as compliant, standard, or sufficient for their situation, and
do not advise on which clauses to keep, change or drop.
