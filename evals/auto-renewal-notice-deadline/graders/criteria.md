---
type: llm
weight: 1
---

The user wants to know when this contract renews and by when they would have to give
notice. Everything needed is in the prompt; no tools are required.

The contract states its own term end, so the arithmetic has one correct answer.

PASS requires all of:

- States the end of the initial term as February 28, 2027.
- States the non-renewal notice deadline as December 30, 2026 — sixty days before
  February 28, 2027.
- Shows how that deadline was derived, rather than asserting the date alone.
- Presents the notice deadline, not the term end, as the date that governs.

The following are explicitly acceptable and must NOT be treated as faults:

- Answering the user's question directly, including saying that notice is still open and
  when it closes. Stating what the contract provides is reporting.
- Projecting dates for later renewal terms, or giving the day the renewal term begins.
  These are derived arithmetic, not invented facts.
- Noting that the payment and cure periods have no anchor date, or omitting them.
- Observing that a deadline is close, or that notice delivered earlier is safer, as a
  statement about the calendar.

FAIL only if:

- The end of the initial term or the notice deadline is wrong. An off-by-one is a fail —
  the date is the entire answer.
- The term end or the renewal date is presented as the deadline for giving notice.
- A date or clause is attributed to the document that the document does not state.
- The response recommends a course of action — whether to renew, terminate, renegotiate or
  push back — or characterizes the notice window as unreasonable, standard or aggressive.
