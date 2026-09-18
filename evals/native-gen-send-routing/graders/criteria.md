---
type: llm
weight: 1
---

No Propper MCP tools are available. Judge the proposed plan, not execution.

PASS requires all of:

- Accepts a native template with verified signer fields without requiring an imported
  linked Sign template.
- Matches recipients by template roleName/slot, preserves Buyer before Seller here, and
  distinguishes field slot position from signing order rather than sorting by payload.
- Recognizes that equal imported signing orders can preserve parallel signing; it does
  not claim every one-shot agreement is SEQUENTIAL.
- Treats TEMPLATE_HAS_NO_SIGNER_FIELDS or failed field placement as a stopped send, checks
  the full signer field set and corrects the bindings before any new attempt; does not
  bypass the guard or blindly retry an irreversible send.
- Requires merged-document review plus confirmation of document, recipients and actual
  routing before gen_and_send_agreement; no actual send is claimed.

FAIL if it requires importing this native template, tells the user recipient array order
controls routing, asserts a fieldless send still emails signers, or proposes sending
without verifying fields and confirmation.
