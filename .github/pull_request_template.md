<!--
  This repository is public, and so is everything in this pull request.
  Please read .agents/rules/public-repo.md before filling this in — it covers how
  to describe a change here. Write for someone outside the company.
-->

## What this changes

<!-- One or two sentences. Lead with the improvement, not the problem behind it. -->

## Why it helps

<!--
  What an agent or a user can now do that they could not do reliably before.
  Keep it to the change itself. No internal tickets, incidents or environment detail.
-->

Closes #

## Type of change

- [ ] New skill
- [ ] Change to an existing skill
- [ ] Agreement template content
- [ ] Reference docs
- [ ] Repo tooling, CI or contributor guidance

## Checks

- [ ] `node scripts/check-repo.mjs` passes
- [ ] `claude plugin validate . --strict` passes
- [ ] `claude plugin validate skills --strict` passes
- [ ] Relevant eval cases still pass, and a new skill or trigger has a case covering it

## If this touches a skill

- [ ] Frontmatter `name` matches the directory name, and `description` says when to use it
- [ ] Tool names, parameters and scopes match what the MCP server actually accepts
- [ ] Anything that emails a recipient or destroys data still confirms first
- [ ] The not-legal-advice boundary is intact — the skill reports facts and does not judge
- [ ] Links between skill files are relative and resolve from a plain checkout

## If this touches an agreement template

- [ ] Every property in `dataSchema` is used in `templateContent`, and every merge field is
      declared in the schema
- [ ] Handlebars blocks are balanced, and numbered sections stay contiguous when an
      optional clause is omitted
- [ ] Rendered with data satisfying `dataSchema.required` and visually checked
- [ ] Carries the notice that it is a starting point for counsel to review

## Public repository

- [ ] No real customer, counterparty or agreement data
- [ ] No ids, signing or download URLs, request ids, tokens or session ids from a live
      environment
- [ ] No real email addresses — fixtures use invented parties and `example.com`
- [ ] Commit messages, this description and any screenshots read as public documentation

## Testing notes

<!--
  How you verified this. If you tested against a live account, say so without pasting ids
  or URLs. Never point a real send at someone else's address.
-->
