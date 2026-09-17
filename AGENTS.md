# AGENTS.md

Propper agreement skills. This file is the entry point for any agent that reads
`AGENTS.md` — Codex, Cursor, Jules, Aider and others. Claude Code and Cowork load the same
skills through `.claude-plugin/plugin.json`; the content is identical either way.

## Installing these skills

```bash
npx skills add mypropper/skills
```

The open skills CLI installs `SKILL.md` files into the right directory for around 79
agents — pass `-a codex`, `-a cursor`, `-a opencode` and so on to target one, or `--list`
to see what is here without installing. Claude Code and Cowork can instead install the
whole plugin with `/plugin marketplace add mypropper/skills`.

## What is here

`skills/<name>/SKILL.md` — each a self-contained instruction file with YAML frontmatter
(`name`, `description`) and a CommonMark body. Deeper mechanics live in
`skills/<name>/references/*.md`, linked relatively from the skill, so they load only when
needed.

| Skill | Load it when |
|---|---|
| `skills/propper` | Any Propper task. Authentication, tool routing, status model, error triage. Read this first |
| `skills/agreement-workflows` | Shared definitions: recipient roles, confirmation wording, the not-legal-advice boundary |
| `skills/send-for-signature` | Getting a document signed end to end |
| `skills/place-signature-fields` | Working out where signature fields belong on a document |
| `skills/migrate-from-docusign` | Auditing or importing a DocuSign export |
| `skills/signature-ready-check` | Pre-flighting a contract before it goes out. Needs no Propper account |
| `skills/agreement-starter-pack` | Installing or using the nine bundled agreement templates |
| `skills/generate-document` | Merging data into a generation template and producing the document |
| `skills/build-gen-template` | Turning a document that gets rewritten each time into a reusable template |
| `skills/track-agreements` | Where an agreement stands after it was sent, and what can be done about it |
| `skills/compare-contract-versions` | Diffing two versions of an agreement. Needs no Propper account |
| `skills/extract-contract-dates` | Renewal, notice and termination deadlines as dates. Needs no account for local files |
| `skills/embed-signing-in-your-app` | Building signing into a product against the REST API. Calls no Propper tools |

## Tools

Propper's tools come from its MCP server at `https://mcp.propper.ai/mcp`
(transport `streamable-http`, OAuth 2.0 + PKCE with RFC 7591 dynamic client registration).
`.mcp.json` in this repo is the Claude Code form of that configuration; translate it to
your host's MCP config format.

Production is the only endpoint.

**Tool names are unprefixed in the skills.** Hosts namespace MCP tools differently —
`mcp__propper__create_agreement`, `propper.create_agreement`, `create_agreement`. Match on
the bare name the skills use and apply your host's prefix.

`get_current_user` requires no OAuth scopes. Use it as the availability and identity probe
before anything else.

## Rules that are not optional

1. **Confirm before irreversible actions.** `send_agreement`, `create_agreement` with
   `status: "SENT"`, `gen_and_send_agreement`, `void_agreement` and `delete_agreement`
   email real people or destroy data. Show the recipient list, the document list and the
   signing order, and wait for an explicit yes.
2. **Not legal advice.** These skills extract facts, place fields and route documents. A
   person decides risk, materiality and authority.
3. **No invented tools.** Use only the tool names in `skills/propper/SKILL.md`. If the
   task needs something not listed, say so.

## Working without an account

Six skills deliver value with no Propper account and no MCP server connected:
`signature-ready-check`, `compare-contract-versions`, `extract-contract-dates` (reading
local files), `embed-signing-in-your-app` (integration code, no tools at all),
`migrate-from-docusign` (the audit half) and `agreement-starter-pack` (drafting from the
bundled files). Run them directly.

## Changing anything in this repo

Load `.agents/skills/contribute-propper-skill/SKILL.md` first. It has the authoring rules,
the checks to run, and the PR conventions. `.claude/skills` symlinks to `.agents/skills`,
so the same copy serves both layouts. [CONTRIBUTING.md](CONTRIBUTING.md) is the prose
version.

Before you call a change done:

```bash
node scripts/check-repo.mjs
claude plugin validate . --strict
claude plugin validate .claude-plugin/plugin.json --strict
claude plugin validate skills --strict
```

## Repo conventions

- Every `SKILL.md` stays under ~500 lines. Mechanics go in `references/*.md`.
- Standing guidance, not narration: state what to do, not why.
- Plain YAML frontmatter and CommonMark only — no host-specific template variables,
  tool-call syntax or directives in skill bodies.
- Links between skill files are relative, so they resolve from a plain checkout.
- `evals/` holds the eval suite: one directory per case, each with `prompt.md` and
  `graders/*.md`. Prompts are self-contained — eval runs get a bare working directory, so
  any document a case needs is inlined in the prompt.
- `.agents/skills/` holds skills for people working on this repo. They are not part of the
  published plugin, which ships only `skills/`.
- `.agents/rules/` holds rules that apply to everything written in this repo, whoever or
  whatever writes it. `.claude/rules` symlinks to it. Read them before your first commit —
  [`public-repo.md`](.agents/rules/public-repo.md) governs how changes here are described,
  because this repository is public.
