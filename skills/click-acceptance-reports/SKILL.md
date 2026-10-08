---
name: click-acceptance-reports
description: Report on clickwrap and terms acceptances recorded with Propper Click, covering who accepted which template and version, who still has to re-accept after a major update, whether the signed evidence behind each acceptance verifies, and how acceptances trend over time, as a polished HTML report plus a Markdown summary built from live data. Use when someone asks who has or has not accepted a version of their terms, EULA, privacy policy or other clickwrap, wants acceptance counts by version, needs to prove or audit acceptance evidence or receipts, or wants an acceptance report for legal, compliance or a customer review. Read-only.
---

# Click acceptance reports

Click records each acceptance of a published template version with a signed receipt.
This skill reads those records over the Click REST API and builds four reports from them:

1. **Acceptances by template and version**: counts, signers, first and last acceptance,
   consent methods.
2. **Re-acceptance after a major**: per deployment, who accepted an earlier major but not
   the one it serves now.
3. **Evidence integrity**: receipts re-verified, with every check result and any failure.
4. **Trend**: acceptances over time, stacked by template and version.

Click is not on the Propper MCP server. Everything here goes through
`https://api.propper.ai/v1/click` with an OAuth client-credentials token, using the
bundled script `scripts/click-report.mjs` (Node 20 or later, no dependencies).

## Rules

- **Read-only.** Never record an acceptance, publish, move, roll back, archive or change
  anything. Every call is a `GET`, except the signer-status lookup, which is a read that
  carries the signer reference in a `POST` body. Asked to change something, say this
  skill only reads, and point to the Click app.
- **Secrets stay out of the conversation.** Never print, echo, log, write to a file or
  repeat `PROPPER_CLIENT_SECRET` or an access token, and never ask the user to paste a
  secret into the chat. If one is pasted, do not repeat it, and recommend rotating it.
- **Real numbers only.** Every count, name, version and date in an answer or a report
  comes from the script's output. Never fill a gap with an estimate. A missing value is a
  data limit, stated as one.
- **Not legal advice.** Report what was accepted, when, and whether the evidence
  verifies. Do not judge whether a consent flow is enforceable or sufficient.

## 1. Credentials

The script reads two environment variables:

| Variable | Value |
|---|---|
| `PROPPER_CLIENT_ID` | Client id of an OAuth client in the user's Propper organization |
| `PROPPER_CLIENT_SECRET` | Its secret |

