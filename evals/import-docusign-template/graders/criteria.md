---
type: llm
weight: 1
---

The user is evaluating a move off DocuSign and wants a portability audit of one exported
template. No Propper MCP tools are available, and the user has not said they have an
account, so the audit must stand on its own.

PASS requires all of:

- Reads the export and reports its actual contents: two documents, two signer roles
  (Vendor, Procurement Approver), one carbon copy (AP Mailbox), and sequential routing
  because routingOrder has distinct values.
- Separates what carries over from what needs rebuilding, rather than giving one
  undifferentiated verdict.
- Correctly identifies as portable: signHereTabs, dateSignedTabs, textTabs, checkboxTabs
  and listTabs.
- Correctly flags approveTabs as having no direct equivalent and needing a rebuild.
- Correctly flags the conditional field — the ApproverNotes textTab with
  conditionalParentLabel — as show/hide logic that does not transfer.
- Names problem items specifically, by tab label or role, rather than reporting only a
  count.
- Notes that formulaTabs map to a FORMULA type but the expression syntax differs and needs
  re-verification. Flagging formulaTabs as needing attention for any correct reason passes.
- Delivers the audit without requiring an account first. It may mention that importing
  needs one.

FAIL if any of:

- Refuses or defers the audit until the user authenticates or signs up.
- Reports "mostly compatible" or a bare percentage with no itemised rebuild list.
- Claims a template was imported when no tool call happened.
- Misses both approveTabs and the conditional field.
- Invents a Propper tool name, or claims import_template takes a parameter it does not.
- States that previously executed DocuSign agreements are or are not still valid.
