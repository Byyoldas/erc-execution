//! Execution-specific domain entities, stored opaquely (as JSON) inside the
//! shared `.ercbudget` file's `execution_data` block (see
//! `erc_core::persistence::ProjectFile`). Grows with each Sprint E2–E5 module.
//!
//! Sprint E2 scope note: `PersonMonthRecord` tracks by calendar `project_month`
//! rather than by "reporting period" (`docs/executer/execution-requirements.md`
//! BR-PM-02/03/05 are written in terms of periods). Now that Sprint E4 builds
//! Reporting Period Management (M-14), the underlying period entity exists,
//! but `PersonMonthRecord` itself is left untouched — re-expressing BR-PM-05's
//! tolerance check per-period instead of per-month would require rewriting
//! `validate_person_month_record`'s call sites across the Personnel screen and
//! isn't part of M-05/M-14's own scope; still per-month for now.

use super::enums::{
    AmendmentStatus, AmendmentType, CostCategory, DeliverableStatus, DeliverableType,
    DisseminationLevel, EntryStatus, FundingModel, IssueStatus, Level, MilestoneStatus,
    PartnerRole, PartnerValidationStatus, ReportingPeriodStatus, RiskStatus,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// All execution-tracking state for one project. `Default` is used both for
/// brand-new (never-opened-in-Execution-App) projects and as the schema
/// anchor for future migrations.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExecutionData {
    pub schema_version: String,
    #[serde(default)]
    pub persons: Vec<Person>,
    #[serde(default)]
    pub person_month_records: Vec<PersonMonthRecord>,
    #[serde(default)]
    pub work_package_executions: Vec<WorkPackageExecution>,
    #[serde(default)]
    pub milestones: Vec<Milestone>,
    #[serde(default)]
    pub amendments: Vec<Amendment>,
    #[serde(default)]
    pub trip_executions: Vec<TripExecution>,
    #[serde(default)]
    pub equipment_procurements: Vec<EquipmentProcurement>,
    #[serde(default)]
    pub actual_cost_entries: Vec<ActualCostEntry>,
    #[serde(default)]
    pub subcontracting_lines: Vec<SubcontractingLine>,
    #[serde(default)]
    pub deliverables: Vec<Deliverable>,
    #[serde(default)]
    pub reporting_periods: Vec<ReportingPeriod>,
    #[serde(default)]
    pub risks: Vec<RiskEntry>,
    #[serde(default)]
    pub issues: Vec<IssueEntry>,
    #[serde(default)]
    pub partner_organizations: Vec<PartnerOrganization>,
    /// M-25. `Erc` for every file saved before this field existed.
    #[serde(default)]
    pub funding_model: FundingModel,
    /// M-25 (actual-cost model): planned eligible cost per partner per
    /// category. Never holds the own organization's figures -- those are
    /// derived from the Budget file each time (BR-CB-02).
    #[serde(default)]
    pub partner_budget_lines: Vec<PartnerBudgetLine>,
    /// M-25 (lump-sum model): planned lump-sum share per work package per
    /// partner.
    #[serde(default)]
    pub lump_sum_shares: Vec<LumpSumShare>,
}

impl Default for ExecutionData {
    fn default() -> Self {
        Self {
            schema_version: "1.0".to_string(),
            persons: Vec::new(),
            person_month_records: Vec::new(),
            work_package_executions: Vec::new(),
            milestones: Vec::new(),
            amendments: Vec::new(),
            trip_executions: Vec::new(),
            equipment_procurements: Vec::new(),
            actual_cost_entries: Vec::new(),
            subcontracting_lines: Vec::new(),
            deliverables: Vec::new(),
            risks: Vec::new(),
            issues: Vec::new(),
            reporting_periods: Vec::new(),
            partner_organizations: Vec::new(),
            funding_model: FundingModel::default(),
            partner_budget_lines: Vec::new(),
            lump_sum_shares: Vec::new(),
        }
    }
}

/// A named individual linked to a planned `PersonnelRole` (M-03).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Person {
    pub id: Uuid,
    pub full_name: String,
    pub email: Option<String>,
    pub institution: Option<String>,
    pub orcid: Option<String>,
    /// References `erc_core::domain::entities::PersonnelRole.id`. BR-PM-01:
    /// at most one `Person` may link to a given role at a time — enforced by
    /// `validation::validate_person`.
    pub linked_role_id: Uuid,
    pub actual_start_date: String,
    pub actual_end_date: Option<String>,
    /// References `PartnerOrganization.id` (M-24). Deliberately separate
    /// from the free-text `institution` above rather than replacing it —
    /// `institution` stays as an always-available fallback for anyone who
    /// hasn't set up a full Partner Organization record yet. See
    /// `docs/partner-organizations-requirements.md` §3 for why this link
    /// lives on `Person` rather than on `PersonnelRole`.
    #[serde(default)]
    pub partner_organization_id: Option<Uuid>,
}

