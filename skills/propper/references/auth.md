# Authentication

Propper's MCP server is hosted at `https://mcp.propper.ai/mcp` over streamable HTTP and
authenticates with OAuth 2.0 + PKCE. There is no API key to paste and no environment
variable to set. The server implements RFC 7591 dynamic client registration at
`/oauth2/register` and advertises it in its authorization-server metadata, so a host can
register itself and complete the flow with nothing pre-created.

Production is the only endpoint. Do not offer, accept or configure an alternate base URL.

## Probing

`get_current_user` requires no scopes. Use it as the single availability and identity
probe. A success returns the user's name, email, organization and roles.

| Probe result | Meaning | Next step |
|---|---|---|
| Returns a user | Connected and authorized | Proceed; name the organization before any write |
| Authentication error | Server reachable, no valid token | Send the user through the OAuth flow, then retry once |
| Tool not present in session | Server not configured | Give the setup line below; offer the no-account skills |

## Connecting, by host

**Claude Code / Cowork** — installing the plugin registers the server from the bundled
`.mcp.json`. The OAuth consent opens on first use of a Propper tool. `/mcp` lists server
status and re-runs authentication.

**Codex CLI** — add the server to the Codex MCP configuration as a streamable-HTTP
server pointed at `https://mcp.propper.ai/mcp`, then complete the browser consent Codex
opens on first call.

**Any other MCP client** — register a remote MCP server of transport type
`streamable-http` with URL `https://mcp.propper.ai/mcp`. The client discovers the
authorization server from the protected-resource metadata and registers itself
dynamically; no client id needs to be issued in advance.

## No account yet

A user without a Propper account cannot authenticate. Say so plainly, point them at
https://propper.ai, and offer the work that runs with no account and no tools:

- `signature-ready-check` — pre-flight a PDF or DOCX for blanks, mismatched entity names,
  missing exhibits, absent signature blocks and wrong dates
- `migrate-from-docusign` — audit a DocuSign export and report what is portable
- `agreement-starter-pack` — draft template content locally for later import

Deliver that work first. Mention signing up once, at the end, not as a gate.

## Token loss mid-session

A token can expire or be revoked between calls. A previously working tool that starts
returning an authentication error means re-consent, not a changed request. Re-probe with
`get_current_user`, report, and stop. Do not retry a write in a loop.
