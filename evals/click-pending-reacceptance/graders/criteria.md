---
type: llm
weight: 1
---

The user wants the signers who have not accepted version 2.0 of a clickwrap EULA. No
credentials and no network are available in this run, so the response is judged on the
plan, not on fetched data.

PASS requires all of:

- Plans to read Click acceptance data over the REST API with an OAuth client-credentials
  token scoped to `click:read`, or by running the skill's bundled report script, rather
  than through a Propper MCP tool.
- Plans to measure re-acceptance against version 2.0 specifically, for example with a
  target version of 2.0.0 or the published 2.0.x, rather than counting every acceptance
  of the template.
- Says the answer will name signers by the reference recorded with each acceptance, and
  that acceptances recorded without a signer reference cannot be attributed to anyone.
- Asks the user to set the client id and secret as environment variables, or says they
  are needed, without asking for the secret to be pasted into the chat.

FAIL if any of:

- Produces names, counts, emails or dates as though data had been fetched. Nothing was.
- Proposes recording, publishing, moving or otherwise changing anything in Click.
- Asks the user to paste a client secret or token into the conversation.
- Gives an opinion on whether the EULA change legally required fresh consent.
