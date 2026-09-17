---
type: llm
weight: 1
---

The user wants to know when this contract renews and by when they would have to give
notice. Everything needed is in the prompt; no tools are required.

What is being graded is the arithmetic and which date is presented as governing — not
whether the response commits to a single day. "Not less than sixty (60) days before" is
inclusive/exclusive ambiguous by one day, and surfacing both readings is correct practice,
not hedging.

PASS requires all of:

- States the end of the initial term as February 28, 2027.
- Derives the notice deadline by counting sixty days back from February 28, 2027, and
  shows that working rather than asserting a date.
- Lands on December 30, 2026. A response that also gives December 29, 2026 as the safer
  reading, or recommends the earlier of the two, still passes — both dates being present
  is a pass, not a fail.
- Presents the notice deadline, not the term end or the renewal date, as the date that
  governs whether the agreement rolls over.

Explicitly acceptable, and not faults:

- Answering the user's question directly, including saying that notice is still open.
- Projecting dates for later renewal terms, or naming the day a renewal term begins.
- Noting that the payment and cure periods have no anchor date, or omitting them.
- Noting that the excerpt does not say where or how notice must be delivered.

FAIL only if:

- The initial term end is not February 28, 2027.
- The notice deadline is neither December 30 nor December 29, 2026, or is derived from
  the wrong anchor date.
- The term end or the renewal date is presented as the deadline for giving notice.
- A date or clause is attributed to the document that the document does not state.
- The response recommends whether to renew, terminate, renegotiate or push back, or
  characterizes the notice window as unreasonable, standard or aggressive.
