---
name: send-for-signature
description: Send a document out for electronic signature end to end — take a PDF or DOCX from disk, a template or generated content, confirm the signers and signing order, place the signature fields, and dispatch it. Use for any request to get something signed, sent for signature, out to a counterparty, or routed for approval and signature.
---

# Send for signature

> **PREREQUISITE:** Use the `propper` skill for authentication, tool routing, and the
> agreement status model. Use `agreement-workflows` for recipient roles and the
> confirmation wording.

Take a document from wherever it is to signatures requested, in one pass, with one
confirmation before anything is emailed.

## Steps

### 1. Authenticate

`get_current_user`. Report the organization. Stop on failure per the `propper` skill.

### 2. Locate the source

| The user has | Do |
|---|---|
| A file path | Read it. Confirm it is PDF or DOCX; those are the two accepted types |
| A named template | `list_templates` with `search`, then `get_template` to read its roles |
| Content to generate | `list_gen_templates`, then the generation path below |
| Nothing concrete | Ask which document. Do not invent one |

If the document is unsigned-off or looks like a draft, run `signature-ready-check` first
and report what it finds before going further.

### 3. Resolve signers

Collect a full name and email for every signer. Ask for anything missing; never infer an
address from a domain or a name.

Decide `PARALLEL` or `SEQUENTIAL` per `agreement-workflows`. State the choice.

### 4. Create the draft

Document-based, when the file is on disk:

```
create_agreement { name, type }
upload_document  { agreementId, document: <base64>, filename, mimeType }
add_recipient    { id, name, email, role, order }   // per signer
```

`mimeType` is `application/pdf` or
`application/vnd.openxmlformats-officedocument.wordprocessingml.document`.

Template-based, when a Sign template exists:

```
create_agreement { name, templateId, templateRoles: [{ roleName, name, email }], type }
```

`roleName` must match a role on the template. Read them with `get_template`.

Inline documents on `create_agreement` are capped at 10 documents, 25MB each before
encoding. Past that, create the draft first and `upload_document` each file.

Leave the status at `CREATED`. Do not set `status: "SENT"` at this step.

### 5. Place fields

Every signer needs at least one `SIGNATURE` field, or the document comes back unsigned.

Use the `place-signature-fields` skill to read the document and produce the annotations.
`add_annotations` replaces the whole set, so send every field for every recipient in one
call:

```
add_annotations { id, annotations: [ { recipientId, type, pageIndex, ... } ] }
```

Assign no signature field to a CC recipient.

### 6. Confirm

Show the confirmation block from `agreement-workflows`: agreement name, every document,
every recipient name and email verbatim, the signing order, and the fact that this emails
people now. Wait for an explicit yes.

### 7. Send

`send_agreement { id }`. Status moves `CREATED` → `SENT` and every recipient is emailed.

Report the agreement id, the recipients emailed and the order. Tell the user that
`get_agreement_status` shows per-recipient progress, and that a sent agreement can only be
stopped with `void_agreement`, which emails everyone again.

## Generate and send in one call

When the content comes from a document-generation template that already has a linked Sign
template, the whole flow collapses to:

```
gen_and_send_agreement {
  docgenTemplateId,
  recipients: [{ roleName, name, email }],
  data: { ... }
}
```

This creates, merges, and sends in one irreversible call. Confirm before it, not after.
Get the template id from `list_gen_templates`. Preview the merge with
`preview_gen_template` when the data is unfamiliar, so the user sees the wording before it
reaches a counterparty.

## Create-and-send in one call

`create_agreement` with inline `documents`, `recipients` and `status: "SENT"` also sends
immediately. Prefer the staged path above: it lets fields be placed and checked first.
Use create-and-send only when the document already carries its own signature anchors and
the user has confirmed.

## Failure handling

- `send_agreement` rejected — the draft has no recipient or no document. `list_recipients`
  and `list_documents`, fix, re-confirm, resend.
- A state error on upload or annotation — the agreement is already sent and immutable.
  Check `get_agreement_status`.
- Wrong recipient discovered after sending — `void_agreement` with a reason, then build a
  fresh draft. Both steps email people. Confirm both.
- Anything else — report with the `x-request-id` and stop. Do not retry a send.

## Boundary

Placing fields and routing a document is not a review of it. Do not tell the user the
agreement is fine to send. If they ask, give them what `signature-ready-check` found.
