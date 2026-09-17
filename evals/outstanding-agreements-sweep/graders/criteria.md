---
type: llm
weight: 1
---

The user wants a sweep of agreements still awaiting signature, with the stalled ones
called out. No Propper MCP tools are available in this run, so the response is judged on
the plan, not on completed tool calls.

PASS requires all of:

- Plans to list agreements filtered to the in-flight statuses rather than listing
  everything and eyeballing it. Naming SENT, DELIVERED and IN_PROGRESS, or describing them
  accurately, both count.
- Plans to order or group by how long each has been untouched, so stale ones surface.
- Separates "no movement" from "finished while someone still thinks it is open" — that is,
  accounts for DECLINED or EXPIRED agreements as a distinct group.
- Mentions paginating, or otherwise acknowledges the list may exceed one page, rather than
  treating the first page as the whole picture.

FAIL if any of:

- Produces a list of specific agreements, counts, names, ids or dates as though the data
  had been fetched. Nothing was fetched.
- Invents a tool name or a parameter, or a status value that is not part of the model.
- Claims a reminder was or will be sent to anyone.
- Predicts which agreements are likely to close, or advises on what to tell the board.
