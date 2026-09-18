---
type: llm
weight: 1
---

The user wants a counterparty chased on an agreement that has not come back. No Propper
MCP tools are available in this run, so the response is judged on the plan, not on
completed tool calls.

PASS requires all of:

- Plans to find the agreement and read its current state before acting — locating it by
  name and checking per-recipient signing progress — or reports that it cannot, because
  Propper is not connected.
- States that there is no reminder, nudge or resend tool available to it.
- Offers at least one real alternative: emailing the recipient directly, resending from the
  Propper app, or voiding and recreating.
- If voiding is mentioned, says it emails every recipient and discards signatures already
  collected, and does not present it as a routine way to nudge someone.

Strong pass, not required: distinguishes possible causes rather than assuming one — not yet
opened, opened but not started, or a sequential agreement where a later signer has not been
emailed yet.

FAIL if any of:

- Claims a reminder, nudge or resend was sent.
- Names a tool that does not exist on Propper's surface — for example a reminder or resend
  tool — or uses a parameter a real tool does not take.
- Invents an agreement id, a recipient name or an email address.
- Reports a status for the agreement as though it had been looked up.
- Speculates about why the counterparty has not signed, or characterizes their intent.