/// One calendar project-month's reported/approved FTE-months for a person
/// (M-03). See the module-level note on the period-vs-month scoping decision.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PersonMonthRecord {
    pub id: Uuid,
    pub person_id: Uuid,
    pub project_month: u32,
    /// BR-PM-03: must be ≤ 1.0 (full-time-equivalent cap for one calendar month).
    #[serde(with = "rust_decimal::serde::str")]
    pub reported_months: Decimal,
    /// BR-PM-04: must be ≤ `reported_months`.
    #[serde(default, with = "rust_decimal::serde::str_option")]
    pub approved_months: Option<Decimal>,
}

/// Execution-side data attached to a Budget App work package. The WP's
/// identity, dates, and planned budget are read-only, sourced from
/// `ProjectConfig`/`BudgetSummaryDto`; this only carries what the Execution
/// App itself adds (M-04).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WorkPackageExecution {
    pub work_package_id: u8,
    /// References `erc_core::domain::entities::PersonnelRole.id`.
    pub leader_role_id: Option<Uuid>,
    pub notes: Option<String>,
}

/// A project milestone (M-06). `status` is user-settable and never stores
/// `AtRisk` directly — see `enums::MilestoneStatus` and
/// `progress_engine::derive_milestone_status`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Milestone {
    pub id: Uuid,
    pub title: String,
    pub work_package_id: u8,
    pub planned_month: u32,
    pub status: MilestoneStatus,
    pub actual_completion_month: Option<u32>,
    /// References `Deliverable.id` (M-05, added Sprint E4). BR-MS-02: a
    /// milestone can only be marked `Completed` once every linked
    /// deliverable is `Accepted` — see
    /// `progress_engine::validate_milestone_completion`.
    #[serde(default)]
    pub linked_deliverable_ids: Vec<Uuid>,
}

/// A formal Horizon Europe grant amendment (scope, budget, duration, or
/// personnel change). See `enums::AmendmentType`/`AmendmentStatus` doc
/// comments for why this module was designed from scratch.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Amendment {
    pub id: Uuid,
    /// Sequential, immutable once assigned: "AMD-1", "AMD-2", ... — see
    /// `commands::amendments::record_amendment`.
    pub amendment_number: String,
    pub amendment_type: AmendmentType,
    pub title: String,
    pub description: String,
    pub requested_date: String,
    pub decision_date: Option<String>,
    pub status: AmendmentStatus,
    /// Informational only — logged for audit purposes. Never modifies
    /// `BudgetSummaryDto`; the Budget App remains the sole source of truth
    /// for planned figures (see `execution-architecture.md` §1 "Independence").
    #[serde(default, with = "rust_decimal::serde::str_option")]
    pub financial_impact_eur: Option<Decimal>,
    #[serde(default)]
    pub affected_work_package_ids: Vec<u8>,
    pub notes: Option<String>,
}

/// One actual travel instance against a planned `erc_core::domain::entities::Trip`
/// (M-08). BR-TR-01: one `TripExecution` per instance of a planned trip.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TripExecution {
    pub id: Uuid,
    /// References `erc_core::domain::entities::Trip.id`.
    pub trip_id: Uuid,
    /// 1-indexed; unique per `trip_id` (validated, not type-enforced).
    pub instance_number: u32,
    /// References `Person.id` — BR-TR-06.
    pub traveller_person_id: Uuid,
    pub actual_travel_date: String,
    #[serde(with = "rust_decimal::serde::str")]
    pub actual_cost_eur: Decimal,
    /// BR-TR-05: only `Approved` entries count toward Category C1 actuals.
    pub status: EntryStatus,
}

/// An actual equipment purchase against a planned `erc_core::domain::entities::EquipmentItem`
/// (M-09).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EquipmentProcurement {
    pub id: Uuid,
    /// References `erc_core::domain::entities::EquipmentItem.id`.
    pub equipment_item_id: Uuid,
    #[serde(with = "rust_decimal::serde::str")]
    pub actual_purchase_cost_eur: Decimal,
    pub purchase_date: String,
    /// BR-EQ-04: excluded from actuals until `true`.
    pub delivery_confirmed: bool,
}

