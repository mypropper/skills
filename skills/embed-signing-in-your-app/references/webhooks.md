# Webhooks

## Events

| Event | Fires when |
|---|---|
| `document.created` | An agreement is created, before anything is sent |
| `document.sent` | Recipients have been emailed |
| `document.viewed` | A recipient opened it |
| `document.signed` | One recipient finished signing |
| `document.completed` | Every recipient has signed. Carries a `downloadUrl` |
| `document.declined` | A recipient refused. Terminal |
| `document.voided` | The sender cancelled. Terminal |
| `document.expired` | The deadline passed. Terminal |

`document.signed` fires once per recipient; `document.completed` fires once. An
integration that acts on `document.signed` in a multi-party agreement will act early.

## Envelope

```json
{
  "id": "evt_abc123",
  "type": "document.completed",
  "created": "2026-01-15T12:00:00Z",
  "data": { }
}
```

`id` is the idempotency key. `data` is event-specific.

## Verification

Header: `x-propper-signature: sha256=<hex-encoded-hmac>`

HMAC-SHA256 over the raw request body, keyed with the endpoint's signing secret.

```js
import crypto from 'node:crypto'

export function verify(rawBody, header, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')

  const a = Buffer.from(expected)
  const b = Buffer.from(header ?? '')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
```

Three rules:

1. Hash the **raw bytes**. Re-serializing parsed JSON changes key order and whitespace,
   and the signature will never match.
2. Compare in constant time. `===` on a signature leaks its value through timing.
3. Check the length before `timingSafeEqual` — it throws on mismatched lengths.

In Express, capture the raw body on the webhook route specifically:

```js
app.post('/webhooks/propper',
  express.raw({ type: 'application/json' }),
  (req, res) => { /* req.body is a Buffer */ })
```

A global `express.json()` mounted first consumes the stream and leaves nothing to verify.

## Retries

A delivery that times out or returns a non-2xx is retried on this schedule:

| Attempt | After |
|---|---|
| 1 | immediately |
| 2 | 1 minute |
| 3 | 5 minutes |
| 4 | 30 minutes |
| 5 | 2 hours |
| 6 | 8 hours |

After the sixth failure the delivery is marked failed and is not retried again.

Return 2xx as soon as the event is durably recorded, then process asynchronously. A
handler that does its work before responding turns a slow database into a lost event.

## Idempotency and ordering

Deliveries are at-least-once, so the same event can arrive more than once — store
processed event ids and drop repeats.

Order is not guaranteed. Do not derive state from the sequence of events; treat each one
as a signal to reconcile against `GET /v1/sign/agreements/{id}/status`, which is
authoritative.
