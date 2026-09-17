# Merge data

## Field types

A template declares its merge payload as a schema. Each field carries a key, a type and a
label.

| Type | Supply | Notes |
|---|---|---|
| `text` | String | Whitespace is preserved. Long values are not truncated for you |
| `number` | Number, not a numeric string | `"12"` and `12` are not interchangeable |
| `currency` | Number | Formatting belongs to the template, not the value. Do not pass `"$1,200.00"` |
| `date` | ISO 8601 string | Do not pre-format as `March 3, 2026`; the template decides how it renders |
| `boolean` | `true` / `false` | Not `"yes"`, not `1` |

## Collections

A collection is a typed repeating field — line items, schedules, payment milestones, any
list whose length is not known ahead of time. The template iterates it with
`{{#each name}} ... {{/each}}`.

Two rules decide whether generation succeeds:

1. The value must be an **array**, even when it has one item.
2. Every item must carry the fields the schema declares, at the declared types.

Either violation returns a `400` and nothing is generated.

An empty array is legitimate and renders nothing. Preview it — a template that reads
"the following items:" above an empty loop produces a document with a dangling sentence.

## Defaults

A template may carry default data, used for any field the caller omits. Defaults are
convenient and dangerous in the same way: an omitted `companyName` silently becomes
whichever company the template was built for.

Name every defaulted value when summarizing what was generated.

## Error codes

| Code | Meaning |
|---|---|
| `MERGE_DATA_MISSING` | A required field was absent from the payload |
| `TEMPLATE_NOT_FOUND` | No template with that id in this organization |
| `400` on generate | Schema violation — wrong type, or a collection that is not an array |

## Preview diagnostics

Preview returns `diagnostics[]` alongside the rendered output. Three kinds appear:

- **Unresolved merge token** — the template references a field the data did not supply.
  The output carries the literal `{{token}}`.
- **Unknown helper** — the template calls a helper that does not exist, usually a typo in
  `{{#each}}` or `{{#if}}`.
- **Malformed merge expression** — unbalanced braces or a broken block.

All three are authoring faults in the template, not data faults, except the first, which
can be either. Fix the data if the field belongs in the payload; fix the template with
`build-gen-template` if the field should not be there at all.

## Rate limits

| Operation | Limit |
|---|---|
| Document generation | 60 requests per minute |
| Template preview | 120 requests per minute |
| Downloads | 120 requests per minute |
| Everything else | 300 requests per minute |

A loop over rows hits the generation limit first. Pace it rather than retrying into a
`429`.
