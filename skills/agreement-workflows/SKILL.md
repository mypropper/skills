---
name: agreement-workflows
description: Shared vocabulary for agreement work — recipient roles and signing order, the confirmation wording required before anything that emails a signer or destroys data, and the boundary between extracting facts and giving legal advice. Referenced by the other Propper skills; not invoked directly.
user-invocable: false
---

# Agreement workflows

Shared definitions for every Propper skill. Apply these; do not restate them to the user.

## Recipients

A recipient is a person who receives the agreement by email. Each carries:

| Field | Meaning |
|---|---|
| `name` | Full legal name as it should appear on the executed document |
| `email` | Where the signing link goes. Wrong here means the agreement goes to a stranger |
| `role` | A fixed enum, not a free-form label. See the values below; any other value is rejected |
| `order` | 0-based position, honoured only when the agreement `type` is `SEQUENTIAL` |

`role` accepts exactly these values, uppercase:

`SIGNER` · `CARBON_COPY` · `CERTIFIED_DELIVERY` · `IN_PERSON_SIGNER` · `AGENT` · `EDITOR` ·
`WITNESS` · `NOTARY` · `INTERMEDIARY` · `APPROVER` · `VIEWER`

There is no `Counterparty` and no `CC`. A counterparty signer is a `SIGNER`; a copy
recipient is `CARBON_COPY`. Mixed case is normalised (`Signer` becomes `SIGNER`). Describe
a party's function in `name`, not in `role`.

Roles in common use:

- **`SIGNER`** — applies a signature. Needs at least one `SIGNATURE` field. Use this for
  both your own signer and the counterparty's; they are distinguished by `order` and
  `name`, not by role.
- **`WITNESS`** — signs to attest, usually after the principal signer. Implies `SEQUENTIAL`.
- **`APPROVER`** — reviews internally before the counterparty sees it. Order 0.
- **`CARBON_COPY`** — receives the completed document, signs nothing. Assign no signature
  field. A `CARBON_COPY` cannot be the only recipient; the server rejects that.

On template-based creation the field is `roleName`, which is a free-form label that must
match a role already defined on the template — that is a different field from `role` and
is not constrained to the enum above. Read the template with `get_template` rather than
guessing.

## Signing order

`PARALLEL` emails everyone at once. Use it when the signers are independent.

`SEQUENTIAL` emails in `order`, each after the previous one completes. Use it when an
internal approver must clear the document before it reaches a counterparty, when a
witness must follow a principal, or when the user describes a chain.

When the user is silent and there is exactly one internal and one external signer, default
to `PARALLEL` and say so in the confirmation. When there are three or more parties, ask.

## Confirmation before irreversible actions

Required before `send_agreement`, `create_agreement` with `status: "SENT"`,
`gen_and_send_agreement`, `void_agreement` and `delete_agreement`.

Show a block in this shape, then wait for an explicit yes:

```
About to send "<agreement name>" for signature.

Documents
  1. <filename>

Signers (<PARALLEL | SEQUENTIAL>)
  1. <Name> <email@example.com> — <role>
  2. <Name> <email@example.com> — <role>

This emails all <n> recipients now. Send?
```

For a void:

```
About to void "<agreement name>" (<status>).

Reason: <reason>

All <n> recipients are emailed that it was cancelled. Signatures already collected are
discarded. This cannot be undone. Void?
```

For a draft delete:

```
About to delete the draft "<agreement name>". Nobody has been emailed. The draft and its
uploaded documents are removed permanently. Delete?
```

Rules:

- One approval covers one call. A changed recipient list, a changed document set or a
  second send needs a fresh confirmation.
- "Go ahead" earlier in the conversation does not pre-authorize a later send.
- Never fill in a missing email address by inference. Ask.
- Read the email addresses back verbatim in the confirmation. Do not summarize them as
  "the three signers".

## Not legal advice

Propper skills extract facts, place fields and route documents. They do not practise law.

Do:

- quote what a clause says, with its location
- flag a blank, an inconsistency, an unresolved placeholder, a missing exhibit
- name who appears to be expected to sign, based on the signature blocks present

Do not:

- say a document is safe, standard, fair, enforceable or ready to sign
- advise on whether a term should be accepted, or what to negotiate
- decide who has authority to bind an entity
- infer that a party consents because a document says so

When a user asks for a judgement of that kind, give them the facts the document supports
and say the call belongs to them or their counsel.
