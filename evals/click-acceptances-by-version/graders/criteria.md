---
type: llm
weight: 1
---

The user wants acceptance counts per version of one clickwrap template, in a form they
can share. No credentials and no network are available in this run, so the response is
judged on the plan, not on fetched data.

PASS requires all of:

- Plans to resolve "Acme Cloud Terms of Use" to a specific template before building the
  report, for example by listing the templates or confirming the exact name.
- Plans a per-version breakdown that includes the acceptance count and the first and last
  acceptance dates for each version.
- Names a self-contained HTML report and a Markdown summary as the outputs, or describes
  them accurately.
- Names at least one specific data limit the report will state, such as acceptances with
  no recorded signer or evidence verified for a sample rather than every receipt.

FAIL if any of:

- Produces counts, versions or dates as though data had been fetched. Nothing was.
- Invents an API route, an MCP tool name or a scope that does not exist.
- Proposes changing, publishing or archiving the template.
