# ERC Execution v1.1.3 — Release Notes

*Tagged and released as `erc-execution/v1.1.3`. First release from this
app's own standalone repo (`github.com/Byyoldas/erc-execution`) — the
project was previously split out of the `m2-eu-budgeter` monorepo, where
v1.1.2 was released from.*

## What's New

### Partner Organizations (Consortium tracking)

A new **Partners** screen tracks each Horizon Europe consortium
beneficiary: name, country, EU Participant Identification Code,
coordinator/beneficiary role, contact, whether their Grant Agreement is
signed, and their agreed budget share. People on the Personnel screen can
now be linked to a partner organization via a new dropdown, alongside the
existing free-text Institution field.

The Dashboard gains a **Consortium** panel (shown once at least one
partner exists) with a planned-vs-actual table per partner, mirroring the
existing category breakdown.

This is consortium *data tracking* inside your own project file, not a
shared workspace other organizations edit directly — each partner
organization would run their own copy of the app on their own files, same
as this app has always been single-user/offline-first.

**Scope note on "Actual":** a partner's actual cost is personnel-only —
it sums the approved person-month costs of everyone linked to that
partner. Travel, Equipment, Other Costs, and Subcontracting aren't
attributed to a partner (or a Work Package) anywhere in the app yet, so
they're not included. A ⚠️ appears if a partner's personnel-only actual
exceeds their declared budget share by more than 10%.

Deleting a partner is blocked while anyone is still linked to them — the
row names who, with a shortcut to Personnel to reassign or clear the
link first.

No other changes since v1.1.2.

## What's Included (unchanged from v1.1.2 except as noted above)

**ERC Execution** is a companion desktop app to the **ERC Budget**
application (M2-EU Budgeter). It reads a `.ercbudget` file already created
in the Budget App and adds full project-execution tracking on top of it —
nothing in the planned budget is ever modified from this app.

All business logic is shared with erc-budget via the `erc-core` crate
(now its own repo, `github.com/Byyoldas/erc-core`) rather than duplicated:

- **Project Dashboard** — planned-vs-actual per ERC budget category, CFS
  status tracking against actuals, and the new Consortium panel.
- **Partner Organizations** — see above.
- **Work Package Management** — automatically derived status (Not
  Started/On Track/At Risk/Completed), leader assignment, notes.
- **Deliverable Tracking** — full lifecycle from planning through
  acceptance, automatic overdue detection, CORDIS registration reminders.
- **Personnel & Person-Month Tracking** — roster management (with optional
  partner-organization linking) and monthly FTE declarations with
  automatic salary cost estimation, plus a **Time Declaration export**.
- **Milestone Tracking** — automatic at-risk detection, completion gated
  on linked deliverables being accepted.
- **Amendment Management** — a log of formal grant amendments.
- **Travel, Equipment, Other Costs, and Subcontracting Tracking** — actual
  expenditure recording against each planned budget line, each with its
  own overspend warning threshold.
- **Financial Reporting** — planned-vs-actual reconciliation across all
  five ERC cost categories, reusing the Budget App's own calculation
  engine against actual instead of planned figures.
- **Reporting Period Management** — periods pre-populate automatically on
  first open (following the standard ERC CoG P1/P2/P3 pattern), with
  submission tracking.
- **Risk Register** — probability × impact scoring, a list and matrix
  view, mandatory review dates for high-priority risks.
- **Issue Log** — priority tracking with automatic staleness detection for
  unresolved high-priority issues.
- **Notifications & Warnings** — a persistent tray surfacing all 12
  warning types from the spec, each one click-through to the relevant
  screen.
- **Reports & Export** — Financial Report, Technical Report Annex, Risk
  Register, and Person-Month Declaration as Excel workbooks; a
  Project Status Report as a printable PDF; and an **EU Grants Time
  Declaration export**.
- **Save button and status** in the sidebar — greyed out when there's
  nothing to save, with a status line reading "All changes saved,"
  "Unsaved changes," "Saving…," or the real error if a save fails.
- **Hidden autosave file** — the per-mutation safety-copy sibling file is
  dot-prefixed (`.yourfile.ercbudget.autosave`), which hides it from
  Finder/Explorer's default view. Known limitation: if your Finder/Explorer
  is configured to show hidden files, this file is still visible — that's
  an OS-level setting the dot-prefix can't override. A fix that moves the
  autosave out of the project folder entirely is planned but not in this
  release.
- **Currency formatting** — `€ 12,345.67` throughout the Dashboard, Work
  Packages, Personnel, Partners, Travel, Equipment, Other Costs, and
  Subcontracting screens.
- **Content-Security-Policy** enforced at the webview level.

## Compatibility

- Requires a `.ercbudget` file produced by **ERC Budget v1.7.0 or later**
  (file format version `1.0` or `1.1`; ERC Execution upgrades either to
  `1.1` automatically the first time it saves).
- Opening a file for the first time in ERC Execution never modifies your
  planned budget data — it only adds a new, separate execution-tracking
  section. Older files without that section get sensible empty defaults.
  Files with no `partner_organizations` (any file saved before this
  release) simply start with an empty Partners list.
- Files remain fully readable in the Budget App after being opened and
  edited in ERC Execution — the Budget App simply ignores the
  execution-tracking section it doesn't understand.

## Known Limitations / Out of Scope

- **Partner actual cost is personnel-only** (see above) — the same
  limitation Work Package actual cost has always had.
- **Autosave file visibility** depends on the OS/Finder's own hidden-files
  setting (see above) — not yet fixed.
- Person-month tracking is per calendar month rather than per reporting
  period.
- Budget transfer flagging (>10% moved between categories) isn't
  implemented.
- Travel actual cost is user-entered, not rate-table-computed.
- Subcontracting's competitive-tender and host-institution checks are
  advisory only.
- Single-user only — no shared consortium workspace, no conflict
  resolution for concurrently-opened files (this now also applies to
  Partner Organization records, same as everything else in the file).
- V2 modules (Meeting Management, Action Item Tracker, Document
  Repository, Procurement Tracking, Excel Import) are out of scope for
  this release.

## Security

No change since v1.1.2 — see `security-review-m3.md`. No credentials are
stored anywhere and the app makes no network calls in normal operation.

## Upgrade Instructions

Install alongside your existing ERC Budget installation; the two apps are
independent and don't need to be the same version, as long as ERC Budget
is v1.7.0 or later. If you have v1.1.2 installed, this is a drop-in
replacement — no data migration involved.

## Feedback

Please report anything that looks wrong compared to your actual project
data, especially numbers that don't match what you see in the Budget App.
