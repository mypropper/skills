---
name: contribute-propper-skill
description: Add or change a skill in the mypropper/skills plugin and open a PR that passes CI. Use when working inside this repo — writing a new skill, editing an existing SKILL.md or reference, adding an eval case, touching a manifest, or preparing a pull request here.
---

# Contributing to mypropper/skills

Applies inside the `mypropper/skills` checkout. The repo root **is** the plugin: skills
live in `skills/<name>/SKILL.md` and the manifests sit in `.claude-plugin/`.

## Before you finish, run these

```bash
node scripts/check-repo.mjs            # structural checks — the same ones CI runs
claude plugin validate . --strict      # marketplace manifest
claude plugin validate .claude-plugin/plugin.json --strict
claude plugin validate skills --strict
```

All four must pass with zero warnings. CI runs the same commands on every PR.

For a change to a skill body or description, also run the evals:

```bash
claude plugin eval --trust-plugin --no-publish --runs 2 -j 4 --judge-model sonnet
```

Use `--judge-model sonnet`. These graders check several conditions per case, which is
above what the default judge adjudicates reliably. Record the score and the no-plugin
baseline delta in the PR. Do not claim a skill works without them.

## Adding a skill

1. `skills/<name>/SKILL.md`, where `<name>` matches the directory exactly.
2. Frontmatter is `name` and `description` only, plus `user-invocable: false` for a skill
   that exists to be referenced rather than triggered.
3. Open with the prerequisite block when the skill needs Propper tools:

   ```markdown
   > **PREREQUISITE:** Use the `propper` skill for authentication, tool routing, and the
   > agreement status model.
   ```

4. Add at least one eval case under `evals/`.

### The description is the trigger surface

It decides whether the skill fires. Lead with the job, not the vendor, so it triggers on
user intent rather than requiring the word "Propper". Name the situations that should
reach it. `description` plus `when_to_use` is truncated at 1,536 characters.

## Rules CI enforces

| Rule | Why |
|---|---|
| `SKILL.md` under 500 lines | Skill content persists in context across turns, so every line is an ongoing token cost. Push mechanics into `references/*.md` and link them |
| Frontmatter `name` matches the directory | The loader resolves skills by directory |
| Bare tool names only — never `mcp__propper__create_agreement` | Every host namespaces MCP tools differently. Skills say `create_agreement` and let the host apply its prefix |
| Relative links resolve | References load from a plain checkout, not just from an installed plugin |
| Production endpoints only | `https://mcp.propper.ai/mcp` and nothing else. No demo, staging, sandbox or localhost, and no `PROPPER_TOKEN` stdio path |
| No `documentation`, `support`, `privacy_policies`, `privacy_policy_url` or `terms_url` in `plugin.json` | They fail `claude plugin validate --strict`. Those links belong in the README |
| `plugin.json` name stays `propper` | The slug is immutable once published. Only `displayName` changes the UI label |
| JSON is 2-space indented with a trailing newline | Keeps diffs readable |
| No trailing whitespace | Same |

## Rules CI cannot check

**Confirm before irreversible actions.** `send_agreement`, `create_agreement` with
`status: "SENT"`, `gen_and_send_agreement`, `void_agreement` and `delete_agreement` email
real people or destroy data. Any skill that reaches one must state a confirmation step
showing the recipient list, document list and signing order first. Reuse the wording in
`skills/agreement-workflows/SKILL.md` rather than inventing a variant.

**Not legal advice.** Skills extract facts, place fields and route documents. A person
decides risk, materiality and authority. Never add guidance that judges whether a contract
is fair, enforceable or safe to sign.

**No invented tool names, parameters or scopes.** The full surface is the routing table in
`skills/propper/SKILL.md` and the scope map in `skills/propper/references/scopes.md`.
Verify anything new against the published API reference at https://docs.propper.ai/api
before adding it.

**Standing guidance, not narration.** State what to do, not why it matters.

## Eval cases

```
evals/<case-name>/
  prompt.md              frontmatter: max_turns, allowed_tools
  graders/skill-fired.md type: tool_used — asserts the right skill triggered
  graders/criteria.md    type: llm — explicit PASS and FAIL conditions
```

Phrase the prompt the way a user would type it, and never name the skill in it — the case
is testing whether the description triggers.

**Inline any document the case needs.** Eval runs get a bare temporary working directory,
so a case that references a fixture by path finds nothing and fails for the wrong reason.
CI rejects an `evals/<case>/files/` directory for this reason.

The default run withholds the Propper MCP server, so cases are scored on the plan and the
safeguards rather than on completed tool calls. Write criteria that judge the plan. Only
`--allow-real-servers` starts the live server, and that sends real email.

Write `criteria.md` as concrete conditions, not a vibe:

```markdown
PASS requires all of:
- <specific, checkable thing>

FAIL if any of:
- Claims something was sent when no tool call happened.
- Invents a tool name, parameter or agreement ID.
```

## Pull requests

- Branch from `main` as `issue-<n>-<short-slug>`.
- One concern per PR.
- Say in the body what you ran and what it returned. Paste the eval scores, including the
  no-plugin baseline. "Should work" is not a result.
- Flag anything you changed that the task did not ask for, and why.

## Repo map

| Path | What |
|---|---|
| `.claude-plugin/plugin.json` | Plugin manifest |
| `.claude-plugin/marketplace.json` | Marketplace manifest |
| `.mcp.json` | Hosted MCP server registration |
| `skills/` | The thirteen published skills |
| `evals/` | Eval suite |
| `scripts/check-repo.mjs` | Structural checks, run by CI |
| `AGENTS.md` | Entry point for agents that read AGENTS.md |
| `.agents/skills/` | Skills for contributors, not shipped in the plugin. `.claude/skills` symlinks here |
