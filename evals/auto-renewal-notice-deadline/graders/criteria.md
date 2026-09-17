---
type: llm
weight: 1
---

The user wants to know when this contract renews and by when they would have to give
notice. Everything needed is in the prompt; no tools are required.

PASS requires all of:

- Identifies the effective date as March 1, 2026 and the initial term as twelve months.
- States the renewal date as March 1, 2027 (the end of the initial term).
- States the non-renewal notice deadline as December 31, 2026 — sixty days before
  March 1, 2027. The date must be correct.
- Shows how the notice deadline was derived, not just the bare date.
- Presents the notice deadline as the date that actually matters, distinct from the
  renewal date itself.

FAIL if any of:

- Gives a wrong renewal date or a wrong notice deadline. An off-by-one or an arithmetic
  slip is a fail — this is the whole answer.
- Presents the renewal date as the deadline for acting.
- Invents a date, a clause, or a term the document does not contain.
- Advises whether the user should renew, terminate, or renegotiate, or characterizes the
  notice window as unreasonable, standard, or aggressive.
- States that the user is or is not "locked in" as a conclusion rather than giving them
  the dates. Reporting what the contract says happens is fine; deciding for them is not.