The client needs `click:read` and nothing else. An organization admin creates one under
**Organization Settings → OAuth Clients** (https://app.propper.ai/organization/settings/oauth-clients).

Check presence without printing values:

```bash
node --version
test -n "$PROPPER_CLIENT_ID" && test -n "$PROPPER_CLIENT_SECRET" && echo "credentials set"
```

When either is missing, ask the user to export both in their own terminal, then continue.
A token error names the HTTP status and the OAuth error code; report it and stop rather
than retrying with guessed values.

## 2. Find the template

```bash
node <skill-dir>/scripts/click-report.mjs templates
```

`<skill-dir>` is the directory this `SKILL.md` is in. The output lists each template with
its published versions and what each deployment serves. Match the user's wording to a
template name. When more than one could match ("the terms of use"), list the candidates
and ask; do not pick one.

## 3. Collect and build

```bash
node <skill-dir>/scripts/click-report.mjs collect --template "<exact name or id>" \
  [--since 7d|<ISO date>] [--until <ISO date>] [--verify sample|all|none] [--sample 25] \
  [--target-version <x.y.z>] [--confirm-signers] [--out <dir>] [--title "<title>"] [--redact]
```

Map the question to flags:

| The user asks | Flags |
|---|---|
| Acceptances by version for a template | `--template "<name>"` |
| Who has not accepted version X | `--template "<name>" --target-version X --confirm-signers` |
| Verify the evidence for a period | `--since <start> [--until <end>] --verify all` |
| An overall acceptance report | no `--template` (every template), default sample verification |
| A copy to share outside the team | add `--redact` |

- `--template` repeats for several templates. Omit it for all of them.
- `--since` takes `7d`, `24h`, `2w` or an ISO date or date-time. `--until` is exclusive,
  except that a bare date includes that whole day. Resolve phrases like "last week" to
  explicit dates and say which dates were used.
- `--verify sample` (the default) re-verifies an evenly spaced sample of `--sample`
  receipts across the window; `all` verifies every one. Use `all` when the user asks to
  verify, prove or audit evidence.
- `--target-version` measures re-acceptance against that version's major instead of the
  major each deployment serves. Use it when the user names a version.
- `--confirm-signers` asks the signer-status endpoint about each signer the report
  finds still on an earlier major (up to 50 per deployment), and shows its answer beside
  the computed one.

The script writes to `--out` (default `./click-acceptance-report`):

| File | Holds |
|---|---|
| `report.html` | The self-contained report: no external assets, light and dark, printable |
| `report.md` | The same findings as Markdown, for a message, ticket or document |
| `summary.json` | Every number in both reports |
| `dataset.json` | The normalized acceptances behind them, including signer references |

`dataset.json` holds signer references, which are often email addresses. Keep it local.
For a copy that leaves the team, re-run with `--redact`, which replaces each signer
reference with a stable pseudonym. To rebuild the reports from an existing dataset with a
new title or redaction, without calling the API again:

```bash
node <skill-dir>/scripts/click-report.mjs render --data <dir>/dataset.json --out <dir> [--title ...] [--redact]
```

## 4. Answer

Read the script's stdout summary and `report.md`, then answer the question asked, first,
in plain sentences:

- **"Who hasn't accepted 2.0?"** Give the count, then the signers by reference with the
  version they last accepted and when, per deployment. If the deployment serves a
  different version from the one asked about, say so.
- **"Acceptances by version"**: the per-version table, with first and last dates.
- **"Verify the evidence"**: how many receipts were checked, how many are valid, each
  failure with its receipt id and failing check. A check reported `not_issued` is a proof
  the platform does not issue yet; it does not make a receipt invalid.

Then give the paths to `report.html` and `report.md`, and repeat every data limit the
script lists. Never drop one to make an answer tidier. Report what the data shows; do
not guess why it looks the way it does. When a window is empty, say so and offer the
window where acceptances exist.

The limits to expect, and what they mean:

| Limit | Meaning |
|---|---|
| Signer not recorded for acceptances before a date | Those acceptances count in totals, but cannot be named in a re-acceptance list |
| No acceptance through a deployment carries a signer | The re-acceptance question cannot be answered by name for it; give the per-version counts instead |
| Version read from the signed receipt | The list row lacked the version; the receipt supplied it |
| Every acceptance reports one consent method | The method breakdown has a single value; do not infer how people consented |
| Verified a sample | Results describe the sample, not every receipt |

## When the script cannot run here

Without a shell, or without network access, do not hand the run to another agent and do
not reconstruct numbers. Give the user the commands to run in their own terminal, with
the template, the target version, the window and the `--verify` mode already filled in
from their question. Then say what the report will show, name the data limits to expect
(acceptances with no recorded signer, a verification sample rather than every receipt),
and ask for `report.md` or the script's output back.

When the user pastes exported API responses instead, apply the same rules by hand:
version and signer from the row, then the receipt; re-acceptance per deployment and
environment; every unattributable acceptance counted and stated in its own line, never as
a row among the named signers. Write `report.html`
(self-contained: no external scripts, stylesheets or fonts) and `report.md` with the
same sections and data limits.

If the user needs a reading the script does not produce, use
[references/click-api.md](references/click-api.md) for the endpoints, fields and
pagination, and keep every call read-only.

## Failure handling

| Symptom | Do |
|---|---|
| Token request fails with `invalid_client` | The id or secret is wrong, or the client was revoked. Ask the user to check them |
| `403` on a Click call | The client lacks `click:read`, or the organization lacks Click. Name the scope |
| `No template matches` | Run `templates` and show the names |
| `matches N templates` | List them and ask which |
| `429` | The script backs off and retries on its own. If it still fails, narrow the window or the templates |
| Any other error | Quote the `x-request-id` from the message |

## Boundary

These reports state what was recorded and whether its evidence verifies. They do not say
whether consent is valid, whether a change needed fresh consent, or what to do about
signers who have not re-accepted. Those decisions belong to the user and their counsel.
