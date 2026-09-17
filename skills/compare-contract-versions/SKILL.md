---
name: compare-contract-versions
description: Compare two versions of the same agreement and report exactly what changed — clauses added, removed or reworded, altered amounts, dates and party names, renumbered sections, and changes to the signature blocks. Use when someone has a revised draft, a counterparty's markup or a redline, when they ask what changed, what came back different, whether their edits survived, or what the other side quietly altered.
---

# Compare contract versions

Read two versions of the same document and report every substantive difference, with
locations and both wordings. This runs entirely locally and calls no Propper tools, so it
works with or without an account.

For a single document about to go out, use `signature-ready-check`. For dates and
deadlines out of a final document, use `extract-contract-dates`.

## Steps

### 1. Establish which version is which

Direction matters: "added" and "removed" are meaningless without a baseline. Take the
earlier version as the baseline and the later one as the comparison.

When the filenames do not settle it, ask. Do not infer recency from a modification time,
which reflects when a file was copied as often as when it was edited.

### 2. Extract the text before comparing

Pull plain text from both. Then discard differences that are not content:

- line wrapping, pagination, page numbers, headers and footers
- whitespace runs, smart quotes versus straight quotes, hyphenation at line ends
- font, spacing and styling changes carrying no text change

Reporting reflow as change buries the three edits that matter under two hundred that do
not.

### 3. Align by clause, not by line

Match sections by their numbering and headings first, then compare within each matched
pair. A line-by-line diff of a document where one paragraph was inserted early reports
every subsequent line as changed.

Renumbering is itself a finding. When section 8 becomes section 9, say so, and check
whether cross-references to "Section 8" elsewhere followed it.

### 4. Classify every difference

| Class | What it is |
|---|---|
| Added | Text present in the new version only |
| Removed | Text present in the baseline only |
| Reworded | The same clause, different wording |
| Value changed | A number, date, period, currency amount or percentage differs |
| Party changed | An entity name, address, jurisdiction or notice recipient differs |
| Renumbered | The same text under a different section number |
| Moved | The same text in a different place in the document |

### 5. Report

Group by class, most concrete first: value and party changes, then added and removed
clauses, then rewordings, then renumbering and moves.

For each difference give the section, the baseline text and the new text **verbatim**.
Never compress a value change into "the fee was updated" — give both numbers.

Say explicitly when a section is unchanged if the user asked about it. "Nothing changed
in the indemnity section" is an answer; silence is not.

## Look hardest at these

They are the changes most often missed on a read-through:

- **Negation and modality.** `shall` to `may`, `must` to `should`, an inserted or deleted
  `not`, `including` to `including without limitation`. One word, inverted obligation.
- **Defined terms.** A changed definition alters every clause using it, none of which
  show as changed themselves. When a definition moves, list the sections relying on it.
- **Cross-references.** After renumbering, a reference to "Section 8" may now point
  somewhere else entirely. Check every internal reference resolves.
- **Numbers and units.** 30 days versus 30 business days. Net 30 versus net 45. A
  percentage that moved a decimal place.
- **Carve-outs and exceptions.** An added "except" clause narrows an obligation without
  touching the sentence that states it.
- **Signature blocks and exhibits.** A removed signature block, a renamed exhibit, an
  exhibit referenced but no longer attached.

## Limits — state them rather than guessing

- A scanned PDF with no text layer cannot be compared. Say so; do not report "no changes
  found" for a document that was never read.
- Tracked changes and comments in a DOCX may carry edits that the accepted text does not
  show. Note when a file contains them.
- An encrypted or password-protected file cannot be opened.
- Two documents that are not versions of each other produce a meaningless diff. If the
  structures do not correspond, say that instead of reporting every clause as changed.

## Boundary

Report what changed. Do not rank the changes by how bad they are, say whether a change is
acceptable, standard, favourable, one-sided or safe to accept, or advise on whether to
sign, push back or accept the redline.

Those are the user's calls, and they need the facts to make them: every change, its
location and both wordings. If asked which changes matter, give the classification and
say the significance call belongs to them or their counsel.
