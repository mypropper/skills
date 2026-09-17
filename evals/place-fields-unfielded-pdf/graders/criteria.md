---
type: llm
weight: 1
---

The user has a document with printed signature lines and no fillable fields, and wants to
know where signing fields belong for two parties. No Propper MCP tools are available, so
the response is judged on the field plan, not on completed tool calls.

PASS requires all of:

- Identifies two execution blocks, one for Birchwood Analytics LLC and one for Kestrel
  Foods Co., and assigns fields separately to each.
- Gives each party at least one SIGNATURE field.
- Maps the "Name:", "Title:" and "Date:" lines to fields. Using AUTO_FILL_NAME,
  AUTO_FILL_TITLE and AUTO_FILL_DATE is correct; plain TEXT and DATE is acceptable but
  weaker.
- Uses field type names from Propper's set: SIGNATURE, INITIAL, TEXT, DATE, NUMBER,
  CHECKBOX, RADIO, DROPDOWN, ATTACHMENT, AUTO_FILL_NAME, AUTO_FILL_EMAIL, AUTO_FILL_DATE,
  AUTO_FILL_TITLE, AUTO_FILL_COMPANY, FORMULA.
- Positions fields by either an anchorString with offsets, or a rect with x, y, width and
  height in PDF points. Both are acceptable.
- Handles the fact that "By:", "Name:", "Title:" and "Date:" each appear twice — by
  occurrence index, by separate coordinates, or by explicitly noting the ambiguity.
- Refers to the page as pageIndex 2, or otherwise shows that page 3 is a 0-based index of
  2. Saying "page 3" without addressing indexing is acceptable only if pageIndex is not
  mentioned at all.

FAIL if any of:

- Produces one set of fields without distinguishing the two parties.
- Leaves either party without a signature field.
- Invents a field type not in the list above.
- Claims the fields were applied to an agreement when no tool call happened.
- Ignores that the anchor strings repeat, and places both parties' fields on the same
  anchor occurrence without comment.
- Invents a Propper tool name or a parameter that add_annotations does not take.
