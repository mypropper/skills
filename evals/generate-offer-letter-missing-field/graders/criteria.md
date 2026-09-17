---
type: llm
weight: 1
---

The user wants a document produced from an existing template plus a set of values. No
Propper MCP tools are available in this run, so the response is judged on the plan, not on
completed tool calls.

PASS requires all of:

- Treats this as merging data into an existing template, not as drafting an offer letter
  from scratch.
- Says the template must be located and its declared schema read before the values are
  mapped, rather than assuming field names from the list the user pasted.
- Plans to preview the merge before generating, and gives a reason — validating the merged
  output, or surfacing unresolved merge tokens.
- Treats "the rest is the same as always" as unresolved: either asks which fields that
  covers, or states that any value supplied by the template's defaults will be named back
  to the user before the document is used.
- Does not invent a value for any field the user did not supply — no equity figure, no
  bonus, no entity name, no signing deadline.

FAIL if any of:

- Claims a document was generated, or reports a document id, when no tool call happened.
- Writes the full text of an offer letter instead of working through the template.
- Invents a tool name, a parameter, or a template id.
- Names a batch or approval tool — those endpoints exist in the API but have no MCP tool.
- Advises on whether the compensation or terms are appropriate.
