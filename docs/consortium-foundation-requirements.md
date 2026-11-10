# Consortium Foundation (Phase 0) — Functional & Technical Specification

**Status:** Built (v1.2.0 candidate)
**Extends:** `partner-organizations-requirements.md` (M-24), as **M-25 — Funding Model & Consortium Planned Budget**
**Date:** 2026-11-10

---

## 1. Purpose and Scope

The app was built around one ERC grant: one `.ercbudget` file, one organization, one funding model. The PI now also manages **Horizon Europe collaborative projects** — some **actual-cost**, some **lump-sum** — where the project is a consortium and the Budget file describes *only the PI's own organization*.

Phase 0 is the foundation every later consortium feature (partner cost collection, financial statements, payments, reports) depends on. It does three things:

1. Lets a project declare its **funding model**, and shows model-specific screens.
2. Lets the user mark **which partner is their own organization**, so the Budget file's figures are understood as that partner's.
3. Captures the **planned budget of every other partner** — per cost category (actual-cost) or per work package (lump-sum).

It is still consortium *data tracking* by one person on one machine (see `partner-organizations-requirements.md` §1 — unchanged).

**Explicitly out of scope (later phases):** other partners' *actual* costs, partner data packs, financial statements, payment ledger, periodic reports, lump-sum completion tracking.

---

## 2. Design Principles (inherited, plus two)

- The Budget file stays the source of truth for the **own organization's** planned figures. Nothing here writes to it (the one exception remains `project_start_date`). Zero changes to `erc-core` or `erc-budget`.
- Additive and backward compatible: every new field is `#[serde(default)]`; existing files open unchanged and behave exactly as before.
- **New:** *No duplicated truth.* The own organization's planned row is **derived** from the Budget file each time, never stored in execution data.
- **New:** *Hide, don't delete.* Switching funding model changes which screens are shown, never which data exists.

---

## 3. Key Design Decision: Other Partners' Costs Are Entered as Figures, Not Attributed to Entities

An earlier outline proposed adding `partner_id` to trips, equipment, other-cost and subcontracting entries. That is the wrong shape: those entities exist to track **the own organization's** spending against **planned items in its own Budget file** (a trip links to a planned `Trip`, equipment to a planned `EquipmentItem`). Another partner's costs have no such planned items here.

**Decision:**
- The own organization's actuals keep flowing through the existing trackers, untouched.
- Other partners are represented by **per-category figures** (planned now; actuals in Phase C, entered per reporting period — which is also how a coordinator actually receives them: as partner financial statements).

This is simpler, matches reality, and needs no changes to four existing screens.

---

## 4. Data Model

### 4.1 New enums (`domain/enums.rs`)

```rust
pub enum FundingModel {
    Erc,                 // default — the app exactly as it is today
    HorizonActualCost,
    HorizonLumpSum,
}

/// Horizon Europe actual-cost budget categories. A–C3 and E match the
/// Budget App's own categories; D (other cost categories) exists only for
/// consortium partners.
pub enum CostCategory { A, B, C1, C2, C3, D, E }
```

### 4.2 New entities (`domain/execution_entities.rs`)

```rust
/// One partner's planned eligible cost in one category (actual-cost model).
/// At most one per (partner_id, category) — upsert semantics.
pub struct PartnerBudgetLine {
    pub id: Uuid,
    pub partner_id: Uuid,
    pub category: CostCategory,
    pub amount_eur: Decimal,            // ≥ 0
}

/// One partner's planned lump-sum share of one work package (lump-sum model).
/// At most one per (work_package_id, partner_id) — upsert semantics.
pub struct LumpSumShare {
    pub id: Uuid,
    pub work_package_id: u8,
    pub partner_id: Uuid,
    pub amount_eur: Decimal,            // ≥ 0
}
```

### 4.3 Changed entities

```rust
pub struct ExecutionData {
    // ...existing...
    #[serde(default)] pub funding_model: FundingModel,      // Default = Erc
    #[serde(default)] pub partner_budget_lines: Vec<PartnerBudgetLine>,
    #[serde(default)] pub lump_sum_shares: Vec<LumpSumShare>,
}

pub struct PartnerOrganization {
    // ...existing...
    /// Marks the partner whose planned figures come from the Budget file.
    #[serde(default)] pub is_own_organization: bool,
    /// EU funding rate for this partner, 0–100. `None` = 100 (RIA/CSA
    /// default; IA non-profits also 100, IA for-profits typically 70).
    #[serde(default, with = "rust_decimal::serde::str_option")]
    pub funding_rate_pct: Option<Decimal>,
}
```

File format version stays `"1.1"` (additive only — same precedent as every prior sprint).

---

## 5. Business Rules

