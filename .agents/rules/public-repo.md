---
name: public-repo
description: This repository is public. Applies to every commit, branch, issue, pull request, review comment and file written here.
---

# This repository is public

`mypropper/skills` is published to the Claude Code plugin marketplace and installable by
anyone. Treat everything committed here — code, docs, commit messages, branch names, issue
and pull request text, review comments — as permanently public and attributable to Propper.
Assume it is read by customers, competitors and people evaluating the product.

## Write for a reader who does not work here

State what the skills do and how to use them well. Frame changes as the improvement they
deliver, not as the problem that prompted them.

| Write this | Not this |
|---|---|
| "`add_annotations` replaces the whole field set, so place every field before sending." | "`add_annotations` isn't guarded after send and wipes live fields." |
| "Verify an import with `get_template`, which returns the full field set." | "`export_template` is lossy and drops 9 of 18 fields." |
| "`role` accepts these values." | "The docs were wrong; `role` is really an enum." |
| "Use `docgen:write` for HTML template previews." | "Preview 403s even with `docgen:admin`." |
| "clarify recipient roles and field placement" | "fix broken role docs" |

Both columns carry the same instruction. Only the second one reads as a defect report.

## Never commit

- Internal defect reports, incident notes, postmortems, or "the API actually does X"
  commentary about unreleased or unannounced behaviour
- Internal ticket numbers, sprint or roadmap references, or links to private tools
- Customer names, counterparty names, deal data, or anything from a real agreement
- Organization ids, agreement ids, recipient ids, document ids, request ids, signing URLs,
  download links, session ids or access tokens from a real environment
- Real email addresses, including test aliases on a company domain
- Screenshots of a logged-in environment showing real data
- Environment hostnames, infrastructure detail or configuration beyond the documented
  public endpoint

Test fixtures use invented parties and `example.com` addresses. The Mutual NDA in
`agreement-starter-pack` is the model: fictional, self-contained, no real identifiers.

## Reporting something that is genuinely wrong

Findings from testing against a live environment are valuable, and they belong in an
internal channel, not in this repository's history. Bring the correction here as guidance
that helps a user succeed, and keep the diagnosis out of the public record.

If a security issue is involved, do not open an issue or pull request at all. Report it
privately first.

## Before you push

- Reread the commit message and PR body as a stranger would
- Check the diff for ids, URLs, emails and hostnames — not just the files you meant to edit
- Confirm any new fixture is fictional
- Remember that force-pushing does not remove what was already fetched, and an edited issue
  keeps its edit history

When in doubt, write less detail rather than more. Nothing here needs to explain why a
change was necessary in order to be useful.
