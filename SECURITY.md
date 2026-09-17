# Security policy

## Reporting a vulnerability

Report security issues privately to **security@propper.ai**. Our full policy, and the
current contact details, are published at
[propper.ai/security-policy](https://propper.ai/security-policy) and
[`/.well-known/security.txt`](https://propper.ai/.well-known/security.txt).

Please do **not** open a public issue, pull request or discussion for a suspected
vulnerability. That includes anything affecting the Propper MCP server, the OAuth flow, or
an account reachable through them.

Include what you need to make the report actionable:

- what the issue is, and the impact you believe it has
- the steps to reproduce it
- affected versions, endpoints or skills
- any proof-of-concept you are willing to share

Please do not include real customer data, real agreement content, access tokens, or
credentials in the report. Redact them, or describe them instead.

## What to expect

We aim to acknowledge a report within three business days and to keep you updated while we
investigate. We will tell you when a fix ships, and we are glad to credit you in the release
notes unless you would rather stay anonymous.

## Scope

This repository holds agent skills — Markdown instructions and template JSON — plus the
plugin manifests. It contains no server code and no credentials.

Things worth reporting here:

- a skill that instructs an agent to disclose credentials, send data to an unintended
  recipient, or take a destructive action without confirmation
- a template that leaks data between merge contexts
- a supply-chain concern in how the plugin or its manifests are published or installed

Issues in the Propper platform, the MCP server at `mcp.propper.ai`, or the web application
belong at the same address, and are handled under the policy linked above.

## Testing safely

The skills in this repository send real email and create real agreements when pointed at a
live account. Please test against an account you control, use addresses you own, and never
use a real counterparty's details. `claude plugin eval` withholds the MCP server by default
for exactly this reason — `--allow-real-servers` opts back in, so use it deliberately.
