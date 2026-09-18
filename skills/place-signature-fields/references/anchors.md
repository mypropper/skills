# Annotation reference

## Field object

Every entry in the `add_annotations` array. `type` and `pageIndex` are required, plus
either `rect` or `anchorString`.

| Field | Type | Notes |
|---|---|---|
| `recipientId` | uuid | Which recipient fills this field. Omit only for a field nobody fills |
| `type` | enum | See the type table below |
| `pageIndex` | integer | 0-based. Page 1 is `0` |
| `rect` | object | `{ x, y, width, height }` in PDF points, origin top-left |
| `pageWidth` | number | Reference page width the `rect` was measured against. Default 612 |
| `pageHeight` | number | Reference page height. Default 792 |
| `anchorString` | string | Text to locate in the document, max 255 chars. There is no occurrence selector: an anchor matching twice places two fields |
| `anchorXOffset` | number | Points right of the anchor. Negative moves left |
| `anchorYOffset` | number | Points down from the anchor. Negative moves up |
| `anchorIgnoreIfNotPresent` | boolean | Skip the field when the anchor is missing, instead of failing |
| `anchorCaseSensitive` | boolean | Case-sensitive anchor match. **Defaults to `true`** — set it `false` to match regardless of case |
| `anchorMatchWholeWord` | boolean | Whole-word anchor match |
| `isRequired` | boolean | Default true |
| `label` | string | Identification label, max 100 |
| `name` | string | Field name, max 100 |
| `placeholder` | string | Placeholder text, max 255 |
| `value` | string | Pre-filled value |
| `options` | array | `[{ label, value }]` for `DROPDOWN` and `RADIO` |
| `groupName` | string | Groups `RADIO` buttons, max 100 |
| `fontFamily` `fontSize` `fontColor` `bold` `italic` `underline` | — | Text rendering |

## Field types

| Type | Filled by | Use for |
|---|---|---|
| `SIGNATURE` | Signer | The signature line. At least one per signer |
| `INITIAL` | Signer | Per-page initials, margin initial blocks |
| `TEXT` | Signer | Free text the signer supplies |
| `DATE` | Signer | A date the signer picks |
| `NUMBER` | Signer | Numeric input |
| `CHECKBOX` | Signer | A single opt-in box |
| `RADIO` | Signer | One of a `groupName` set |
| `DROPDOWN` | Signer | One of `options` |
| `ATTACHMENT` | Signer | A file the signer must upload |
| `DRAW` | Signer | A freehand drawing |
| `AUTO_FILL_NAME` | System | Recipient's name. Use on `Name:` lines |
| `AUTO_FILL_EMAIL` | System | Recipient's email |
| `AUTO_FILL_DATE` | System | Date of signing. Use on `Date:` lines beside a signature |
| `AUTO_FILL_TITLE` | System | Recipient's title. Use on `Title:` lines |
| `AUTO_FILL_COMPANY` | System | Recipient's company |
| `FORMULA` | System | Computed from other fields |

Prefer `AUTO_FILL_DATE` over `DATE` for the date a document was executed: it cannot be
back-dated by the signer.

Types are uppercase when you *write* an annotation. Template reads (`get_template`,
`export_template`) return the same types lowercased (`signature`, `auto_fill_date`), and
use a 1-based `pageNumber` rather than the 0-based `pageIndex` you send. Do not copy a
template read straight back into `add_annotations`.

## Anchors versus coordinates

Anchor when the phrase is stable and unique — execution blocks, `Authorized Signatory`,
a party name. The field follows the text if the document is regenerated or repaginated.

Coordinates when the layout is fixed and the text is not extractable, when the anchor
phrase repeats, or when the field belongs in whitespace with no nearby text.

For an anchor field, a `rect` can supply its width and height; anchor resolution determines
the final position. Without a `rect`, the placeholder size is 20 × 5 points, so supply the
size you want explicitly.

## Anchor offsets

The anchor resolves to the position of the matched text. Offsets are applied from there, in
points, with `y` increasing downward.

| Intent | Offset |
|---|---|
| Field on the line above the anchor | `anchorYOffset: -28` |
| Field on the same line, to the right | `anchorXOffset: 120`, `anchorYOffset: 0` |
| Field on the line below the anchor | `anchorYOffset: 18` |
| Field over a rule under the anchor label | `anchorYOffset: -4` |

Start from these and adjust after looking at the rendered result. A signature that sits on
top of the printed rule rather than above it needs roughly 8 more points of negative `y`.

## Anchor phrases that work

| Block | Anchor | Type |
|---|---|---|
| `By: ______` | `By:` | `SIGNATURE`, x-offset past the label |
| `Name: ______` | `Name:` | `AUTO_FILL_NAME` |
| `Title: ______` | `Title:` | `AUTO_FILL_TITLE` |
| `Date: ______` | `Date:` | `AUTO_FILL_DATE` |
| `Authorized Signatory` | the phrase | `SIGNATURE` above it |
| `IN WITNESS WHEREOF` | the phrase | Locates the execution block; place by coordinate from there |
| Initials footer | `Initials:` | `INITIAL` |

`By:`, `Name:` and `Date:` usually occur once per party. Set `anchorMatchWholeWord` and
check the occurrence count in the extracted text before relying on them; two parties means
two matches, and the second one belongs to the other recipient.

## Geometry

- US Letter: 612 × 792 points. A4: 595 × 842. 1 inch = 72 points.
- Origin is the top-left corner. `y: 0` is the top of the page.
- Use finite, nonnegative positions and positive dimensions. The full rectangle must fit:
  `x + width <= pageWidth` and `y + height <= pageHeight`. The 0-based `pageIndex` must
  be below the document page count; invalid pages and bounds are rejected before writes.
- A one-inch bottom margin starts at `y: 720` on Letter.
- Suggested explicit sizes: signature 200 × 44, initial 48 × 32, date 96 × 24, text 180 × 24,
  checkbox 16 × 16.

## Limits

- 100 tabs per recipient.
- `add_annotations` replaces the entire set and belongs to the `CREATED` stage. Check the
  agreement's status before every call.
- There is no occurrence selector on an anchor. To give two parties fields at their own
  `By:` lines, use coordinates, or pick anchors unique to each party (the party name above
  the block), not the shared label.
- Set `anchorIgnoreIfNotPresent` only when the field is genuinely optional. On a signature
  field it turns a hard failure into a document that silently comes back unsigned.
