# Error triage

Every Propper API response carries an `x-request-id` header, and error bodies repeat it as
`requestId`. Always quote it when reporting a failure the user has to escalate.

| Symptom | Cause | Action |
|---|---|---|
| `Missing required scope: <scope>` | Token lacks that OAuth scope | Name the scope, tell the user to re-consent granting it, stop. Do not retry. See [scopes.md](scopes.md) |
| 401 / authentication error | No token, expired token, revoked token | Re-probe with `get_current_user`. If it also fails, send the user through OAuth and stop |
| 403 on a tool whose scope you hold | Organization role or entitlement, not scope | Check `organization_get_entitlements`. Report the feature as unavailable to this account |
| 404 on an id that was just created | Wrong organization, or the record was deleted | Confirm the org with `get_current_user`. Do not re-create blindly |
| 400 / 409 on `upload_document`, `add_annotations`, `remove_recipient` | Agreement is no longer `CREATED` | Read `get_agreement_status`. Sent agreements are immutable |
| `send_agreement` rejects | Fewer than one recipient or fewer than one document | `list_recipients` and `list_documents`, fix the gap, re-confirm, resend |
| Annotation rejected | `rect` and anchor both missing, bad `pageIndex`, or over 100 tabs for one recipient | See the `place-signature-fields` skill |
| Anchor field silently absent from the signed document | `anchorString` not found and `anchorIgnoreIfNotPresent` was set | Verify the anchor text exists in the PDF before sending |
| 422 `GENERATION_KIND_NOT_SUPPORTED_HERE` | Template engine not enabled for this account, or wrong creation path | Use the documented path for that engine; report the entitlement gap |
| 429 | Rate limited | Back off once and retry. Do not loop |

## Reporting rules

- Report the failure and stop. Do not fall back to a different tool that has different
  side effects, and never substitute a send for a draft.
- One retry maximum for transient failures. Authentication, scope and state errors are
  not transient; do not retry them at all.
- Never invent an agreement id, recipient, template id or status to keep a flow moving.
  If a read failed, say the read failed.
