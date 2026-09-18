---
name: embed-signing-in-your-app
description: Build e-signature into an application — authenticate against the API, create an agreement and place fields from code, let a user sign inside your own UI instead of leaving for email, and receive signed-and-completed events on a verified webhook endpoint. Use when someone is adding document signing to a product, wiring up a signing API or webhook listener, asks how to embed a signing ceremony, needs to know when a document completes, or is porting an existing DocuSign integration.
---

# Embed signing in your app

Integration work: code you write against the REST API, not tools called on the user's
behalf. This skill uses no Propper tools and needs no MCP connection — it needs API
credentials, which the user gets from their Propper organization.

For sending a document as a one-off task rather than as a feature, use
`send-for-signature`.

## The two hosts

| Host | Carries |
|---|---|
| `https://auth.propper.ai` | OAuth 2.0 and OIDC — `/oauth2/token`, `/oauth2/authorize`, `/.well-known/openid-configuration`, `/.well-known/jwks.json` |
| `https://api.propper.ai` | Everything else — Sign, Gen, Locker, Organization |

Bearer JWT on every API call. Never put credentials in client-side code: the token is
minted server-side and the browser only ever sees a signing URL.

## 1. Authenticate

Server-to-server integrations use the client credentials grant against
`POST https://auth.propper.ai/oauth2/token`, requesting the scopes the integration
actually needs — `sign:read`, `sign:write`, `sign:send` for a signing flow. Ask for
`sign:send` only if the service sends; a token that cannot send cannot accidentally send.

Integrations acting as a signed-in end user use the authorization code flow against
`/oauth2/authorize`, with `offline_access` if the session must outlive the access token.

Cache the token until shortly before it expires. Minting one per request will meet the
rate limit.

## 2. Create, populate and send

```
POST /v1/sign/agreements                       create the agreement
POST /v1/sign/agreements/{id}/recipients       add each recipient
PUT  /v1/sign/agreements/{id}/annotations      place the fields (replaces the whole set)
POST /v1/sign/agreements/{id}/send             dispatch
```

**Annotations is `PUT`, not `POST`.** Three of these four calls are `POST` and the fourth
is not; copying the pattern across produces a `405` that looks like a permissions problem.

The annotations endpoint **replaces** every annotation on the agreement. Send the
complete set for all recipients in one request; a second call with one field deletes the
rest.

Every recipient who signs needs at least one signature field, or the agreement completes
with nothing signed.

To send from an existing template instead, `POST /v1/sign/templates/{id}/send` does it in
one call. To generate the document and send it together,
`POST /v1/sign/gen-and-send`.

## 3. Embed the ceremony

Set `clientUserId` on a recipient — your own identifier for that user, unique within the
agreement. That makes the recipient **embedded**: they are not emailed, and you are
responsible for getting them to the signing UI.

The send response returns `signingUrls`, an array of `{ recipientId, url }` for the
embedded recipients. Load that URL in an iframe or redirect to it.

Two things to get right:

- **Mint the URL per session, server-side, when the user asks to sign.** It is short
  lived and it is a bearer credential for that person's signing ceremony. Do not store it,
  log it, or embed it in a page that gets cached.
- **Handle the return.** `embeddedRecipientStartURL` sets where the signer lands
  afterwards. Treat the return as "the ceremony ended", not "the document is signed" — a
  user who closes the tab also returns. Confirm completion from the webhook or the status
  endpoint, never from the redirect alone.

Integrations written against DocuSign's envelope API can use the compatible proxy at
`/restapi/v2.1/accounts/{accountId}/envelopes/{envelopeId}/views/recipient`, which returns
a recipient view URL and redirects to `returnUrl` with an `event` query parameter —
`signing_complete`, `decline`, `cancel`, `session_timeout`, `ttl_expired` or
`viewing_complete`. Port to the native endpoints when convenient; these exist so an
existing DocuSign integration can be moved without a rewrite. `migrate-from-docusign`
covers the template and envelope side.

## 4. Receive events

Poll nothing. `GET /v1/sign/agreements/{id}/status` exists for reconciliation, not for
finding out that something happened.

Eight events fire: `document.created`, `document.sent`, `document.viewed`,
`document.signed`, `document.completed`, `document.declined`, `document.voided`,
`document.expired`.

Verify every delivery before trusting it. The signature is in `x-propper-signature` as
`sha256=<hex>`, an HMAC-SHA256 of the **raw** request body:

```js
const expected = 'sha256=' + crypto
  .createHmac('sha256', process.env.PROPPER_WEBHOOK_SECRET)
  .update(rawBody)
  .digest('hex')

if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))) {
  return res.status(401).end()
}
```

Two failure modes account for most broken listeners: comparing against parsed JSON rather
than the raw body, and a body-parser that consumed the raw body before the handler saw it.
Capture the raw bytes on that route.

[references/webhooks.md](references/webhooks.md) has the payload envelope, the retry
schedule and the idempotency requirement.

## 5. Handle failure like an integration, not like a script

- **Retries.** Propper retries a non-2xx or timed-out delivery six times over about
  ten hours, then stops. Return 2xx as soon as the event is durably stored and do the work
  afterwards; slow handlers become failed deliveries.
- **Duplicates.** Deliveries are at-least-once. Key on the event `id` and make handlers
  idempotent.
- **Ordering.** Events are not guaranteed to arrive in order. A `document.completed` may
  land before a `document.signed`. Reconcile against the status endpoint rather than
  assuming a sequence.
- **Rate limits.** Back off on `429` rather than retrying immediately.
- **Correlation.** Every response carries `X-Request-Id`, the same id as the trace-id in
  `traceparent`. Log it on both success and failure — it is what support needs to find the
  exact request.

## Boundary

Building a signing integration is engineering, not legal compliance work. Do not advise
whether an implementation satisfies ESIGN, UETA or eIDAS, whether captured evidence is
sufficient, or whether a signing flow is enforceable. Point at Propper's compliance
documentation and leave the assessment to the user's counsel.
