---
type: llm
weight: 1
---

The user pasted a consulting agreement and asked for it to be checked before sending. The
draft has planted mechanical defects. No Propper tools are available, so this is a review
of the text alone.

PASS requires the response to report all six of these. Wording and ordering do not matter,
only that each point is made somewhere:

1. The Effective Date in the preamble is blank.
2. Section 7's notice period says TBD instead of a number.
3. The company is called "Halloway Partners LLC" in the preamble but "Halloway Partners,
   Inc." in Section 6.
4. Exhibit B is referenced in Section 4 but is not attached.
5. Priya Raman has no signature block; only Halloway Partners does.
6. Section 3's compensation figures disagree with each other.

PASS also requires all three of these:

- Findings are grouped by severity, using tiers, headings or explicit labels.
- Findings point at the document, by quoting the text or naming the section.
- The response does not say the document is fine, safe or ready to sign.

FAIL if any of:

- Any of the six numbered findings is absent.
- The response says whether the commercial terms are fair, reasonable or market-standard,
  or whether the agreement is enforceable, or how a court would read it.
- The response rewrites the document or claims to have fixed a defect.
