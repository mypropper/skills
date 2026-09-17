---
name: signature-ready-check
description: Pre-flight a contract or agreement before anyone signs it — find unfilled blanks and placeholders, inconsistent party and entity names, missing or unattached exhibits, absent signature blocks, and dates that are wrong or stale. Use before sending a document for signature, when asked to check or proof a contract, or when a document is about to go to a counterparty.
---

# Signature-ready check

Read a PDF or DOCX and report everything that would embarrass the sender if it went out
as-is. This runs entirely locally and calls no Propper tools, so it works with or without
an account.

## Steps

### 1. Read the document

Extract the full text, keeping page numbers. Use whatever tooling the environment has:
`pdftotext -layout`, `pdfplumber`, `pypdf` for PDF; `python-docx` or unzipping
`word/document.xml` for DOCX. Read every page, including exhibits and schedules.

Never report a document clean on a partial read. If extraction fails on some pages, say
which pages were unreadable.

### 2. Run the seven checks

**Blanks and placeholders.** Runs of underscores, `[ ]`, `[BRACKETED TEXT]`, `TBD`, `TBC`,
`XXX`, `N/A` where a value is expected, `{{merge_field}}`, `<<FIELD>>`, `«Field»`,
`Lorem ipsum`, `insert`, `to be determined`. Report each with its page and the surrounding
sentence.

Distinguish a blank a signer is meant to fill at signing from a blank the sender forgot.
A signature line is the former. `Effective Date: ________` at the top of the document is
usually the latter.

**Entity names.** Collect every party name in the document, including the preamble, the
definitions, the body and the signature blocks. Report any variation: `Acme, Inc.` versus
`Acme Inc` versus `ACME Incorporated`, a defined term used before it is defined, a defined
term that is never used, and a party named in a signature block who appears nowhere else.
Entity-suffix mismatches are the single most common defect worth catching.

**Defined terms.** Terms in quotes-and-capitals in the definitions that never recur, and
capitalised terms used in the body that were never defined.

**Exhibits and schedules.** Every `Exhibit A`, `Schedule 1`, `Annex`, `Appendix`
referenced in the body, matched against what is actually attached. Report references with
no attachment, and attachments never referenced. Also flag an exhibit that is present but
empty or a placeholder page.

**Signature blocks.** One execution block per party named in the preamble. Report a party
with no block, a block for a party not in the preamble, and a block missing its `Name:`,
`Title:` or `Date:` line. Note whether the document has any signature line at all.

**Dates.** The effective date, term dates, expiry, renewal and notice dates. Report a date
in the past where a future date is expected, an end date before its start date, a term
that contradicts a stated duration, a year that looks like a carry-over from a previous
version, and any date left blank.

**Numbers and cross-references.** Amounts stated twice with different figures, a figure
that disagrees with its written-out words, percentages that should total 100 and do not,
and section cross-references pointing at a section that does not exist.

When figures disagree, report every figure the document states and leave it there. Do not
say which one governs, and do not invoke a rule of construction such as written words
prevailing over numerals — which figure controls is a legal question, not a mechanical
one.

### 3. Report

Group findings into three tiers and lead with the count in each:

- **Blocking** — would produce an invalid or unenforceable-looking document: an unfilled
  blank in an operative term, a missing signature block, a referenced exhibit that is not
  attached, an end date before its start date.
- **Should fix** — visible to the counterparty and looks careless: entity-name variation,
  a stale year, an unused defined term, a broken cross-reference.
- **Worth a look** — possible but not certainly wrong: an unusual blank, a term used once,
  a date that is merely surprising.

For each finding: the page, the exact text, and what is wrong with it. Quote the document;
do not paraphrase it.

End with one line: how many blocking items stand between this document and sending.

### 4. Hand off

When there are no blocking items and the user wants to send, route to
`send-for-signature`. When signature blocks exist but the document has no fillable fields,
route to `place-signature-fields`.

## Rules

- Report what the document says, with a location. Never assert a defect without quoting
  the text it comes from.
- Report the discrepancy, not its resolution. Naming which of two conflicting terms wins,
  or what a clause would be read to mean, is interpretation and belongs to the user.
- A clean report means the seven checks found nothing, not that the document is good.
  Say that explicitly.
- Do not edit the document. Report; the user decides.

## Not legal advice

This finds mechanical defects: blanks, mismatches, missing attachments, wrong dates. It
does not assess whether a term is favourable, whether a clause is enforceable, whether the
document suits its purpose, or who has authority to sign. Do not say a document is safe to
sign, standard, or fair, and do not state how a court or a jurisdiction would read it.
Those judgements belong to the user and their counsel.
