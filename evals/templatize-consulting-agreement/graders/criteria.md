---
type: llm
weight: 1
---

The user wants a document they rewrite monthly turned into a reusable template. No Propper
MCP tools are available in this run, so the response is judged on the plan and the proposed
template, not on completed tool calls.

PASS requires all of:

- Identifies the spans that vary between copies as merge fields — at minimum the
  counterparty name and entity type, the dates, and the fee amount.
- Keeps genuinely fixed text as literal text rather than parameterizing everything.
  Governing law or the section headings staying fixed is sufficient evidence.
- Shows placeholder syntax in the `{{fieldName}}` form.
- Proposes declaring the fields in a data schema, not just marking up the body.
- Addresses the signature blocks: either places recipient anchors of the
  `{{propper.sign.recipient.N.<kind>}}` form, or states that doing so lets a generated
  copy go out for signature without placing fields by hand.

FAIL if any of:

- Claims a template was created, or reports a template id, when no tool call happened.
- Invents a tool name or a parameter, or claims every native template needs an imported
  Sign-template link before one-shot sending. A native template with verified signer
  fields can use that path; missing signer fields must be resolved first.
- Returns only a reformatted copy of the document with no fields identified.
- Advises on whether the agreement's terms are reasonable or should be changed.