/// A Category C3 (Other Direct Costs) actual expenditure (M-10). May link to
/// a planned `OtherDirectCostItem`, or stand alone as an unbudgeted item
/// (BR-OC-03, which then requires `justification`).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ActualCostEntry {
    pub id: Uuid,
    /// References `erc_core::domain::entities::OtherDirectCostItem.id`, if any.
    pub linked_entity_id: Option<Uuid>,
    #[serde(with = "rust_decimal::serde::str")]
    pub amount_eur: Decimal,
    pub description: String,
    pub incurred_date: String,
    pub status: EntryStatus,
    /// Required when `linked_entity_id` is `None` (BR-OC-03).
    pub justification: Option<String>,
}

/// An actual subcontracting contract line against the project's single
/// planned `Subcontracting` lump sum (M-11).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SubcontractingLine {
    pub id: Uuid,
    pub vendor: String,
    pub contract_reference: String,
    #[serde(with = "rust_decimal::serde::str")]
    pub amount_eur: Decimal,
    pub work_package_id: u8,
    pub status: EntryStatus,
    /// BR-SC-04 advisory check input (self-declared — the app has no
    /// external institution registry to verify this against).
    pub vendor_is_host_institution: bool,
    pub payment_date: Option<String>,
}

/// A project deliverable (M-05). `deliverable_number` follows BR-DEL-02's
/// `D{wp_id}.{sequence}` format, server-assigned and immutable once created —
/// see `commands::deliverables::next_deliverable_number`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Deliverable {
    pub id: Uuid,
    pub deliverable_number: String,
    pub title: String,
    pub deliverable_type: DeliverableType,
    pub work_package_id: u8,
    pub planned_month: u32,
    /// References `erc_core::domain::entities::PersonnelRole.id`.
    pub responsible_role_id: Uuid,
    pub dissemination_level: DisseminationLevel,
    pub status: DeliverableStatus,
    pub actual_submission_date: Option<String>,
    /// BR-DEL-03: required when `status` is `Rejected`.
    pub revision_note: Option<String>,
    /// BR-DEL-03: required when `status` is `Rejected`.
    pub revised_planned_month: Option<u32>,
    /// BR-DEL-04 advisory input, self-declared (the app has no CORDIS API
    /// integration — see M-05's "Future Extensions").
    pub cordis_registered: bool,
    pub notes: Option<String>,
}

/// A project reporting period (M-14). BR-RP-05's ERC CoG defaults are
/// pre-populated on project open by
/// `engines::reporting_period_engine::generate_default_reporting_periods`
/// when this list is empty.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ReportingPeriod {
    pub id: Uuid,
    pub period_number: u32,
    pub start_month: u32,
    pub end_month: u32,
    /// `None` until the PI sets a real deadline — same "skip until a
    /// calendar anchor is known" precedent as BR-PM-06 (see
    /// `validation::validate_person`), since the auto-populated defaults
    /// have no deadline computation specified anywhere in the docs.
    pub submission_deadline: Option<String>,
    pub technical_report_submitted: bool,
    pub financial_report_submitted: bool,
    /// BR-RP-03: can only become `Submitted` once both flags above are set.
    pub status: ReportingPeriodStatus,
}

/// A project risk (M-12). `probability`/`impact` combine into a derived
/// `risk_score`/priority — see `engines::risk_engine`. BR-RK-04: once
/// `Closed`, terminal (enforced by `validation::validate_risk_entry`).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RiskEntry {
    pub id: Uuid,
    pub title: String,
    pub description: String,
    pub work_package_id: Option<u8>,
    pub probability: Level,
    pub impact: Level,
    pub mitigation: Option<String>,
    pub status: RiskStatus,
    /// References `erc_core::domain::entities::PersonnelRole.id`.
    pub owner_role_id: Option<Uuid>,
    pub identified_date: String,
    /// BR-RK-03: required, and must be within 30 days of today, once this
    /// risk's derived priority is `High`.
    pub review_date: Option<String>,
    pub closed_date: Option<String>,
}

/// A project issue (M-13). BR-IS-01: `Closed` requires `resolution`.
/// BR-IS-03: may optionally reference a `RiskEntry` it manifested from.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct IssueEntry {
    pub id: Uuid,
    pub description: String,
    pub work_package_id: Option<u8>,
    pub raised_date: String,
    pub priority: Level,
    /// References `erc_core::domain::entities::PersonnelRole.id`.
    pub owner_role_id: Option<Uuid>,
    pub status: IssueStatus,
    pub resolution: Option<String>,
    /// References `RiskEntry.id`.
    pub linked_risk_id: Option<Uuid>,
}

