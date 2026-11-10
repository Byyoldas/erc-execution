# ERC Execution v1.2.0 — Release Notes

*Tagged and released as `erc-execution/v1.2.0`.*

## What's New

### Horizon Europe consortium projects: Funding Model

ERC Execution was built around a single ERC grant. This release adds
support for **Horizon Europe collaborative projects**, both **actual-cost**
and **lump-sum**, where your Budget file describes only *your own
organization*, not the whole consortium.

- **Funding Model selector** on the Dashboard: *ERC grant* (the default
  — every existing project keeps behaving exactly as before), *Horizon
  Europe — actual costs*, or *Horizon Europe — lump sum*. Switching it
  only changes which screens are shown and never deletes or alters data.
- **Partners screen**:
  - Partners can now be **edited** (previously add and delete only).
  - On Horizon projects, tick **My organization** on the partner that is
    you — this tells the app that your Budget file's figures belong to
    that partner.
  - On actual-cost projects, each partner has an **EU funding rate %**
    (blank means 100%).
  - The planned column follows the funding model.
- **Consortium Budget** (actual-cost projects): a partners × cost-category
  table (A Personnel, B Subcontracting, C1 Travel, C2 Equipment, C3 Other
  goods & services, D Other categories, E Indirect) with each partner's
  total eligible cost, funding rate, and requested EU contribution, plus a
  consortium total. **Your own row comes from your Budget file and is
  read-only**; every other partner's row is typed in from the Grant
  Agreement's budget table.
- **Lump Sum Plan** (lump-sum projects): a work-package × partner table of
  planned lump-sum shares with row, column, and grand totals.
- The Dashboard's Consortium panel shows the planned total that applies to
  the active funding model.

### Project Start Date, editable on the Dashboard

"Month X" throughout the app is now derived from a real **Project Start
Date** (when the Grant Agreement takes effect), which you set right on the
Dashboard. It replaces the earlier, incorrect use of the *Call Opening
Date* for this purpose — that date only selects the EU travel rate
version. This is the one deliberate exception to "this app never edits
Budget data": the date is stored in your project file's configuration.

### Add-forms now line up with their table columns

On every screen with an add form (Partners, Personnel, Travel, Equipment,
Other Costs, Subcontracting, Amendments, Deliverables, Milestones,
Reporting Periods, Risk Register, Issue Log), the form used to sit in a
separate block under the table, so its inputs never matched the column
titles. The form is now a row inside the table, with each input directly
under its own column header and secondary fields in a labelled row
beneath. Enter still submits, and required fields are still validated.

Small related changes:
- **Other Costs** gains a *Status* dropdown to match its Status column.
- **Risk Register**: new risks are added from the *List* view; the Matrix
  view now says so.
- Buttons in the entry row read simply **Add** — the row's heading says
  what is being added.

## What's Included (unchanged except as noted above)

Everything in v1.1.3: Project Dashboard, Partner Organizations, Work
Package Management, Deliverable / Milestone / Amendment tracking, Personnel
& Person-Month Tracking with Time Declaration export, Travel / Equipment /
Other Costs / Subcontracting tracking, Financial Reporting, Reporting
Period Management, Risk Register, Issue Log, the Notifications tray, and
Reports & Export (Excel workbooks, printable PDF status report, EU Grants
Time Declaration).

## Compatibility

- Requires a `.ercbudget` file produced by **ERC Budget v1.7.0 or later**
  (file format `1.0` or `1.1`).
- **Existing files open unchanged.** Files saved by v1.1.3 or earlier have
  no funding model and open as plain ERC projects; no migration is needed.
- Consortium planning data is stored in the project file's execution
  section, which the Budget App ignores.
- **Project Start Date and older ERC Budget builds:** the date is saved in
  the project's configuration. An ERC Budget build that predates this
  field does not know about it and may drop it the next time that build
  saves the file. If that happens, simply set the date again on the
  Dashboard.

## Known Limitations / Out of Scope

- **Other partners' *actual* costs are not tracked yet.** This release
  covers the *planned* side of a consortium (budgets and lump-sum shares).
  Partner cost statements, financial reports, and payment tracking are
  planned for a later release.
- **Indirect costs (E) are entered, not calculated.** The Consortium
  Budget does not apply the 25% rate or check it against the other
  categories — enter the figures as listed in the Grant Agreement.
- **Lump Sum Plan work packages come from your Budget file.** If the Grant
  Agreement has more work packages than the Budget file declares, raise
  the work-package count in ERC Budget first.
- **Partner "Actual" is still personnel-only**, and its overspend warning
  still compares against the legacy hand-entered budget share.
- Person-month tracking is per calendar month rather than per reporting
  period.
- Budget transfer flagging (>10% moved between categories) isn't
  implemented.
- Travel actual cost is user-entered, not rate-table-computed.
- Subcontracting's competitive-tender and host-institution checks are
  advisory only.
- Single-user only — no shared consortium workspace and no conflict
  resolution for concurrently-opened files.
- **Autosave file visibility** still depends on the OS's hidden-files
  setting (dot-prefixed `.yourfile.ercbudget.autosave`).

## Security

No change since v1.1.3 — see `security-review-m3.md`. No credentials are
stored anywhere and the app makes no network calls in normal operation.

## Upgrade Instructions

Install alongside your existing ERC Budget installation; the two apps are
independent. If you have v1.1.3 installed this is a drop-in replacement.
To use the new consortium features, open a Horizon project file and choose
a **Funding Model** on the Dashboard.

## Feedback

Please report anything that looks wrong compared to your actual project
data, especially numbers that don't match what you see in the Budget App.
