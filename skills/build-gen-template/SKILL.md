---
name: build-gen-template
description: Turn a document that gets rewritten for every customer into a reusable template — find the values that change between copies, replace them with merge fields, declare the data behind them, and embed signature anchors so generated copies can go straight out for signature. Use when someone retypes the same contract, offer letter or statement of work each time, asks to templatize or parameterize a document, wants a reusable version of something they already have, or needs the same paperwork produced for many parties.
---

# Build a generation template

> **PREREQUISITE:** Use the `propper` skill for authentication, tool routing, and the
> agreement status model. Drafting the template body needs no account; saving it does.

A template is the document with its variable parts pulled out into named fields. Getting
those boundaries right is the whole job — everything downstream is mechanical.

To fill a template that already exists, use `generate-document`. For a ready-made library
of common agreements, use `agreement-starter-pack`.

## Steps

### 1. Authenticate

`get_current_user`. Report the organization. Stop on failure per the `propper` skill.

### 2. Choose the engine

| Source | `generationKind` | Notes |
|---|---|---|
| HTML, Markdown or MDX text | `HTML_MDX` | The default when omitted. Styling via `cssStyles`, `headerTemplate`, `footerTemplate` |
| A Word `.docx` file | `DOCX_HANDLEBARS` | `templateContent` is the file bytes base64-encoded, 25MB before encoding |
| A DocuSign Gen export | — | Not created here. Use `import_gen_template_from_source` |

`DOCX_HANDLEBARS` needs the DOCX upload capability on the account. Without it the call
returns `422 GENERATION_KIND_NOT_SUPPORTED_HERE`. Say that plainly rather than retrying.

`SIGN_PDF_DOCGEN` cannot be created here at all; supplying it returns the same `422`.

### 3. Separate what varies from what does not

Work from the actual document. A span is a field when it would differ between two real
copies:

- party names, entity types and addresses
- dates — effective, start, expiry — and the numbers that drive them, like term length
- amounts, rates, quantities, currencies
- anything the author currently finds and replaces by hand

A span is **not** a field when it is the same in every copy. Governing law, standard
clause wording and boilerplate stay as literal text. Over-parameterizing produces a
template nobody can fill.

Anything that repeats an unknown number of times — line items, milestones, schedules,
named personnel — is a collection, not a numbered set of fields.

When previous copies of the document exist, diff two of them. What differs is the field
list, and it is a better list than one derived by reading a single copy.

### 4. Write the placeholders

`{{fieldName}}` for a simple value, `{{customer.name}}` for a nested one, and
`{{#each items}} ... {{/each}}` around a repeating block. Full syntax and the layout rules
are in [references/template-syntax.md](references/template-syntax.md).

### 5. Embed the signature anchors

Place `{{propper.sign.recipient.N.signature}}` where each signature belongs, where `N` is
the recipient position starting at 1. `dateSigned` and `fullName` are available the same
way, and `text.<fieldId>` for a custom input.

These become real signature fields automatically when a generated copy is sent for
signature, which is what saves the document from needing `place-signature-fields` later.
Put them on the execution block — a signature anchor in the body of a clause renders a
field in the middle of a sentence.

### 6. Declare the schema and the defaults

`dataSchema` describes the merge payload: every field, its type and its label; every
collection, and the typed fields of its items. A field that is not declared will not
merge, however correct it looks in the body.

`defaultData` supplies values for fields a caller omits. Use it for genuinely constant
things like the sending entity's own name — never for a counterparty value, which is how
the wrong company's name reaches a real customer.

### 7. Create it

```
create_gen_template {
  name, templateType, description,
  generationKind, templateContent,
  dataSchema, defaultData,
  cssStyles, headerTemplate, footerTemplate
}
```

Only `name` is required, but a template with no `dataSchema` cannot be validated at
generation time. Declare the schema.

### 8. Preview it before anyone relies on it

`preview_gen_template { id, data, output: "html" }` with representative data, and read `diagnostics[]`.
Preview three payloads, not one:

1. A realistic complete row.
2. A row with an **empty collection** — the loop should collapse cleanly, not leave a
   dangling "the following items:".
3. A row with the **longest realistic values** — a long entity name that wraps badly
   breaks a signature block.

HTML preview needs `docgen:write`. DOCX and URL previews require platform-reserved
`docgen:preview`, unavailable to MCP clients. For DOCX, generate a PDF and retrieve it
for review using `generate-document`; do not send it before reviewing the result.

### 9. Iterate

Call `update_gen_template` with `id` and only the properties being changed: `name`,
`description`, `templateContent`, `cssStyles`, `dataSchema`, `defaultData`, `headerTemplate`,
`footerTemplate`, `content`, `fields`, `engine`, `delimiters` or `changeLog`. Do not echo a
`get_gen_template` response: `templateType`, `generationKind`, `settings`, imported-source
metadata, version and timestamps are not update arguments. Supplying `fields` replaces
the full field list, so preserve the fields you intend to keep. Content changes create a
version snapshot.

`clone_gen_template` branches a variant — use it for a genuinely different document, not
for a difference that should have been a field.

## Coming from DocuSign

A DocuSign Gen export imports with `import_gen_template_from_source`, which is idempotent
on the source template id — re-importing updates in place rather than duplicating. Use
`migrate-from-docusign` to audit the export first.

`gen_and_send_agreement` accepts native templates as well as imported ones; a linked
Sign template is not required. Before using it, verify each signer's field bindings and
the template's routing with `send-for-signature`. A native template with no signer fields
needs fields added before a send, or the staged generate-and-place workflow.

## Failure handling

| Symptom | Cause and fix |
|---|---|
| `422 GENERATION_KIND_NOT_SUPPORTED_HERE` | DOCX upload capability missing, or `SIGN_PDF_DOCGEN` supplied. Use `HTML_MDX`, or import from source |
| Diagnostics report an unresolved token | The body references a field the schema does not declare. Add it to the schema or remove it from the body |
| Diagnostics report an unknown helper | A typo in `{{#each}}` or `{{#if}}` |
| A generated copy has fields in odd places | Signature anchors sit inside body text. Move them to the execution block |
| `TEMPLATE_HAS_NO_SIGNER_FIELDS` | At least one signer has no bound template field. Correct the complete field set, or generate and place fields on a draft before sending |

## Boundary

Turning a document into a template does not review its contents. Do not tell the user the
template's wording is correct, standard or safe to reuse. Restructuring text into fields
can change what a sentence says — show the user the preview and let them read it.
