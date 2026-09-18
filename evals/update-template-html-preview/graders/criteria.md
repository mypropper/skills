---
type: llm
weight: 1
---

No Propper MCP tools are available. Judge the proposed plan, not execution.

PASS requires all of:

- Shows update_gen_template using id, templateContent and changeLog only for this edit.
- Explicitly excludes templateType, generationKind, version and settings/import metadata
  from the update payload; does not recommend copying the complete read response.
- Shows preview_gen_template with id, data and output: "html" and accepts docgen:write
  for the HTML template. Nested merge data remains inside data.
- Explains DOCX-source or URL preview requires reserved docgen:preview, unavailable to MCP
  clients; recommends generating and retrieving a PDF for review rather than requesting
  re-consent to that reserved scope.
- Does not claim to save, preview or generate anything without tool calls.

FAIL if it adds unsupported update keys, says HTML preview needs separate preview consent,
puts customer at the top level of the preview tool payload, or proposes sending the Word
agreement as a substitute for reviewing the generated document.
