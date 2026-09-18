# Agreement status model

```
CREATED ──send──> SENT ──> DELIVERED ──> IN_PROGRESS ──> COMPLETED
   │                │           │             │
   │                └───────────┴─────────────┴──> DECLINED | VOIDED | EXPIRED
   └──delete──> (gone)
```

| Status | Meaning | Documents | Recipients | Annotations | How it ends |
|---|---|---|---|---|---|
| `CREATED` | Draft. Nobody has been emailed. | Add, replace, remove | Add, update, remove | `add_annotations` works | `send_agreement`, or `delete_agreement` |
| `SENT` | Signing invitations dispatched. | Locked | Locked | Locked | `void_agreement` |
| `DELIVERED` | At least one recipient opened it. | Locked | Locked | Locked | `void_agreement` |
| `IN_PROGRESS` | At least one recipient signed, others outstanding. | Locked | Locked | Locked | `void_agreement` |
| `COMPLETED` | Every recipient signed. Terminal. | Locked | Locked | Locked | — |
| `DECLINED` | A recipient refused. Terminal. | Locked | Locked | Locked | — |
| `VOIDED` | Cancelled after sending. Terminal. | Locked | Locked | Locked | — |
| `EXPIRED` | Signing window lapsed. Terminal. | Locked | Locked | Locked | — |

## Rules that follow from the table

- `upload_document`, `remove_document`, `add_recipient`, `remove_recipient` and
  `delete_agreement` only work on `CREATED`. A state error from any of them means the
  agreement has already been sent.
- Place annotations while the agreement is `CREATED`. Other states return
  `AGREEMENT_NOT_EDITABLE` without changing the field set. Check the status before every
  call; to correct an agreement in flight, confirm voiding it and building a fresh draft.
- Drafts are deleted with `delete_agreement`. Sent agreements are cancelled with
  `void_agreement`, which requires a `reason` and notifies every recipient by email.
  Never reach for `delete_agreement` to undo a send; it will not work, and the correct
  action is externally visible.
- `add_annotations` replaces the entire annotation set on the agreement. To add one field
  to an existing draft, read the current annotations first and resend the full list. Keep
  the full list you sent — no tool reads annotations back, so if you do not retain it you
  cannot reconstruct the set.
- Correcting a sent agreement means: void it with a reason, create a fresh draft, and
  send again. Both the void and the resend email the recipients. Confirm both.

## Reading progress

`get_agreement_status` returns per-recipient signing progress, which is what to quote when
a user asks "who hasn't signed". `get_agreement` returns the agreement record.
`list_agreements` filters by status for roll-ups.
