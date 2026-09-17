# Propper

Create, send, and track agreements for e-signature — from your coding agent.

Supports **Claude Code**, **Codex**, **Cursor**, **OpenCode**, and [75 more](#other-agents).

Describe what you need signed and by whom. Propper generates the document from a template,
places the signature fields, routes it to the right people in the right order, and tracks
it to completion. Seven skills cover the whole path from an unsigned draft to a completed
agreement.

Three of them work before you have a Propper account at all.

---

## Install

### Claude Code and Cowork

```
/plugin marketplace add mypropper/skills
/plugin install propper@propper-marketplace
```

Once the plugin is in Anthropic's community catalog:

```
/plugin install propper@claude-community
```

Installing registers Propper's MCP server. The first Propper tool call opens an OAuth
consent in your browser — no API key, no token to paste, no environment variable. Run
`/mcp` any time to check the connection or re-authenticate.

### Other agents

The skills are plain `SKILL.md` files, so the open skills CLI installs them anywhere:

```bash
npx skills add mypropper/skills
```

```bash
# pick specific skills
npx skills add mypropper/skills --skill send-for-signature --skill signature-ready-check

# target specific agents
npx skills add mypropper/skills -a codex -a cursor

# install everything, globally, no prompts
npx skills add mypropper/skills --all -g -y

# see what is in the repo without installing
npx skills add mypropper/skills --list
```

That installs the instructions. To give the agent the tools as well, register Propper's
MCP server with your host:

| Setting | Value |
|---|---|
| Transport | `streamable-http` |
| URL | `https://mcp.propper.ai/mcp` |
| Auth | OAuth 2.0 + PKCE, RFC 7591 dynamic client registration |

No client id to create and no token to paste — a compliant client registers itself.
[`.mcp.json`](.mcp.json) in this repo is the same configuration in Claude Code's format.
[AGENTS.md](AGENTS.md) is the entry point for agents that read it.

Production is the only endpoint.

### Without the tools

`signature-ready-check`, the audit half of `migrate-from-docusign`, and drafting from
`agreement-starter-pack` call no Propper tools at all. Install the skills and use those
today; connect an account when you want to actually send something.

---

## Skills

| Skill | What it does | Try |
|---|---|---|
| **propper** | Foundation. Authentication, tool routing, the agreement status model, and scope and permission error triage. Loads on any Propper task | `who am I in Propper?` |
| **send-for-signature** | Document to signatures requested, end to end — confirm the signers and order, place the fields, send | `send this NDA to jane@acme.com for signature` |
| **place-signature-fields** | Reads a document, finds the signature, initial and date blocks, and emits correctly positioned fields | `this PDF has signature lines but no fields — fix it` |
| **migrate-from-docusign** | Audits a DocuSign export and reports exactly what carries over and what needs rebuilding, then imports it | `what would carry over from these DocuSign templates?` |
| **signature-ready-check** | Pre-flights a contract: blanks, entity-name mismatches, missing exhibits, absent signature blocks, wrong dates | `check this contract before I send it` |
| **agreement-starter-pack** | Installs nine ready agreement templates — NDAs, contractor, consulting, SOW, MSA, offer letter, waiver, release | `set me up with a standard mutual NDA` |
| **agreement-workflows** | Shared definitions the other skills build on: recipient roles, confirmation wording, the not-legal-advice boundary | — |

---

## The starter pack

Nine templates, each shipping both a document-generation template with a merge schema and
the matching Sign template with its role slots and field placements:

Mutual NDA · Unilateral NDA · Independent Contractor Agreement · Consulting Agreement ·
Statement of Work · Master Services Agreement · Employment Offer Letter · Waiver and
Assumption of Risk · Mutual Release and Settlement Agreement

They are starting points, not vetted instruments. Have counsel review one before it goes
to a real counterparty.

---

## Authentication and scopes

The server implements RFC 7591 dynamic client registration at `/oauth2/register` and
advertises it in its authorization-server metadata, so any compliant client can register
itself without a pre-issued client id.

Scopes requested for ordinary agreement work:

| Scope | Grants |
|---|---|
| `openid` | User identity |
| `offline_access` | Refresh tokens |
| `sign:read` | Read agreements, templates, documents, signing status |
| `sign:write` | Create and modify agreements, recipients, documents, templates; delete drafts |
| `sign:send` | Send agreements for signing, and void agreements in flight |
| `org:read` | Read the organization profile |
| `users:read` | Read organization members and roles |
| `locker:read` | Read documents, extracted risks and settings in Locker |

The starter pack additionally needs `docgen:read` and `docgen:write` to create and
generate from document-generation templates. Full per-tool mapping in
[skills/propper/references/scopes.md](skills/propper/references/scopes.md).

---

## Sending is confirmed, always

`send_agreement`, `create_agreement` with `status: "SENT"`, `gen_and_send_agreement`,
`void_agreement` and `delete_agreement` either email real people or destroy data. Every
skill that reaches them shows you the recipient list, the document list and the signing
order, and waits for an explicit yes. An approval covers one call — change the recipients
and you are asked again.

Drafts can be deleted. Sent agreements can only be voided, which emails everyone that the
agreement was cancelled.

---

## Not legal advice

These skills extract facts, place fields and route documents. They do not practise law.

They will tell you a clause is blank, an entity name is inconsistent, an exhibit is
referenced but missing, or a date contradicts the stated term — with the page and the
quoted text. They will not tell you whether a contract is fair, enforceable, market
standard or safe to sign, and they will not decide who has authority to bind a company.
Those judgements are yours and your counsel's.

The bundled templates are generic, are not tailored to any jurisdiction or transaction,
and carry that notice on their face.

---

## Other agents

`npx skills add` installs to any agent the open skills CLI supports — Claude Code, Codex,
Cursor, OpenCode, Gemini CLI, GitHub Copilot, Goose, Zed, Cline, Droid, Warp, Amp,
Continue, Kiro, Qwen Code, Roo Code and around sixty more. Run
`npx skills add mypropper/skills` and pick, or pass `-a <agent>` to target one.

Whatever the host, the skills are the same Markdown and the tools are the same MCP server.

---

## Links

- Propper — https://propper.ai
- Documentation — https://docs.propper.ai
- Support — https://propper.ai/contact
- Privacy policy — https://propper.ai/privacy-policy
- Terms of service — https://propper.ai/terms-of-service
- API reference — https://docs.propper.ai/api

---

## Development

```bash
node scripts/check-repo.mjs          # structural checks, also run by CI
claude plugin validate . --strict    # manifests and skill frontmatter
claude plugin eval --judge-model sonnet --runs 2   # eval suite + no-plugin baseline
claude --plugin-dir .                # load the plugin from a checkout
```

[CONTRIBUTING.md](CONTRIBUTING.md) has the full rules. A contributor skill covering the
same ground lives in [`.agents/skills/`](.agents/skills/contribute-propper-skill/SKILL.md),
with `.claude/skills` symlinked to it — open this repo in any agent and it loads.

Eval cases live in [evals/](evals/), one directory per case with a `prompt.md` and
`graders/*.md`. Each case pairs a `skill-fired` grader, which checks the right skill
triggered, with a `criteria` grader written as explicit PASS and FAIL conditions.

Prompts are self-contained: any document a case needs is inlined in the prompt body. Eval
runs get a bare temporary working directory, so a case that references a fixture by path
finds nothing there and fails for the wrong reason.

The default run withholds the Propper MCP server, so cases are scored on the plan and the
safeguards rather than on completed tool calls. Pass `--allow-real-servers` to run against
the live server — that sends real email, so do not point it at real recipients.

Pass `--judge-model sonnet`: these graders check several conditions per case, which is
above what the default judge adjudicates reliably.

## License

Apache-2.0. See [LICENSE](LICENSE).
