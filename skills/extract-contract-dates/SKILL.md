---
name: extract-contract-dates
description: Pull every date, deadline and notice window out of an agreement and turn them into a dated list — effective date, term and expiry, auto-renewal with the notice deadline that precedes it, termination rights, cure periods, and payment or delivery milestones. Use when someone asks when a contract renews or expires, what the notice period is, what they need to put in a calendar, how long they have to get out of something, or wants the deadlines pulled out of a stack of contracts.
---

# Extract contract dates

> **PREREQUISITE:** Use the `propper` skill for authentication and tool routing **only**
> when reading documents already stored in Propper. Reading files from disk needs no
> account.

Most missed contract deadlines are not missed because nobody read the contract. They are
missed because the deadline was never written down as a date — it existed only as "sixty
days prior to the end of the then-current term".

The job is to turn durations into dates.

## Steps

### 1. Read the documents

From disk, or from Propper with `locker_list_documents` and `locker_get_document` when
the user's contracts live there. For `ask_doc_question`, supply `agreementId` or the intended
`documentIds` and verify its sources before quoting a deadline; never widen a failed
agreement lookup to the whole library. `locker_extract_risks` and `locker_list_risks` surface what Propper has
already extracted, including renewal and termination terms.

### 2. Find the anchor dates

Every derived deadline hangs off one of these:

- the **effective date** — often not the signature date, and often defined in the preamble
- the **signature dates**, and whether the contract runs from "the date last signed"
- **delivery, acceptance or go-live** dates, where the term starts on an event

If the anchor is blank, unsigned or undetermined, **the whole schedule is undetermined**.
Say that first, list the durations you found, and do not present a computed date built on
a guessed anchor.

### 3. Find the durations and what each attaches to

| Duration | Usually attaches to |
|---|---|
| Initial term | The effective date |
| Renewal term | The end of the current term |
| Notice period for non-renewal | Backwards from the end of the current term |
| Termination for convenience notice | Any date, forwards |
| Cure period | The date a breach notice is given |
| Payment terms | Each invoice date |
| Survival | The termination or expiry date |

### 4. Compute the derived deadlines, and show the arithmetic

This is the part that has value. For each duration, give the resulting date **and** how it
was reached:

```
Auto-renewal date        2027-03-01   Effective 2026-03-01 + 12-month initial term
Non-renewal notice due   2026-12-31   2027-03-01 minus 60 days' notice (§ 9.2)
```

Showing the derivation lets the user check the reading. A bare date cannot be verified.

Be precise about the things that move a deadline:

- **Calendar days versus business days.** Thirty business days is roughly six weeks.
- **Months versus days.** "Three months" and "90 days" land on different dates.
- **Inclusive or exclusive.** "Within 30 days after" versus "30 days from" can differ by
  a day, and a one-day miss on a notice window is a full renewal term.
- **Whose time zone**, when a contract specifies one.

When the wording is genuinely ambiguous, give both readings and both dates. Do not pick
one silently.

### 5. Report as a dated list

Sort by date ascending, soonest first. For each row: the date, what happens on it, the
clause it comes from, and the derivation. Mark every date that is already in the past.

Close with what you could not determine and why — a missing effective date, an undated
signature, a duration with no anchor.

## The auto-renewal trap

The date that matters is not the renewal date. It is the **notice deadline** before it,
which typically falls 30, 60 or 90 days earlier. A contract that renews on 1 March with a
90-day notice window is effectively decided on 1 December.

Put the notice deadline in the list as its own row, ahead of the renewal. If it has
already passed, say so plainly with both dates, and state what the contract says happens
next — not what the user should do about it.

## Across many contracts

Reading a folder or a Locker library, produce one combined list sorted by date, with the
source document named on every row. Then note the documents you could not read — a scanned
PDF with no text layer, an encrypted file — rather than letting them vanish from a list
that looks complete.

Never present a date that is not in a document you actually read.

## Boundary

The arithmetic is factual. What to do about it is not.

Report the dates, the clauses and the derivations. Do not advise whether to renew,
terminate, renegotiate or let something lapse, do not characterize a notice window as
unreasonable or aggressive, and do not tell a user they have missed their chance — give
them the dates and let them, or their counsel, draw that conclusion.
