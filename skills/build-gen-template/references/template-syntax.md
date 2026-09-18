# Template syntax

## Placeholders

| Form | Renders |
|---|---|
| `{{fieldName}}` | A declared simple value |
| `{{customer.name}}` | A nested value. The parent must be declared as an object in the schema |
| `{{#each items}} ... {{/each}}` | The enclosed block once per item in a collection |
| `{{propper.sign.recipient.1.signature}}` | A signature field for recipient 1 when the generated copy is sent |

Inside an `{{#each}}` block, item fields are referenced by their own names — the block
scopes to the current item.

## Signature anchors

`{{propper.sign.recipient.N.<kind>}}`, with `N` starting at **1**, not 0.

| Kind | Renders |
|---|---|
| `signature` | The signature field itself |
| `dateSigned` | The date the recipient signed, filled automatically |
| `fullName` | The recipient's name as entered |
| `text.<fieldId>` | A custom text input the recipient fills |

Recipient numbering is positional, so it must line up with the order recipients are
supplied at send time. Recipient 1 in the template is the first recipient on the
agreement — get this wrong and the counterparty signs on the sender's line.

Anchors belong in the execution block. An anchor placed mid-sentence renders a signature
field mid-sentence.

## Engines

| `generationKind` | `templateContent` holds | Styling |
|---|---|---|
| `HTML_MDX` (default) | HTML, Markdown or MDX text | `cssStyles`, `headerTemplate`, `footerTemplate` |
| `DOCX_HANDLEBARS` | A `.docx` file, base64-encoded, 25MB before encoding | The Word document's own styling. `cssStyles` is ignored |
| `SIGN_PDF_DOCGEN` | Not creatable — arrives only via import from source | — |

`DOCX_HANDLEBARS` requires the DOCX upload capability on the account; without it the
request returns `422 GENERATION_KIND_NOT_SUPPORTED_HERE`.

## Layout notes

**Page breaks.** For `HTML_MDX`, force one with CSS (`page-break-before`) rather than
blank lines — content reflows when a merged value is longer than the example.

**Headers and footers.** `headerTemplate` and `footerTemplate` repeat on every page. Put
the document title and page numbering there, not in the body, or they appear once and
then vanish.

**Tables from collections.** Put the `{{#each}}` around the row, not around the table. A
loop wrapped around the whole table renders a new table per item.

**Long values.** A field holding a full legal entity name is routinely three times longer
than the placeholder. Preview with the longest realistic value before trusting a layout,
especially inside signature blocks and table cells.

## Preview response shapes

| Template source | Response |
|---|---|
| Word | `previewUrl` (short-lived, presigned) plus `expiresAt`. Fetch before it expires; preview again for a fresh URL |
| HTML / Markdown | Sanitized `html` plus a `csp` object for safe display in an iframe |

Both carry `diagnostics[]`. HTML preview with `output: "html"` uses `docgen:write` and
creates no generated-document record or quota charge. Word and URL previews require
platform-reserved `docgen:preview`, unavailable to MCP clients. Generate and retrieve a
PDF for review instead; that path creates a document and consumes generation quota.
