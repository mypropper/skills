---
name: track-agreements
description: Answer where an agreement stands and what to do about it — who has signed, who is holding it up, what is still outstanding across everything in flight, and how to cancel or retrieve a completed copy. Use when someone asks whether a document came back, who has not signed yet, what is waiting on a counterparty, for a sweep of open agreements, or to chase, cancel or download something already sent.
---

# Track agreements

> **PREREQUISITE:** Use the `propper` skill for authentication, tool routing, and the
> agreement status model. Use `agreement-workflows` for the confirmation wording before
> a void.

Everything here reads state except the void, which is irreversible and emails people.

## Steps

### 1. Authenticate

`get_current_user`. Report the organization. An agreement that "does not exist" is
usually an agreement in a different organization.

### 2. Find it

| The user has | Do |
|---|---|
| A name or fragment | `list_agreements { search }` |
| An id | `get_agreement { id }` |
| Neither — "what's outstanding?" | `list_agreements { status }` per in-flight status |

`list_agreements` takes `status`, `search`, `sortBy` (`createdAt`, `updatedAt`, `name`,
`status`), `sortOrder`, `page` and `limit` (max 100, default 20). Paginate rather than
reporting the first page as if it were everything.

Never present an agreement name or id that did not come back from a tool call.

### 3. Read the per-recipient detail

`get_agreement_status { id }` returns progress per recipient. That is what answers "who
has not signed" — the agreement-level status only says the agreement is unfinished, not
who is holding it.

### 4. Diagnose the stall

| Looks like | Actually means |
|---|---|
| `SENT`, nothing since | Emails went out. Nobody has opened it |
| `DELIVERED`, not moving | Opened, not started. The signer has seen it and stopped |
| `IN_PROGRESS` | At least one recipient has signed. Check which |
| `IN_PROGRESS` on a `SEQUENTIAL` agreement | Later recipients **have not been emailed yet**. They are not ignoring it; their turn has not come. Say so rather than reporting them as unresponsive |
| `DECLINED` | Terminal. A recipient refused. It cannot be restarted — a new agreement is the only path |
| `EXPIRED` | Terminal. The deadline passed |
| `CREATED` | Never sent. Nobody has been emailed at all |

The full table is in the `propper` skill's status model reference. Do not restate it to
the user; answer their question.

## The outstanding sweep

For "what is still in flight", query the in-flight statuses — `SENT`, `DELIVERED`,
`IN_PROGRESS` — sorted by `updatedAt` ascending, so the most stale surfaces first.

Report in three groups:

- **Moving** — touched in the last few days.
- **Stalled** — no movement in a week or more, with what the per-recipient detail says is
  blocking each one.
- **Terminal, needing attention** — `DECLINED` and `EXPIRED` from the same period. These
  are finished, and someone usually still thinks they are open.

Give counts and names. Do not estimate what a signer is likely to do next.

## There is no reminder tool

The MCP surface has no tool that re-sends, nudges or reminds. When a user asks to chase
someone, say that plainly and give them what does exist:

- Send the reminder yourself, outside Propper, to the address on the recipient record.
- Resend from the Propper app, which is where reminder settings live.
- Void and recreate — which emails **every** recipient that the original was cancelled,
  and discards signatures already collected. Rarely the right answer for a nudge.

Do not invent a tool name for this, and never report that a reminder was sent.

## Cancelling

`void_agreement` is the only way to stop a sent agreement. `delete_agreement` works only
on a `CREATED` draft.

`void_agreement` requires a `reason` as well as the `id` — it is not optional, and the
recipients are told the agreement was cancelled. Get the reason from the user rather than
composing one for them.

Show the void confirmation block from `agreement-workflows` — name, status, reason, the
fact that every recipient is emailed and collected signatures are discarded — then wait
for an explicit yes.

Note the scope asymmetry: `delete_agreement` needs only `sign:write`, but
`void_agreement` needs `sign:send`. A token that can delete drafts may be unable to
cancel anything already sent.

## Retrieving a completed copy

`list_documents { agreementId }` for the document ids, then `get_document_url {
agreementId, documentId }` for each. The URL is presigned and short-lived — hand it to
the user promptly rather than storing it, and re-issue it if they come back later.

The signing audit certificate is produced by Propper but has no MCP tool. Point the user
at the app or the API for it rather than implying you can fetch it.

## Failure handling

| Symptom | Cause and fix |
|---|---|
| `404` on an id the user supplied | Wrong organization, or the id is from another system. Confirm the org, then `list_agreements { search }` |
| Missing-scope error on void | `sign:send`, not `sign:write`. Name it and ask for re-consent |
| State error on void | Already terminal. Re-read the status; a `COMPLETED` or `DECLINED` agreement cannot be voided |
| Empty result for a name the user is sure of | It may be a draft. Query `CREATED` explicitly |

## Boundary

Reporting where an agreement stands is not advising on what to do about the delay. Do not
guess why someone has not signed, characterize a counterparty's intent, or advise on the
consequences of a missed deadline. Report the status, the dates and who is blocking; the
decision belongs to the user.
