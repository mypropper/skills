# Contributing

Thanks for helping improve the Propper plugin. This repo root **is** the plugin: skills
live in `skills/<name>/SKILL.md`, manifests in `.claude-plugin/`.

An agent skill covering all of this lives at
[`.agents/skills/contribute-propper-skill/`](.agents/skills/contribute-propper-skill/SKILL.md).
`.claude/skills` symlinks to `.agents/skills`, so Claude Code, Codex, Cursor, OpenCode and
anything else that reads `.agents/skills/` picks it up from a plain checkout with no setup.

## Setup

You need Node 20+ and the Claude Code CLI:

```bash
npm install -g @anthropic-ai/claude-code
```

Nothing else. There are no dependencies to install and no lockfile.

## Checks

Run all four before opening a PR. CI runs the same commands.

```bash
node scripts/check-repo.mjs                             # structural checks
claude plugin validate . --strict                       # marketplace manifest
claude plugin validate .claude-plugin/plugin.json --strict
claude plugin validate skills --strict                  # skill frontmatter
```

Zero warnings, or CI fails — `--strict` treats warnings as errors.

Changing a skill body or description? Run the evals too:

```bash
claude plugin eval --trust-plugin --no-publish --runs 2 -j 4 --judge-model sonnet
```

Use `--judge-model sonnet`. These graders check several conditions per case, which is
above what the default judge adjudicates reliably — the same skill output has scored 0.00
and 1.00 on consecutive default-judge runs. Individual cases still flake; treat a single
failing run as a signal to read the transcript, not as a regression.

Put the scores and the no-plugin baseline delta in the PR. A skill change with no eval
numbers will be asked for them.

## Adding a skill

1. Create `skills/<name>/SKILL.md`. The frontmatter `name` must match the directory.
2. Frontmatter is `name` and `description` only — plus `user-invocable: false` for a skill
   meant to be referenced rather than triggered.
3. Open with the prerequisite block when the skill needs Propper tools:

   ```markdown
   > **PREREQUISITE:** Use the `propper` skill for authentication, tool routing, and the
   > agreement status model.
   ```

4. Keep `SKILL.md` under 500 lines. Push mechanics into `references/*.md` and link them,
   so they load only when needed. Skill content persists in context across turns, so every
   line is an ongoing token cost.
5. Add at least one eval case.

The `description` decides whether the skill fires — it is the highest-leverage text in the
repo. Lead with the job, not the vendor, so it triggers on user intent rather than
requiring the word "Propper". `description` plus `when_to_use` is truncated at 1,536
characters.

## Rules

Enforced by `scripts/check-repo.mjs`:

- `SKILL.md` under 500 lines; frontmatter `name` matches the directory.
- **Bare tool names only.** Write `create_agreement`, never `mcp__propper__create_agreement`
  — every host namespaces MCP tools differently and applies its own prefix.
- Relative links resolve from a plain checkout.
- **Production endpoints only.** `https://mcp.propper.ai/mcp` and nothing else. No demo,
  staging, sandbox or localhost, and no `PROPPER_TOKEN` stdio path — a new installer does
  not have a token.
- No `documentation`, `support`, `privacy_policies`, `privacy_policy_url` or `terms_url`
  in `plugin.json`; they fail `--strict`. Those links go in the README.
- `plugin.json` name stays `propper` — the slug is immutable once published.
- JSON is 2-space indented with a trailing newline. No trailing whitespace anywhere.

Not machine-checkable, and just as binding:

- **Confirm before irreversible actions.** `send_agreement`, `create_agreement` with
  `status: "SENT"`, `gen_and_send_agreement`, `void_agreement` and `delete_agreement`
  email real people or destroy data. Any skill that reaches one must state a confirmation
  step showing the recipient list, document list and signing order first. Reuse the
  wording in `skills/agreement-workflows/SKILL.md`.
- **Not legal advice.** Skills extract facts, place fields and route documents. A person
  decides risk, materiality and authority. Never add guidance judging whether a contract
  is fair, enforceable or safe to sign.
- **No invented tool names, parameters or scopes.** The surface is the routing table in
  `skills/propper/SKILL.md` and the scope map in `skills/propper/references/scopes.md`.
  Verify anything new against the published API reference at https://docs.propper.ai/api
  before adding it.
- **Standing guidance, not narration.** State what to do, not why it matters.

## Eval cases

```
evals/<case-name>/
  prompt.md               frontmatter: max_turns, allowed_tools
  graders/skill-fired.md  type: tool_used — asserts the right skill triggered
  graders/criteria.md     type: llm — explicit PASS and FAIL conditions
```

Phrase the prompt the way a user would type it, and never name the skill in it. The case
is testing whether the description triggers.

**Inline any document the case needs.** Eval runs get a bare temporary working directory,
so a case referencing a fixture by path finds nothing and fails for the wrong reason. CI
rejects an `evals/<case>/files/` directory.

The default run withholds the Propper MCP server, so cases are scored on the plan and the
safeguards rather than on completed tool calls. Write criteria that judge the plan.
`--allow-real-servers` starts the live server and sends real email — never point it at a
real recipient.

Write grader conditions that can be checked one at a time: name the specific finding
expected, rather than asking the judge to count items against a list. Counting is where
these graders were least reliable.

## Pull requests

- Branch from `main` as `issue-<n>-<short-slug>`.
- One concern per PR.
- Say what you ran and what it returned. Paste eval scores including the baseline.
  "Should work" is not a result.
- Call out anything you changed that was not asked for, and why.

## Reporting a problem

Open an issue with the skill name, what you asked, what happened and what you expected.
If a Propper tool call failed, include the `x-request-id` from the error — it pins the
exact request.

Please do not file security issues as public GitHub issues. Email
[support@propper.ai](mailto:support@propper.ai).

## License

Contributions are licensed under Apache-2.0, matching [LICENSE](LICENSE).
