# DocuSign to Propper mapping

## Entities

| DocuSign | Propper |
|---|---|
| Envelope | Agreement |
| Envelope status | Agreement status (see the `propper` skill's status model) |
| Recipient | Recipient |
| `roleName` on a template signer | Template role, addressed as `roleName` in `templateRoles` |
| `routingOrder` | `order`, with agreement `type: "SEQUENTIAL"` |
| Tab | Annotation |
| Template | Sign template |
| DocuSign Gen template | Docgen template |

## Tabs to annotation types

| DocuSign tab | Propper `type` | Notes |
|---|---|---|
| `signHereTabs` | `SIGNATURE` | Direct |
| `initialHereTabs` | `INITIAL` | Direct |
| `dateSignedTabs` | `AUTO_FILL_DATE` | System-filled on signing, not signer-editable |
| `dateTabs` | `DATE` | Signer picks the date |
| `textTabs` | `TEXT` | Direct. `tabLabel` becomes `label` |
| `numberTabs` | `NUMBER` | Direct |
| `checkboxTabs` | `CHECKBOX` | Direct |
| `radioGroupTabs` | `RADIO` | Each radio becomes one annotation sharing a `groupName` |
| `listTabs` | `DROPDOWN` | `listItems` become `options[{ label, value }]` |
| `fullNameTabs` | `AUTO_FILL_NAME` | Direct |
| `emailTabs` | `AUTO_FILL_EMAIL` | Direct |
| `titleTabs` | `AUTO_FILL_TITLE` | Direct |
| `companyTabs` | `AUTO_FILL_COMPANY` | Direct |
| `formulaTabs` | `FORMULA` | Expression syntax differs; verify the result |
| `signerAttachmentTabs` | `ATTACHMENT` | Direct |
| `approveTabs` / `declineTabs` | — | No equivalent. Rebuild as a `CHECKBOX`, or handle by routing |
| `noteTabs` | — | No equivalent. Static note text belongs in the document |
| `envelopeIdTabs` | — | No equivalent |
| `smartSectionTabs` | — | No equivalent. Rebuild |
| `polyLineOverlayTabs` | — | No equivalent |

## Field-level differences

| Aspect | DocuSign | Propper |
|---|---|---|
| Page reference | `pageNumber`, 1-based, serialised as a string | `pageIndex`, 0-based integer |
| Coordinates | `xPosition` / `yPosition`, strings, top-left origin | `rect: { x, y, width, height }`, numbers, top-left origin |
| Size | `width` / `height`, strings | Inside `rect`, numbers |
| Required | `required: "true"` / `"false"`, literal strings | `isRequired`, boolean |
| Anchors | `anchorString`, `anchorXOffset`, `anchorYOffset`, `anchorUnits` | Same names, offsets always in PDF points — there is no `anchorUnits` |
| Anchor fallback | `anchorIgnoreIfNotPresent` | Same |
| Label | `tabLabel` | `label`, max 100 chars |
| Recipient binding | `recipientId` string within the envelope | `recipientId` uuid, re-bound on import |

DocuSign serialises booleans and numbers as strings. `import_template` converts them.
When constructing annotations by hand, use real numbers and real booleans.

`anchorUnits` of `pixels` or `inches` must be converted to points before use:
1 inch = 72 points; DocuSign pixels are 1/96 inch, so multiply by 0.75.

## Needs rebuilding

Report each of these by template and tab label, never as a bare count:

- **Conditional tabs** — `conditionalParentLabel` / `conditionalParentValue`. Show/hide
  logic does not transfer. Decide per field whether to always show it or split the
  template.
- **Tab groups and smart sections** — no equivalent.
- **Approve and decline tabs** — no equivalent. A decline is an agreement-level outcome
  in Propper, not a field.
- **Formula tabs** — the type maps but the expression syntax does not. Re-verify every
  computed value.
- **Payment tabs** — no equivalent.
- **Notarial and ID-verification flows** — out of scope for import.
- **Bulk send lists** — rebuild against a template created with `type: "BULK"`.
- **Connect / webhook configuration** — configured separately, not carried in the export.
- **Branding and custom email templates** — configured on the Propper organization.

## Gen template exports

`import_gen_template_from_source` takes the DocuSign Gen JSON with the source document
embedded at `documents[0].documentBase64`. Check that key exists first. The import is
idempotent on (`sourceSystem`, `sourceTemplateId`), so re-running updates in place.

DocuSign Gen merge placeholders and Propper's `{{fieldName}}` Handlebars syntax are not
identical. After import, run `preview_gen_template` with representative data and compare
the output against a DocuSign-generated sample before using the template for real.

## API-level migration

Existing DocuSign integrations can point at Propper's DocuSign-compatible proxy at
`https://api.propper.ai/restapi/v2.1` instead of rewriting against the native API. That is
an integration decision, outside the scope of a template import — mention it once if the
user has code calling DocuSign, and do not attempt the cutover as part of this skill.
