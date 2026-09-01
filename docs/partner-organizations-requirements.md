# Partner Organizations — Functional & Technical Specification

**Status:** Proposed — not yet built
**Extends:** `execution-requirements.md`'s Module Catalogue, as **M-24 — Partner Organization Management**
**Date:** 2026-08-10

---

## 1. Purpose and Scope

ERC Execution currently has no concept of a **partner organization** (a Horizon Europe consortium beneficiary). `Person` records link to a `PersonnelRole` and carry a free-text `institution` field, but there's no structured entity to hang consortium-level facts on: who the coordinator is, which partners have signed the Grant Agreement, what each partner's budget share is, or how actual spend breaks down per partner rather than per cost category.

This module adds that entity and the minimum surrounding workflow to make it useful — without turning the app into a shared, multi-organization workspace. That distinction matters enough to state as a hard boundary:

> **This is consortium *data tracking*, not consortium *collaboration*.** Every `.ercbudget` file is still opened, edited, and saved locally by one person on one machine (the app's existing "Single-user only" limitation is unchanged). A Partner Organization here is a record the coordinator's own file keeps about a partner — not a live, shared view that partner edits themselves. A genuinely shared cross-organization workspace would need a server, accounts, and sync — a different product, not a module. (Worth noting: even HorizonFlow, a much larger commercial competitor, makes the identical scoping choice — their own FAQ states they support each organization's internal team, not a shared cross-consortium workspace.)

---

## 2. Design Principles (inherited)

Same governing principles as every other module in this app (`execution-requirements.md` §3):

- The Budget Application remains the sole source of truth for planned figures. This module adds a new *execution-side* entity; it does not touch `erc-core` or `erc-budget`.
- Every screen shows Planned vs. Actual where applicable — even though, per §5 below, "Actual" here is deliberately partial in V1.
- Auto-saved after every interaction, same as every other module.

---

## 3. Key Design Decision: Attribution Lives on `Person`, Not on `PersonnelRole`

`PersonnelRole` is Budget App data (read-only from this app's side, per `execution-architecture.md` §1). Adding a partner-organization field there would mean editing `erc-core`, which is shared with `erc-budget` — out of scope, and unnecessary.

`Person` is already an execution-only entity representing a real named individual doing the work. In practice a role slot can be filled by different people over its lifetime, but it's the *person*, not the abstract role, who actually belongs to an institution. `Person` already has a free-text `institution: Option<String>` field for exactly this idea — it's just not structured enough to aggregate or validate against.

**Decision:** add `Person.partner_organization_id: Option<Uuid>` (new, optional, `#[serde(default)]` — same backward-compatible pattern as every prior schema addition in this app, e.g. `Milestone.linked_deliverable_ids`). Leave `institution` untouched as a free-text fallback for anyone who doesn't want to set up a full Partner Organization record. Per-partner aggregation (§6) groups by this new field.

This keeps the whole feature execution-side and additive — zero changes to `erc-core`, zero changes to existing files' compatibility.

---

## 4. Data Model

### 4.1 New entity

```rust
// erc-execution/src-tauri/src/domain/execution_entities.rs

pub struct PartnerOrganization {
    pub id: Uuid,
    /// Full legal name. Required, unique within the project (BR-PO-02).
    pub name: String,
    /// Optional acronym, e.g. "KTH" — shown in tables where space is tight.
    pub short_name: Option<String>,
    pub country: String,
    /// EU Participant Identification Code, if known yet.
    pub pic_number: Option<String>,
    pub role: PartnerRole,
    pub contact_name: Option<String>,
    pub contact_email: Option<String>,
    pub validation_status: PartnerValidationStatus,
    pub grant_agreement_signed: bool,
    /// GA-agreed budget share in EUR. User-entered — there's no planned
    /// per-partner figure anywhere in the Budget App's data model to derive
    /// this from (see §6). `None` until the user fills it in.
    #[serde(default, with = "rust_decimal::serde::str_option")]
    pub planned_budget_share_eur: Option<Decimal>,
    pub notes: Option<String>,
}
```

### 4.2 New enums

```rust
// erc-execution/src-tauri/src/domain/enums.rs

pub enum PartnerRole {
    Coordinator,
    Beneficiary,
    AssociatedPartner,
}

pub enum PartnerValidationStatus {
    NotStarted,
    Pending,
    Validated,
}
```

### 4.3 Changed entity

```rust
pub struct Person {
    // ...existing fields unchanged...
    #[serde(default)]
    pub partner_organization_id: Option<Uuid>,
}
```

### 4.4 `ExecutionData` addition

```rust
pub struct ExecutionData {
    // ...existing fields...
    #[serde(default)]
    pub partner_organizations: Vec<PartnerOrganization>,
}
```

Format version stays `"1.1"` — this is an additive, backward-compatible change (`#[serde(default)]` on both the new `Vec` and the new `Person` field), the same category of change as every prior sprint's schema growth. No format bump needed, matching precedent (Sprint E2 through E5 additions never bumped format version either).

---

## 5. Business Rules

- `BR-PO-01`: At most one `PartnerOrganization` may have `role = Coordinator` at a time.
- `BR-PO-02`: `name` is required and must be unique within the project (case-insensitive).
- `BR-PO-03`: A `PartnerOrganization` cannot be deleted while any `Person` still has `partner_organization_id` pointing to it — the UI must show which people are linked and let the user reassign or clear them first, rather than silently orphaning the link.
- `BR-PO-04`: `Person.partner_organization_id`, if set, must reference an existing `PartnerOrganization`.
- `BR-PO-05`: A partner's actual cost (V1 scope) = sum of `salary_cost_estimate_eur` (already computed per `PersonMonthDetailDto`, see §6) across every approved person-month record for every `Person` linked to that partner. No new salary-projection logic — this reuses the existing per-record figure the Personnel screen already shows.
- `BR-PO-06` (advisory warning, not a hard block): flag a partner whose personnel-only actual exceeds its `planned_budget_share_eur` by more than 10% — worded as an advisory in the UI ("actual, personnel-only, exceeds declared share"), never implying it's the partner's true total spend.

---

## 6. Scope Narrowing: "Actual" Is Personnel-Only in V1

This mirrors an existing, explicit precedent: Work Package actual cost has been personnel-only since Sprint E2 ("Travel/equipment/other costs/subcontracting aren't currently allocated down to individual work packages" — `execution-requirements.md`'s own Known Limitations, still true today). Per-partner actuals hit the identical wall: `TripExecution`, `EquipmentProcurement`, `ActualCostEntry`, and `SubcontractingLine` have no WP attribution today, and would need one before they could have a *partner* attribution either (a partner doesn't file a trip directly — a trip is tied to a WP, and WPs aren't tied to partners in this data model).

**V1 scope:** partner actuals = personnel costs only, computed via `BR-PO-05` above, reusing `person_months` data the summary DTO already carries. The UI must label this clearly ("Actual (personnel only)") so nobody mistakes it for a partner's full spend.

**Explicitly deferred, not solved here:** allocating Travel/Equipment/Other Costs/Subcontracting to a partner. Doing that properly needs either (a) WP→Partner attribution plus reusing the existing WP-allocation engine, or (b) a direct `partner_organization_id` on each of those four entry types — a larger change touching four screens' forms, better scoped as its own follow-up once this module's core (the entity, the link, the personnel rollup) is in place and validated against a real consortium file.

---

## 7. DTOs and Commands

Follows the exact CRUD pattern already used by every comparable module (Risk Register is the closest precedent: a standalone list entity with no WP linkage, add/update/delete commands, one detail DTO).

```rust
// domain/dto.rs
pub struct PartnerOrganizationInputDto {
    pub name: String,
    pub short_name: Option<String>,
    pub country: String,
    pub pic_number: Option<String>,
    pub role: PartnerRole,
    pub contact_name: Option<String>,
    pub contact_email: Option<String>,
    pub validation_status: PartnerValidationStatus,
    pub grant_agreement_signed: bool,
    pub planned_budget_share_eur: Option<Decimal>,
    pub notes: Option<String>,
}

pub struct PartnerOrganizationDetailDto {
    pub id: Uuid,
    // ...same fields as input...
    /// Derived, BR-PO-05. `None` when there's no data to sum (not an error).
    pub actual_personnel_cost_eur: Decimal,
    /// Derived: how many `Person` records currently link to this partner —
    /// the UI uses this to explain a blocked delete (BR-PO-03) without a
    /// second round-trip.
    pub linked_person_count: u32,
    /// BR-PO-06.
    pub over_budget_warning: bool,
}
```

New commands (`commands/partner_organizations.rs`, registered in `lib.rs` next to the other CRUD command groups):

- `add_partner_organization(input: PartnerOrganizationInputDto) -> ExecutionProjectSummaryDto`
- `update_partner_organization(id: Uuid, input: PartnerOrganizationInputDto) -> ExecutionProjectSummaryDto`
- `delete_partner_organization(id: Uuid) -> ExecutionProjectSummaryDto` — returns `AppError` when BR-PO-03 blocks it, same error-surfacing convention as every other guarded delete in this app.

`PersonInputDto`/`PersonDetailDto` gain the new optional `partner_organization_id` field (plus, on the detail DTO, a resolved `partner_organization_name: Option<String>` for display — same convention as the existing `linked_role_label`).

`ExecutionProjectSummaryDto` gains `partner_organizations: Vec<PartnerOrganizationDetailDto>`.

A small new engine function (`engines/consortium_engine.rs`, mirroring the shape of `risk_engine.rs`) computes the BR-PO-05 rollup: group the already-built `person_months` list by each person's `partner_organization_id`, sum `salary_cost_estimate_eur`. No salary math is duplicated — it's pure aggregation over data `build_summary` already produces.

---

## 8. UI

### 8.1 New sidebar entry: "Partners"

A list screen, same table+add-form layout as Risk Register:

| Column | Notes |
|---|---|
| Name | short_name shown as a subtitle if set |
| Role | Coordinator badge visually distinct (matches how WP status badges work) |
| Country | |
| Validation | NotStarted / Pending / Validated, same badge language as other status enums |
| GA Signed | checkmark or dash |
| Planned Share | € formatted, `fmtEur()` |
| Actual (personnel only) | € formatted, with the over-budget warning icon per BR-PO-06 when triggered |

Add/Edit form: same fields as `PartnerOrganizationInputDto`, plain controlled inputs (no react-hook-form/zod — matches the rest of this app's forms).

Delete: if `linked_person_count > 0`, disable the delete action and show which people are linked (name + link to Personnel screen) instead of letting the click fail with a raw error.

### 8.2 Personnel screen change

The existing Person add/edit form gains one new optional dropdown, "Partner Organization," sourced from `partner_organizations`, positioned right after `institution` (both describe organizational affiliation; keeping them adjacent make the free-text-vs-structured relationship visually obvious).

### 8.3 Dashboard change

New panel, "Consortium," directly under the existing Planned vs. Actual table (same visual rhythm as the rest of the Dashboard):

- Partner count, validation summary ("4/6 validated")
- A compact per-partner table: name, planned share, actual (personnel only), variance — the same shape as the Category table already there, just keyed by partner instead of by A/B/C1/C2/C3/E.

No new warning-tray codes in V1 — BR-PO-06 surfaces only inline on the Partners screen and Dashboard panel, not in the `NotificationTray`. (Worth revisiting once the module has real usage data; every existing warning code required a concrete business rule with a real navigation target, and "over declared share, personnel-only" is arguably too partial a signal to page someone about yet.)

---

## 9. Validation

- `name`: required, non-empty, unique (case-insensitive) within `partner_organizations`.
- `country`: required, non-empty.
- `role = Coordinator`: at most one across the whole list (BR-PO-01) — checked the same way `validate_risk_entry`'s `existing_status` pattern checks state transitions, by passing the full current list plus an optional "excludeSelf" id for updates.
- `contact_email`: if present, must look like an email (same lightweight check already used wherever this app validates email — `Person.email` is the existing precedent, itself unvalidated beyond non-empty; match that precedent rather than inventing stricter email validation here).
- `planned_budget_share_eur`: if present, must be ≥ 0.
- Delete guard: BR-PO-03, enforced server-side (not just UI-disabled) — same "don't trust the frontend to be the only gate" posture as every other guarded mutation in this app.

---

## 10. Out of Scope (explicitly, for this module)

- Any real-time or shared multi-user consortium workspace (§1 — different product).
- Allocating Travel/Equipment/Other Costs/Subcontracting to a partner (§6 — deferred follow-up).
- Consortium meeting log / action items (a separate idea from the original research pass; not part of this module).
- Document/file attachments on a partner record (separate module already flagged — file attachments generally, not partner-specific).
- Partner-facing exports (e.g., a partner-specific Excel sheet) — `excelExporter.ts` could grow a 6th export type later, but that's an independent addition once the underlying data exists and has been used for a while.

---

## 11. Suggested Build Order

Matches how every prior sprint in this app has been sequenced (data model → validation → engine → commands → frontend, each step tested before the next):

1. `PartnerOrganization`/`PartnerRole`/`PartnerValidationStatus` + `Person.partner_organization_id`, `ExecutionData.partner_organizations` — pure data model, backward-compat roundtrip tests (same shape as every prior entity-addition sprint's persistence tests).
2. `validate_partner_organization` (BR-PO-01/02/03/04) — unit tests per rule, same style as `validation::tests`.
3. `consortium_engine::calculate_partner_actual_personnel_eur` (BR-PO-05) — unit tests against a small synthetic person/partner set.
4. `commands/partner_organizations.rs` + DTO wiring + `Person` DTO changes — the CRUD layer, no new logic beyond what's already been tested in steps 2–3.
5. Frontend: Partners screen, Personnel form dropdown, Dashboard panel — verified in a live browser preview per this project's usual mock-data-injection technique, then (once you're ready to see it for real) a real local build against an actual multi-partner `.ercbudget` file.

Each step should land as its own reviewable commit, same granularity as Sprint E2 through E7 in this app's history.