/// A Horizon Europe consortium beneficiary (M-24). Tracked entirely
/// execution-side — see `docs/partner-organizations-requirements.md` §1 for
/// why this is consortium *data tracking*, not a shared cross-organization
/// workspace.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PartnerOrganization {
    pub id: Uuid,
    /// Required, unique within the project (case-insensitive) — BR-PO-02.
    pub name: String,
    pub short_name: Option<String>,
    pub country: String,
    /// EU Participant Identification Code, if known yet.
    pub pic_number: Option<String>,
    /// BR-PO-01: at most one `PartnerOrganization` may be `Coordinator`.
    pub role: PartnerRole,
    pub contact_name: Option<String>,
    pub contact_email: Option<String>,
    pub validation_status: PartnerValidationStatus,
    pub grant_agreement_signed: bool,
    /// GA-agreed budget share in EUR, user-entered — there's no per-partner
    /// planned figure anywhere in the Budget App's own data model to derive
    /// this from (see requirements doc §6). `None` until filled in.
    #[serde(default, with = "rust_decimal::serde::str_option")]
    pub planned_budget_share_eur: Option<Decimal>,
    pub notes: Option<String>,
    /// M-25, BR-PO-07: marks the one partner that is the user's own
    /// organization -- the one whose planned figures come from the Budget
    /// file rather than being entered here.
    #[serde(default)]
    pub is_own_organization: bool,
    /// M-25, BR-PO-08: EU funding rate, 0-100. `None` means 100.
    #[serde(default, with = "rust_decimal::serde::str_option")]
    pub funding_rate_pct: Option<Decimal>,
}

/// M-25: one partner's planned eligible cost in one category (actual-cost
/// model). Unique per `(partner_id, category)` -- upsert semantics, enforced
/// by `commands::consortium::set_partner_budget_amount`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PartnerBudgetLine {
    pub id: Uuid,
    /// References `PartnerOrganization.id`.
    pub partner_id: Uuid,
    pub category: CostCategory,
    /// BR-CB-01: always > 0 -- a zero amount removes the line instead.
    #[serde(with = "rust_decimal::serde::str")]
    pub amount_eur: Decimal,
}