- `BR-FM-01`: `funding_model` defaults to `Erc`. Changing it never deletes or alters any data (hide, don't delete).
- `BR-PO-07`: At most one `PartnerOrganization` may have `is_own_organization = true`.
- `BR-PO-08`: `funding_rate_pct`, if set, must be within 0–100.
- `BR-PO-09`: Deleting a partner also deletes its `PartnerBudgetLine`s and `LumpSumShare`s (they are owned data). Linked persons still block deletion (BR-PO-03 unchanged).
- `BR-CB-01`: `PartnerBudgetLine.amount_eur` ≥ 0; the partner must exist. Setting an amount of zero or `None` removes the line.
- `BR-CB-02`: The own organization's budget lines **cannot be edited** — its row is derived from the Budget file (error `OWN_ORG_FROM_BUDGET_FILE`).
- `BR-LS-01`: `LumpSumShare.amount_eur` ≥ 0; the partner must exist; `work_package_id` must be one of the project's work packages. Zero/`None` removes the share.
- `BR-LS-02`: The own organization's lump-sum shares **are** entered manually (the Budget file has no lump-sum structure).

---

## 6. Derived Figures (`engines/consortium_engine.rs`)

**Actual-cost consortium budget** — per partner: amount per category (A, B, C1, C2, C3, D, E), `total_eligible_eur`, `funding_rate_pct` (effective, default 100), `requested_eu_contribution_eur`.
- Own organization's row: categories from `BudgetSummaryDto.category_*_total` (D = 0), contribution from `requested_eu_contribution`; `source = BudgetFile`.
- Other partners: from `partner_budget_lines`; contribution = `total_eligible × rate / 100`; `source = Entered`.
- Plus a **consortium totals** row (sum of every partner row).

**Lump-sum plan** — per work package: share per partner and WP total; per-partner totals; grand total. WP names come from the Budget file's work packages.

**Indirect costs (E)** are *entered*, exactly as listed in the Grant Agreement's budget table. No 25% auto-calculation or consistency check in Phase 0 — that needs verification against the current Model Grant Agreement and belongs to Phase C.

---

## 7. DTOs and Commands

`PartnerOrganizationInputDto`/`DetailDto` gain `is_own_organization` and `funding_rate_pct` (input fields `#[serde(default)]` so older frontends still deserialise).

`ExecutionProjectSummaryDto` gains `funding_model`, `consortium_budget: ConsortiumBudgetDto`, `lump_sum_plan: LumpSumPlanDto` (both always computed; the UI shows the relevant one).

New commands, all returning `ExecutionProjectSummaryDto`, all auto-saving:

| Command | Effect |
|---|---|
| `set_funding_model(model)` | BR-FM-01 |
| `set_partner_budget_amount(partner_id, category, amount: Option<Decimal>)` | Upsert / remove one cell (BR-CB-01/02) |
| `set_lump_sum_share(work_package_id, partner_id, amount: Option<Decimal>)` | Upsert / remove one cell (BR-LS-01) |

Existing partner add/update commands carry the two new partner fields. `delete_partner_organization` additionally cascades (BR-PO-09).

---

## 8. UI

- **Dashboard:** a *Funding Model* selector beside Project Start Date, with a one-line description of each model. The Consortium panel's *Planned Share* column uses the effective planned total for the active model (budget-lines total, lump-sum total, or the legacy `planned_budget_share_eur` for ERC).
- **Partners screen:** adds an *Own organization* checkbox and a *Funding rate (%)* field to the form; the table marks the own organization.
- **New screen — Consortium Budget** (only when `HorizonActualCost`): partners × categories matrix. Own-organization row read-only and labelled "from Budget file"; other rows editable cells; totals row and requested-EU-contribution column. A notice appears if no partner is marked as own organization.
- **New screen — Lump Sum Plan** (only when `HorizonLumpSum`): work packages × partners matrix with row and column totals; all cells editable.
- **Sidebar:** the new screens appear directly after *Partners* (dependency order — budgets need partners first), only for their funding model.
- `ERC` projects see no change at all.

---

## 9. Open Assumptions (flag if wrong)

1. **Work packages:** lump-sum shares reference the work packages declared in the Budget file (`work_package_count`). If a consortium's Grant Agreement has more WPs than the Budget file declares, the count must be raised there first. A separate execution-side WP list can be added later if this proves painful.
2. **Own organization in lump-sum projects:** its share per WP is entered by hand like everyone else's.
3. **`planned_budget_share_eur`** (M-24) stays untouched and is still used by ERC projects and by BR-PO-06's personnel warning. Re-basing that warning onto category A is deferred to Phase C.

---

## 10. Suggested Build Order

1. Data model + enums + backward-compat roundtrip tests.
2. Validation (BR-FM/PO/CB/LS) — unit tests per rule.
3. `consortium_engine` derivations — unit tests on small synthetic consortia.
4. DTOs + commands + cascade delete + `build_summary` wiring.
5. Frontend: types, IPC, Dashboard selector, Partners fields, two new screens, conditional sidebar, manual.
6. Live verification (mock-data injection) then a real local build for the user to test on actual projects.

Each step lands as its own commit.
