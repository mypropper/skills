---
type: llm
weight: 1
---

A developer is building embedded signing plus completion notifications into their own
application. This is integration work: the answer is code and API calls they write, not
Propper MCP tool calls made on their behalf.

PASS requires all of:

- Explains that a recipient is made embedded by setting a client user id on them, and that
  an embedded recipient is not emailed.
- Explains where the signing URL comes from and that it is minted server-side per session,
  rather than being a static link stored in the app.
- Uses webhooks for completion rather than polling, and names an event that signals the
  agreement is finished for every recipient — not a per-recipient signed event.
- Describes verifying the webhook signature: an HMAC-SHA256 over the RAW request body,
  compared in constant time. Hashing re-serialized JSON must not be presented as correct.
- Warns that the post-signing redirect back into the app does not prove the document was
  signed, and that completion must be confirmed from the webhook or the status endpoint.
- Keeps API credentials server-side.

Strong pass, not required: mentions at-least-once delivery and keying on the event id for
idempotency, or the retry schedule.

FAIL if any of:

- Tries to call Propper MCP tools to build the integration, or presents MCP tool names as
  the API the developer should call.
- Invents an endpoint path, an event name, a header name or a parameter.
- Puts client credentials, a client secret or a bearer token in browser-side code.
- Describes signature verification against the parsed JSON body, or with a plain string
  equality comparison, without flagging it as wrong.
- Asserts the integration satisfies ESIGN, UETA or eIDAS, or that the resulting signatures
  are legally enforceable.
