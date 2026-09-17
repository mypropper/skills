---
name: place-signature-fields
description: Work out where signature, initial, date and name fields belong on a document and emit correctly positioned annotations for them. Use when a PDF or DOCX has signature blocks but no fillable fields, when fields land in the wrong place, when a signer has nothing to sign, or when converting signature lines into anchor-based or coordinate-based tabs.
---

# Place signature fields

> **PREREQUISITE:** Use the `propper` skill for authentication, tool routing, and the
> agreement status model.

A document with a printed signature line has nothing for a signer to click. This skill
turns those blocks into annotations Propper renders as fields.

## Steps

### 1. Read the document

Extract the text with positions using whatever PDF tooling the environment has —
`pdftotext -bbox-layout`, `pdfplumber`, `pypdf`. Coordinates must come out in PDF points
with the origin at the top-left of the page, which is the convention Propper's `rect`
uses. If only plain text is available, use anchors rather than coordinates.

For DOCX, extract the text and use anchors. Do not guess coordinates for a document whose
layout reflows.

Record for each page: its index (0-based), width and height. Letter is 612 × 792 points;
A4 is 595 × 842.

### 2. Find the signature blocks

Look for, in rough order of reliability:

- a rule or row of underscores followed by a label — `Signature`, `By:`, `Authorized
  Signatory`, `Name:`, `Title:`, `Date:`
- `IN WITNESS WHEREOF` and the execution block that follows it
- a party name in caps above a blank line
- `Initials` or `_____ / _____` in a margin or footer

Count the parties. One execution block per party. If the document has two signature blocks
and the agreement has three recipients, say so before placing anything — that mismatch is
the most common cause of a document coming back unsigned.

### 3. Map blocks to recipients

Each block belongs to exactly one `recipientId`. Get the ids from `list_recipients`.

Match on the party name printed above the block, not on document order. When a block is
unlabelled, ask rather than assume.

Give every signer at least one `SIGNATURE`. Add `DATE` or `AUTO_FILL_DATE` where a date
line sits beside it, `AUTO_FILL_NAME` and `AUTO_FILL_TITLE` where `Name:` and `Title:`
lines follow, `INITIAL` on each page that carries an initials line. Assign nothing to a CC.

### 4. Build the annotations

Prefer anchors when the text is stable, coordinates when it is not. Both forms and the
full field reference are in [references/anchors.md](references/anchors.md).

Anchor form:

```json
{
  "recipientId": "<uuid>",
  "type": "SIGNATURE",
  "pageIndex": 2,
  "anchorString": "Authorized Signatory",
  "anchorXOffset": 0,
  "anchorYOffset": -28,
  "isRequired": true,
  "label": "Counterparty signature"
}
```

Coordinate form:

```json
{
  "recipientId": "<uuid>",
  "type": "SIGNATURE",
  "pageIndex": 2,
  "rect": { "x": 72, "y": 640, "width": 200, "height": 44 },
  "pageWidth": 612,
  "pageHeight": 792,
  "isRequired": true,
  "label": "Counterparty signature"
}
```

Default sizes in points: signature 200 × 44, initial 48 × 32, date 96 × 24, text 180 × 24,
checkbox 16 × 16.

### 5. Apply

```
add_annotations { id, annotations: [ ... ] }
```

`add_annotations` **replaces** every annotation on the agreement and only works while the
status is `CREATED`. Send the complete set for every recipient in one call. To add a
single field to a draft that already has fields, read the existing set first and resend it
whole.

Limit: 100 tabs per recipient.

### 6. Verify before sending

Report back, per recipient: how many fields, of what types, on which pages. Name any
signature block found in the document that no recipient was mapped to, and any recipient
who ended up with no signature field. Both are blocking problems; do not send past them.

## Checks that catch the common failures

- Every signer has ≥ 1 `SIGNATURE`. A signer with none receives a document they cannot
  complete.
- No field sits outside the page: `x + width ≤ pageWidth`, `y + height ≤ pageHeight`.
- No field overlaps printed text it would obscure.
- `pageIndex` is 0-based. A field intended for page 3 is `pageIndex: 2`.
- Every `anchorString` actually occurs in the extracted text, at the expected count. An
  anchor that appears twice places two fields.
- Fields sit below the signature rule, not on it. A negative `anchorYOffset` moves up the
  page; a positive one moves down.

## Boundary

Placing a field is a layout decision, not a legal one. Do not decide who is authorized to
sign, and do not add or remove a party's signature block because it looks wrong. Report
the mismatch and let the user decide.