/// M-25: one partner's planned lump-sum share of one work package (lump-sum
/// model). Unique per `(work_package_id, partner_id)` -- upsert semantics.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LumpSumShare {
    pub id: Uuid,
    pub work_package_id: u8,
    /// References `PartnerOrganization.id`.
    pub partner_id: Uuid,
    /// BR-LS-01: always > 0 -- a zero amount removes the share instead.
    #[serde(with = "rust_decimal::serde::str")]
    pub amount_eur: Decimal,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_sets_schema_version_and_empty_collections() {
        let data = ExecutionData::default();
        assert_eq!(data.schema_version, "1.0");
        assert!(data.persons.is_empty());
        assert!(data.person_month_records.is_empty());
        assert!(data.work_package_executions.is_empty());
        assert!(data.milestones.is_empty());
        assert!(data.amendments.is_empty());
        assert!(data.trip_executions.is_empty());
        assert!(data.equipment_procurements.is_empty());
        assert!(data.actual_cost_entries.is_empty());
        assert!(data.subcontracting_lines.is_empty());
        assert!(data.deliverables.is_empty());
        assert!(data.reporting_periods.is_empty());
        assert!(data.risks.is_empty());
        assert!(data.issues.is_empty());
        assert!(data.partner_organizations.is_empty());
        assert_eq!(data.funding_model, FundingModel::Erc);
        assert!(data.partner_budget_lines.is_empty());
        assert!(data.lump_sum_shares.is_empty());
    }

    #[test]
    fn test_pre_m25_json_loads_as_erc_with_no_consortium_budget() {
        // A file saved before M-25 has none of the three new top-level
        // fields -- BR-FM-01: it must open as a plain ERC project.
        let json = r#"{"schema_version":"1.0","partner_organizations":[]}"#;
        let data: ExecutionData = serde_json::from_str(json).unwrap();
        assert_eq!(data.funding_model, FundingModel::Erc);
        assert!(data.partner_budget_lines.is_empty());
        assert!(data.lump_sum_shares.is_empty());
    }

    #[test]
    fn test_pre_m25_partner_json_loads_with_new_fields_defaulted() {
        // A partner saved by the M-24 build has neither new field.
        let json = r#"{
            "id": "11111111-1111-4111-8111-111111111111",
            "name": "KTH",
            "short_name": null,
            "country": "Sweden",
            "pic_number": null,
            "role": "Beneficiary",
            "contact_name": null,
            "contact_email": null,
            "validation_status": "NotStarted",
            "grant_agreement_signed": false,
            "planned_budget_share_eur": null,
            "notes": null
        }"#;
        let partner: PartnerOrganization = serde_json::from_str(json).unwrap();
        assert!(!partner.is_own_organization);
        assert_eq!(partner.funding_rate_pct, None);
    }

    #[test]
    fn test_funding_model_serialises_as_variant_name() {
        assert_eq!(
            serde_json::to_string(&FundingModel::HorizonActualCost).unwrap(),
            "\"HorizonActualCost\""
        );
        assert_eq!(
            serde_json::from_str::<FundingModel>("\"HorizonLumpSum\"").unwrap(),
            FundingModel::HorizonLumpSum
        );
    }

    #[test]
    fn test_cost_category_serialises_and_sorts_in_budget_table_order() {
        assert_eq!(serde_json::to_string(&CostCategory::C1).unwrap(), "\"C1\"");
        let mut shuffled = vec![
            CostCategory::E,
            CostCategory::A,
            CostCategory::C2,
            CostCategory::D,
        ];
        shuffled.sort();
        assert_eq!(
            shuffled,
            vec![
                CostCategory::A,
                CostCategory::C2,
                CostCategory::D,
                CostCategory::E
            ]
        );
        assert_eq!(CostCategory::ALL.len(), 7);
    }

    #[test]
    fn test_consortium_planning_entities_roundtrip() {
        use rust_decimal_macros::dec;

        let partner_id = Uuid::new_v4();
        let mut data = ExecutionData {
            funding_model: FundingModel::HorizonActualCost,
            ..ExecutionData::default()
        };
        data.partner_budget_lines.push(PartnerBudgetLine {
            id: Uuid::new_v4(),
            partner_id,
            category: CostCategory::C2,
            amount_eur: dec!(12345.67),
        });
        data.lump_sum_shares.push(LumpSumShare {
            id: Uuid::new_v4(),
            work_package_id: 3,
            partner_id,
            amount_eur: dec!(80000),
        });

        let json = serde_json::to_string(&data).unwrap();
        let reloaded: ExecutionData = serde_json::from_str(&json).unwrap();
        assert_eq!(data, reloaded);
    }

    #[test]
    fn test_serde_roundtrip() {
        let data = ExecutionData::default();
        let json = serde_json::to_string(&data).unwrap();
        let reloaded: ExecutionData = serde_json::from_str(&json).unwrap();
        assert_eq!(data, reloaded);
    }

    #[test]
    fn test_sprint_e1_era_json_without_new_fields_still_deserialises() {
        // A file saved by the Sprint E1 build of erc-execution only ever had
        // `schema_version` — confirms the new `#[serde(default)]` fields
        // don't break loading those files.
        let json = r#"{"schema_version":"1.0"}"#;
        let data: ExecutionData = serde_json::from_str(json).unwrap();
        assert_eq!(data, ExecutionData::default());
    }

    #[test]
    fn test_person_json_without_partner_organization_id_still_deserialises() {
        // A Person saved before M-24 existed never had this field at all --
        // confirms #[serde(default)] loads it as None rather than failing.
        let json = r#"{
            "id": "11111111-1111-4111-8111-111111111111",
            "full_name": "Ada Lovelace",
            "email": null,
            "institution": null,
            "orcid": null,
            "linked_role_id": "22222222-2222-4222-8222-222222222222",
            "actual_start_date": "2026-01-01",
            "actual_end_date": null
        }"#;
        let person: Person = serde_json::from_str(json).unwrap();
        assert_eq!(person.partner_organization_id, None);
    }

    #[test]
    fn test_partner_organization_roundtrip() {
        use super::super::enums::{PartnerRole, PartnerValidationStatus};
        use rust_decimal_macros::dec;

        let partner = PartnerOrganization {
            id: Uuid::new_v4(),
            name: "KTH Royal Institute of Technology".to_string(),
            short_name: Some("KTH".to_string()),
            country: "Sweden".to_string(),
            pic_number: Some("999977980".to_string()),
            role: PartnerRole::Beneficiary,
            contact_name: Some("Prof. Marcus Lindberg".to_string()),
            contact_email: Some("marcus@kth.se".to_string()),
            validation_status: PartnerValidationStatus::Validated,
            grant_agreement_signed: true,
            planned_budget_share_eur: Some(dec!(450000)),
            notes: None,
            is_own_organization: false,
            funding_rate_pct: None,
        };

        let json = serde_json::to_string(&partner).unwrap();
        let reloaded: PartnerOrganization = serde_json::from_str(&json).unwrap();
        assert_eq!(partner, reloaded);
    }
}
