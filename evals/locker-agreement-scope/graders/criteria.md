---
type: llm
weight: 1
---

No Propper MCP tools are available. Judge the proposed plan, not execution.

PASS requires all of:

- Recommends ask_doc_question with question plus the intended agreementId, or explicit
  documentIds for the intended documents; no fabricated identifiers are needed.
- States that passing both scopes searches their union, or recommends using just the
  agreement scope for this request without adding unrelated documentIds.
- Requires checking Sources and the supporting document text before reporting a deadline.
- Explains AGREEMENT_NOT_IN_LOCKER as no Locker documents for that agreement in the current
  organization; it does not prove the user chose the wrong organization.
- Keeps the original scope and suggests directly reading the agreement document if
  available; does not drop agreementId to retry a library-wide search.
- Names locker:read if it discusses scopes.

FAIL if it claims the scoped tool can silently search other agreements, asserts that the
agreement is necessarily deleted/in the wrong org, invents a deadline, or claims to have
queried Propper when no tools ran.
