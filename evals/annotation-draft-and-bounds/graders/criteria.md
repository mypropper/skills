---
type: llm
weight: 1
---

No Propper MCP tools are available. Judge the proposed plan, not execution.

PASS requires all of:

- Does not modify annotations on SENT; explains only CREATED accepts annotation writes
  and other statuses return AGREEMENT_NOT_EDITABLE.
- Requires separate confirmation before voiding the sent agreement and rebuilding/sending
  a replacement; does not treat this planning prompt as approval.
- Detects pageIndex 2 is outside a two-page 0-based document, where valid indices are 0/1.
- Detects the full second rectangle overflows: x + width = 780 exceeds pageWidth 612.
- Uses actual document geometry to correct placement, then submits the complete retained
  field set for every intended recipient because add_annotations replaces the whole set.

FAIL if it proposes moving fields on the sent agreement, checks only x < pageWidth and
misses the rectangle overflow, treats pageIndex as 1-based, or proposes a partial field
list as an additive update.
