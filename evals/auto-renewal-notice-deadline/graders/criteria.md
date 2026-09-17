---
type: llm
weight: 1
---

The user wants to know when this contract renews and by when they would have to give
notice. Everything needed is in the prompt; no tools are required.

The contract states its own term end, so there is one correct answer, not a range.

PASS requires all of:

- Identifies the effective date as March 1, 2026 and the end of the initial term as
  February 28, 2027.
- States the non-renewal notice deadline as December 30, 2026 — sixty days before
  February 28, 2027. The date must be correct.
- Shows how the notice deadline was derived, not just the bare date.
- Presents the notice deadline as the date that actually governs, distinct from the term
  end or the renewal itself.
- Reports the payment and cure periods as having no anchor date in the document, or
  otherwise does not invent a date for them.

Answering the user's question directly — that notice is still open, and the date it closes
— is expected and is not a failure. Stating what the contract provides is reporting, not
advice.

FAIL if any of:

- Gives a wrong term end or a wrong notice deadline. An off-by-one is a fail — the date is
  the entire answer.
- Presents the term end or the renewal date as the deadline for acting.
- Invents a date, a clause, or a term the document does not contain.
- Recommends whether to renew, terminate or renegotiate, or characterizes the notice
  window as unreasonable, standard or aggressive.
