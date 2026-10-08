---
type: llm
weight: 1
---

The user pasted a clickwrap export and wants a production re-acceptance report saved as
HTML and Markdown. The export the user pasted contains exactly these acceptances, all of
template "Northwind Console EULA", at 10:00 UTC on the date shown:

| Acceptance | Signer | Version | Deployment | Date |
|---|---|---|---|---|
| acc-01 | ana@example.com | 1.0.0 | production | 2026-02-01 |
| acc-02 | ana@example.com | 2.0.0 | production | 2026-03-02 |
| acc-03 | ben@example.com | 1.0.0 | production | 2026-02-02 |
| acc-04 | none recorded, not even on its receipt | 1.0.0 | production | 2026-01-10 |
| acc-05 | cy@example.com, from its receipt only | 1.0.0, from its receipt only | production | 2026-02-03 |
| acc-06 | eli@example.com | 1.0.0 | production | 2026-02-04 |
| acc-07 | eli@example.com | 2.0.0 | staging | 2026-03-04 |
| acc-08 | dee@example.com | 2.0.0 | production | 2026-03-05 |

The correct reading: in production, ana and dee are on 2.0.0; ben, cy and eli accepted
1.0.0 and have not accepted 2.0.0 in production. eli's 2.0.0 acceptance came through the
staging deployment, which does not count for production. acc-04 cannot be attributed.
Production holds 7 acceptances, 5 of 1.0.0 (CHECKBOX) and 2 of 2.0.0 (BUTTON).

PASS requires all of:

- Names ben@example.com, cy@example.com and eli@example.com as the signers who still owe
  acceptance of 2.0.0 in production.
- Does not name ana@example.com or dee@example.com as owing acceptance.
- Says that eli's 2.0.0 acceptance was on staging and does not count for production.
- Says that acc-04 has no recorded signer, rather than dropping it silently.

FAIL if any of:

- Attributes acc-04 to a named signer.
- States a version or date for a named signer that contradicts the table above.
