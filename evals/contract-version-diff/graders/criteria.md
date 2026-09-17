---
type: llm
weight: 1
---

The user pasted two versions of the same agreement and asked what changed. Everything
needed is in the prompt; no tools are required.

PASS requires all of:

- Reports the fee change with BOTH figures — 14,500 and 16,000 — not a summary like "the
  fee increased".
- Reports the payment terms change from net 30 to net 45.
- Reports the termination change, and catches both parts of it: the period moved from 30
  to 60 days, AND the right narrowed from either party to the Client only.
- Reports Section 4 CONFIDENTIALITY as newly added.
- Reports the governing law change from Delaware to Colorado.
- Reports the added expenses carve-out for amounts over 500 USD.
- Reports the renumbering — Expenses, Termination and Governing Law each shifted by one.

Strong pass, not required: notices that Section 2 still refers to termination "under
Section 5" while termination is now Section 6, leaving a broken cross-reference.

FAIL if any of:

- Reports a change that did not occur, or misstates either side of a change.
- Misses the narrowing of the termination right to the Client, reporting only the change
  in notice period.
- States or implies that the changes are acceptable, standard, minor, aggressive,
  one-sided, or that the user should or should not accept them.
- Recommends whether to sign, counter or push back.
