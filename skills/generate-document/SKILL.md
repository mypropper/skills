---
name: generate-document
description: Produce a finished document from a reusable template and a set of values — fill a contract, offer letter, invoice, statement of work or report, check the merged wording before it is committed, and turn a list of rows into one document each. Use when someone wants a document built from a template plus data, asks to fill in, populate or merge a template, has a spreadsheet or list of values that should become documents, or wants the same paperwork produced for many customers.
---

# Generate a document

> **PREREQUISITE:** Use the `propper` skill for authentication, tool routing, and the
> agreement status model.

Merge data into a saved template and get a document out. The discipline that matters is
previewing before generating: preview names the tokens that did not resolve, costs no
quota, and stores nothing.

To build the template in the first place, use `build-gen-template`. To route the result
for signature, use `send-for-signature`.

## Never write the document instead

If the template cannot be read — Propper is not connected, the organization has none, or
the user cannot say which one — **stop and say so. Do not draft the document yourself.**

This holds even when the request is urgent, even when the user has supplied enough facts
to write something plausible, and even when refusing feels unhelpful. A freehand draft with
`[PLACEHOLDER]` markers is the failure mode this skill exists to prevent: it looks like the
deliverable, it carries none of the organization's approved wording, and the real values
the user supplied end up embedded in text nobody has ever signed off. Handing that to
someone who asked for "our standard letter" is worse than handing them nothing.

Say which of the three is missing, and offer the real paths: connect Propper so the
template can be read, or use `build-gen-template` if they have a source document to turn
into one. Then stop.

## Steps

### 1. Authenticate

`get_current_user`. Report the organization. Stop on failure per the `propper` skill.

### 2. Find the template

| The user has | Do |
|---|---|
| A template name | `list_gen_templates` with `search`, then `get_gen_template` |
| A template id | `get_gen_template` |
| Neither, but a document they keep reusing | `build-gen-template` first |
| Nothing concrete | List what exists and ask. Do not guess at a template |

Read the template's declared schema and default data before touching the user's values.
Never infer field names from the document text.


### 3. Map the data onto the schema

Keys must match the schema. Work through it field by field:

- **Required field with no value** — ask. Never invent a name, date, amount or address,
  and never carry one over from an example in the template.
- **Field the schema does not declare** — it will not merge. Say so rather than sending
  it and hoping.
- **Collection** — must be an array, and every item must carry the declared fields at
  the declared types. A mismatch fails the whole generation with a `400`.
- **Default applied** — when the template's default data supplies a value the user did
  not, name that value in your summary. A silent default is how the wrong entity name
  reaches a counterparty.

[references/merge-data.md](references/merge-data.md) has the type rules and the error
codes.

### 4. Preview before you generate

```
preview_gen_template { id, data }
```

Preview renders the template without creating a document. It stores nothing and consumes
no generation quota, so there is no reason to skip it when the data is new.

Read the `diagnostics[]` it returns. They name unresolved merge tokens, unknown helpers
and malformed merge expressions. **Empty diagnostics is the only clean result** — a
render that looks fine but reports an unresolved token will ship with a literal
`{{placeholder}}` in it.

The response shape depends on the template's source format:

- **Word templates** render to a short-lived `previewUrl` plus `expiresAt`. Fetch it
  before it expires; call preview again for a fresh one.
- **HTML and Markdown templates** render to sanitized `html` plus a `csp` object.

Preview requires the standalone `docgen:preview` scope. It is **not** implied by
`docgen:read`, `docgen:write` or `docgen:admin` — a token that can generate documents may
still be unable to preview them. On a scope error, name `docgen:preview` and ask for
re-consent rather than skipping ahead to generation.

Show the user the merged wording, or the unresolved tokens, before going further.

### 5. Generate

```
generate_gen_document { templateId, data, name, outputFormat }
```

`outputFormat` is `PDF` or `HTML`; the server default applies if omitted. Choose `PDF`
for anything that will be signed or sent outside the organization.

### 6. Poll, then retrieve

`get_gen_document { id }` until the record leaves its in-progress state.

The terminal success state is spelled `COMPLETED` in the MCP tool and `GENERATED` in the
Gen API reference. Branch on the status field the response actually carries, treat either
spelling as ready and `FAILED` as failed, and do not hardcode one of them.

The binary body does not come back through MCP. Report the document id and tell the user
where to retrieve the file.

## Many documents from one list

There is no batch tool on the MCP surface. The API has batch endpoints; the tools do not,
so this is a loop over `generate_gen_document` — one call per row.

- Validate every row against the schema **before** generating any of them, and report the
  bad rows. Do not start a partial run and discover row 40 is malformed.
- Preview the first row only. The rest share its shape.
- Generation is rate limited at 60 requests per minute. Pace the loop.
- Report each row's outcome — the generated id, or the error. Never silently skip a row.
- For more than a handful, state the count and the template and get a yes before starting.

## Sending what you generated

Generating and sending are separate acts. Once a document exists, `send-for-signature`
takes it the rest of the way.

`gen_and_send_agreement` collapses both into one irreversible call. It needs a docgen
template with a **linked Sign template**, which only `import_gen_template_from_source`
produces — a template created with `create_gen_template` has no link and the call will
fail. Confirm before it, per `agreement-workflows`, never after.

## Failure handling

| Symptom | Cause and fix |
|---|---|
| `400` on generate | A collection is not an array, or an item's types do not match the schema. Re-read the schema, fix the row |
| `MERGE_DATA_MISSING` | A required field was not supplied. Ask the user for it |
| `TEMPLATE_NOT_FOUND` | Wrong id, or the right id in a different organization. Re-list |
| Missing-scope error on preview | `docgen:preview` is standalone. Name it and ask for re-consent |
| Literal `{{field}}` in the output | Preview was skipped, or its diagnostics were ignored |
| Status never leaves generating | Report the document id and the `x-request-id`. Do not re-generate — that makes a second document |

## Boundary

Filling a template is not reviewing what it says. Do not tell the user the generated
document is correct, complete or safe to send. If they ask, run `signature-ready-check`
and give them what it found.

The same applies to the values being merged. Do not comment on whether a salary, fee,
discount, start date or deadline is appropriate, competitive, generous or tight. Merge
what was given, name what is missing, and stop there — the user did not ask for a view on
their own numbers.
