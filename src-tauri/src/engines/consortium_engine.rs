//! Partner Organization Management (M-24) derivation.

use crate::domain::dto::{
    BudgetRowSource, ConsortiumBudgetDto, ConsortiumBudgetRowDto, LumpSumCellDto, LumpSumPlanDto,
    LumpSumPlanRowDto, PersonMonthDetailDto,
};
use crate::domain::enums::CostCategory;
use crate::domain::execution_entities::{
    LumpSumShare, PartnerBudgetLine, PartnerOrganization, Person,
};
use rust_decimal::Decimal;
use std::collections::BTreeMap;
use uuid::Uuid;

/// BR-PO-05: a partner's actual cost (V1 scope: personnel only — see
/// `docs/partner-organizations-requirements.md` §6, the other cost
/// categories have no WP or partner attribution yet, same limitation
/// Work Package actual cost has always had) is the sum of every approved
/// person-month record's already-computed `salary_cost_estimate_eur`
/// across every `Person` linked to that partner. No salary math is
/// duplicated here — `person_months` is the exact same list
/// `commands::project::build_summary` already produces for the Personnel
/// screen; this is pure aggregation over data that already exists.
pub fn calculate_partner_actual_personnel_eur(
    persons: &[Person],
    person_months: &[PersonMonthDetailDto],
) -> BTreeMap<Uuid, Decimal> {
    let mut totals: BTreeMap<Uuid, Decimal> = BTreeMap::new();

    for record in person_months {
        let Some(cost) = record.salary_cost_estimate_eur else {
            continue;
        };
        let Some(person) = persons.iter().find(|p| p.id == record.person_id) else {
            continue;
        };
        let Some(partner_id) = person.partner_organization_id else {
            continue;
        };
        *totals.entry(partner_id).or_insert(Decimal::ZERO) += cost;
    }

    totals
}

/// The own organization's planned figures, lifted out of the Budget file's
/// `BudgetSummaryDto` by the caller (`commands::project::build_summary`).
/// Kept as a plain struct so this engine -- and its tests -- never need to
/// construct a whole `BudgetSummaryDto`. `D` has no Budget App equivalent, so
/// it is always zero for the own organization.
pub struct OwnBudgetFigures {
    pub a: Decimal,
    pub b: Decimal,
    pub c1: Decimal,
    pub c2: Decimal,
    pub c3: Decimal,
    pub e: Decimal,
    pub requested_eu_contribution: Decimal,
}

fn zero_amounts() -> BTreeMap<CostCategory, Decimal> {
    CostCategory::ALL
        .iter()
        .map(|c| (*c, Decimal::ZERO))
        .collect()
}

/// M-25 (actual-cost model): one row per partner, in partner order, plus a
/// totals row.
///
/// * The own organization's row comes from `own` (the Budget file) --
///   BR-CB-02. Any `PartnerBudgetLine`s that happen to exist for it (e.g. a
///   partner entered by hand and only later marked as the own organization)
///   are ignored here but never deleted: hide, don't delete (BR-FM-01).
/// * Every other partner's row sums its own lines, and its requested EU
///   contribution is `total x funding_rate / 100` (rate defaults to 100).
/// * Lines for partners that no longer exist are ignored.
pub fn calculate_consortium_budget(
    partners: &[PartnerOrganization],
    lines: &[PartnerBudgetLine],
    own: &OwnBudgetFigures,
) -> ConsortiumBudgetDto {
    let mut rows = Vec::with_capacity(partners.len());
    let mut total_amounts = zero_amounts();
    let mut total_eligible = Decimal::ZERO;
    let mut total_contribution = Decimal::ZERO;

    for partner in partners {
        let mut amounts = zero_amounts();
        let source;
        let funding_rate_pct;
        let requested_eu_contribution_eur;

        if partner.is_own_organization {
            source = BudgetRowSource::BudgetFile;
            amounts.insert(CostCategory::A, own.a);
            amounts.insert(CostCategory::B, own.b);
            amounts.insert(CostCategory::C1, own.c1);
            amounts.insert(CostCategory::C2, own.c2);
            amounts.insert(CostCategory::C3, own.c3);
            amounts.insert(CostCategory::E, own.e);
            funding_rate_pct = None;
            requested_eu_contribution_eur = own.requested_eu_contribution;
        } else {
            source = BudgetRowSource::Entered;
            for line in lines.iter().filter(|l| l.partner_id == partner.id) {
                *amounts.entry(line.category).or_insert(Decimal::ZERO) += line.amount_eur;
            }
            let rate = partner.funding_rate_pct.unwrap_or(Decimal::ONE_HUNDRED);
            funding_rate_pct = Some(rate);
            requested_eu_contribution_eur =
                (amounts.values().sum::<Decimal>() * rate / Decimal::ONE_HUNDRED).round_dp(2);
        }

        let total_eligible_eur: Decimal = amounts.values().sum();
        for (category, amount) in &amounts {
            *total_amounts.entry(*category).or_insert(Decimal::ZERO) += amount;
        }
        total_eligible += total_eligible_eur;
        total_contribution += requested_eu_contribution_eur;

        rows.push(ConsortiumBudgetRowDto {
            partner_id: partner.id,
            partner_name: partner.name.clone(),
            is_own_organization: partner.is_own_organization,
            source,
            amounts,
            total_eligible_eur,
            funding_rate_pct,
            requested_eu_contribution_eur,
        });
    }

    ConsortiumBudgetDto {
        rows,
        total_amounts,
        total_eligible_eur: total_eligible,
        total_requested_eu_contribution_eur: total_contribution,
        has_own_organization: partners.iter().any(|p| p.is_own_organization),
    }
}

/// M-25 (lump-sum model): a work-package x partner matrix of planned shares.
/// Every partner gets a cell in every row (zero when unset) so the UI can
/// render the full grid directly. Shares for unknown partners or work
/// packages outside `work_packages` are ignored.
pub fn calculate_lump_sum_plan(
    partners: &[PartnerOrganization],
    shares: &[LumpSumShare],
    work_packages: &[(u8, String)],
) -> LumpSumPlanDto {
    let mut partner_totals: Vec<LumpSumCellDto> = partners
        .iter()
        .map(|p| LumpSumCellDto {
            partner_id: p.id,
            amount_eur: Decimal::ZERO,
        })
        .collect();

    let mut rows = Vec::with_capacity(work_packages.len());
    let mut grand_total = Decimal::ZERO;

    for (work_package_id, work_package_name) in work_packages {
        let mut cells = Vec::with_capacity(partners.len());
        let mut row_total = Decimal::ZERO;

        for (index, partner) in partners.iter().enumerate() {
            let amount_eur: Decimal = shares
                .iter()
                .filter(|s| s.work_package_id == *work_package_id && s.partner_id == partner.id)
                .map(|s| s.amount_eur)
                .sum();
            row_total += amount_eur;
            partner_totals[index].amount_eur += amount_eur;
            cells.push(LumpSumCellDto {
                partner_id: partner.id,
                amount_eur,
            });
        }

        grand_total += row_total;
        rows.push(LumpSumPlanRowDto {
            work_package_id: *work_package_id,
            work_package_name: work_package_name.clone(),
            cells,
            total_eur: row_total,
        });
    }

    LumpSumPlanDto {
        rows,
        partner_totals,
        grand_total_eur: grand_total,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;
    use uuid::Uuid;

    fn make_person(id: Uuid, partner_organization_id: Option<Uuid>) -> Person {
        Person {
            id,
            full_name: "Ada".to_string(),
            email: None,
            institution: None,
            orcid: None,
            linked_role_id: Uuid::new_v4(),
            actual_start_date: "2026-01-01".to_string(),
            actual_end_date: None,
            partner_organization_id,
        }
    }

    fn make_record(
        person_id: Uuid,
        salary_cost_estimate_eur: Option<Decimal>,
    ) -> PersonMonthDetailDto {
        PersonMonthDetailDto {
            id: Uuid::new_v4(),
            person_id,
            project_month: 1,
            reported_months: dec!(1),
            approved_months: Some(dec!(1)),
            salary_cost_estimate_eur,
            calendar_year: None,
            calendar_month: None,
        }
    }

    #[test]
    fn test_empty_input_returns_empty_map() {
        assert!(calculate_partner_actual_personnel_eur(&[], &[]).is_empty());
    }

    #[test]
    fn test_single_person_single_record_sums_correctly() {
        let partner_id = Uuid::new_v4();
        let person_id = Uuid::new_v4();
        let persons = [make_person(person_id, Some(partner_id))];
        let records = [make_record(person_id, Some(dec!(1000)))];

        let totals = calculate_partner_actual_personnel_eur(&persons, &records);
        assert_eq!(totals.get(&partner_id), Some(&dec!(1000)));
    }

    #[test]
    fn test_multiple_records_same_partner_are_summed() {
        let partner_id = Uuid::new_v4();
        let person_id = Uuid::new_v4();
        let persons = [make_person(person_id, Some(partner_id))];
        let records = [
            make_record(person_id, Some(dec!(1000))),
            make_record(person_id, Some(dec!(500))),
        ];

        let totals = calculate_partner_actual_personnel_eur(&persons, &records);
        assert_eq!(totals.get(&partner_id), Some(&dec!(1500)));
    }

    #[test]
    fn test_different_partners_are_kept_separate() {
        let partner_a = Uuid::new_v4();
        let partner_b = Uuid::new_v4();
        let person_a = Uuid::new_v4();
        let person_b = Uuid::new_v4();
        let persons = [
            make_person(person_a, Some(partner_a)),
            make_person(person_b, Some(partner_b)),
        ];
        let records = [
            make_record(person_a, Some(dec!(1000))),
            make_record(person_b, Some(dec!(2000))),
        ];

        let totals = calculate_partner_actual_personnel_eur(&persons, &records);
        assert_eq!(totals.get(&partner_a), Some(&dec!(1000)));
        assert_eq!(totals.get(&partner_b), Some(&dec!(2000)));
    }

    #[test]
    fn test_record_with_no_salary_estimate_is_skipped() {
        let partner_id = Uuid::new_v4();
        let person_id = Uuid::new_v4();
        let persons = [make_person(person_id, Some(partner_id))];
        // None -- e.g. a record with no approved_months yet.
        let records = [make_record(person_id, None)];

        let totals = calculate_partner_actual_personnel_eur(&persons, &records);
        assert!(totals.is_empty());
    }

    #[test]
    fn test_person_with_no_partner_is_skipped() {
        let person_id = Uuid::new_v4();
        let persons = [make_person(person_id, None)];
        let records = [make_record(person_id, Some(dec!(1000)))];

        let totals = calculate_partner_actual_personnel_eur(&persons, &records);
        assert!(totals.is_empty());
    }

    #[test]
    fn test_record_referencing_unknown_person_is_skipped() {
        let persons: [Person; 0] = [];
        let records = [make_record(Uuid::new_v4(), Some(dec!(1000)))];

        let totals = calculate_partner_actual_personnel_eur(&persons, &records);
        assert!(totals.is_empty());
    }

    // ─── M-25: consortium planned budget ───────────────────────────────

    fn make_partner(name: &str, is_own: bool, funding_rate_pct: Option<Decimal>) -> PartnerOrganization {
        use crate::domain::enums::{PartnerRole, PartnerValidationStatus};
        PartnerOrganization {
            id: Uuid::new_v4(),
            name: name.to_string(),
            short_name: None,
            country: "Sweden".to_string(),
            pic_number: None,
            role: PartnerRole::Beneficiary,
            contact_name: None,
            contact_email: None,
            validation_status: PartnerValidationStatus::NotStarted,
            grant_agreement_signed: false,
            planned_budget_share_eur: None,
            notes: None,
            is_own_organization: is_own,
            funding_rate_pct,
        }
    }

    fn line(partner_id: Uuid, category: CostCategory, amount: Decimal) -> PartnerBudgetLine {
        PartnerBudgetLine {
            id: Uuid::new_v4(),
            partner_id,
            category,
            amount_eur: amount,
        }
    }

    fn own_figures() -> OwnBudgetFigures {
        OwnBudgetFigures {
            a: dec!(100000),
            b: dec!(10000),
            c1: dec!(5000),
            c2: dec!(8000),
            c3: dec!(2000),
            e: dec!(28750),
            requested_eu_contribution: dec!(153750),
        }
    }

    #[test]
    fn test_budget_with_no_partners_is_empty_and_flags_missing_own_org() {
        let result = calculate_consortium_budget(&[], &[], &own_figures());
        assert!(result.rows.is_empty());
        assert_eq!(result.total_eligible_eur, dec!(0));
        assert_eq!(result.total_requested_eu_contribution_eur, dec!(0));
        assert!(!result.has_own_organization);
        // every category is present, even when nothing is entered
        assert_eq!(result.total_amounts.len(), 7);
    }

    #[test]
    fn test_budget_own_organization_row_comes_from_budget_file() {
        let own = make_partner("Own University", true, None);
        let result = calculate_consortium_budget(&[own.clone()], &[], &own_figures());
        let row = &result.rows[0];

        assert_eq!(row.source, BudgetRowSource::BudgetFile);
        assert_eq!(row.amounts[&CostCategory::A], dec!(100000));
        assert_eq!(row.amounts[&CostCategory::E], dec!(28750));
        assert_eq!(row.amounts[&CostCategory::D], dec!(0));
        assert_eq!(row.total_eligible_eur, dec!(153750));
        assert_eq!(row.funding_rate_pct, None);
        assert_eq!(row.requested_eu_contribution_eur, dec!(153750));
        assert!(result.has_own_organization);
    }

    #[test]
    fn test_budget_other_partner_row_sums_its_lines_at_default_rate_100() {
        let kth = make_partner("KTH", false, None);
        let lines = [
            line(kth.id, CostCategory::A, dec!(200000)),
            line(kth.id, CostCategory::C2, dec!(15000)),
            line(kth.id, CostCategory::E, dec!(53750)),
        ];
        let result = calculate_consortium_budget(&[kth], &lines, &own_figures());
        let row = &result.rows[0];

        assert_eq!(row.source, BudgetRowSource::Entered);
        assert_eq!(row.total_eligible_eur, dec!(268750));
        assert_eq!(row.funding_rate_pct, Some(dec!(100)));
        assert_eq!(row.requested_eu_contribution_eur, dec!(268750));
    }

    #[test]
    fn test_budget_funding_rate_scales_requested_contribution() {
        let sme = make_partner("Some SME", false, Some(dec!(70)));
        let lines = [line(sme.id, CostCategory::A, dec!(100000))];
        let result = calculate_consortium_budget(&[sme], &lines, &own_figures());
        let row = &result.rows[0];

        assert_eq!(row.funding_rate_pct, Some(dec!(70)));
        assert_eq!(row.requested_eu_contribution_eur, dec!(70000));
    }

    #[test]
    fn test_budget_contribution_is_rounded_to_cents() {
        let p = make_partner("P", false, Some(dec!(33.333)));
        let lines = [line(p.id, CostCategory::A, dec!(1000))];
        let result = calculate_consortium_budget(&[p], &lines, &own_figures());
        assert_eq!(result.rows[0].requested_eu_contribution_eur, dec!(333.33));
    }

    #[test]
    fn test_budget_totals_sum_every_row_per_category() {
        let own = make_partner("Own", true, None);
        let kth = make_partner("KTH", false, None);
        let lines = [
            line(kth.id, CostCategory::A, dec!(200000)),
            line(kth.id, CostCategory::D, dec!(5000)),
        ];
        let result = calculate_consortium_budget(&[own, kth], &lines, &own_figures());

        assert_eq!(result.total_amounts[&CostCategory::A], dec!(300000));
        assert_eq!(result.total_amounts[&CostCategory::D], dec!(5000));
        assert_eq!(result.total_eligible_eur, dec!(153750) + dec!(205000));
        assert_eq!(
            result.total_requested_eu_contribution_eur,
            dec!(153750) + dec!(205000)
        );
    }

    #[test]
    fn test_budget_ignores_lines_stored_for_the_own_organization() {
        // BR-CB-02 / hide-don't-delete: a partner entered by hand and later
        // marked as "own" keeps its old lines in storage, but only the
        // Budget file's figures may count.
        let own = make_partner("Own", true, None);
        let stale = [line(own.id, CostCategory::A, dec!(999999))];
        let result = calculate_consortium_budget(&[own], &stale, &own_figures());
        assert_eq!(result.rows[0].amounts[&CostCategory::A], dec!(100000));
    }

    #[test]
    fn test_budget_ignores_lines_for_unknown_partners() {
        let kth = make_partner("KTH", false, None);
        let orphan = [line(Uuid::new_v4(), CostCategory::A, dec!(5000))];
        let result = calculate_consortium_budget(&[kth], &orphan, &own_figures());
        assert_eq!(result.total_eligible_eur, dec!(0));
    }

    #[test]
    fn test_budget_rows_keep_partner_order() {
        let a = make_partner("A", false, None);
        let b = make_partner("B", false, None);
        let c = make_partner("C", true, None);
        let result = calculate_consortium_budget(&[a.clone(), b.clone(), c.clone()], &[], &own_figures());
        let ids: Vec<Uuid> = result.rows.iter().map(|r| r.partner_id).collect();
        assert_eq!(ids, vec![a.id, b.id, c.id]);
    }

    fn share(wp: u8, partner_id: Uuid, amount: Decimal) -> LumpSumShare {
        LumpSumShare {
            id: Uuid::new_v4(),
            work_package_id: wp,
            partner_id,
            amount_eur: amount,
        }
    }

    fn wps() -> Vec<(u8, String)> {
        vec![(1, "Management".to_string()), (2, "Research".to_string())]
    }

    #[test]
    fn test_lump_sum_plan_has_a_cell_for_every_partner_in_every_row() {
        let a = make_partner("A", false, None);
        let b = make_partner("B", false, None);
        let plan = calculate_lump_sum_plan(&[a, b], &[], &wps());

        assert_eq!(plan.rows.len(), 2);
        assert!(plan.rows.iter().all(|r| r.cells.len() == 2));
        assert_eq!(plan.partner_totals.len(), 2);
        assert_eq!(plan.grand_total_eur, dec!(0));
        assert_eq!(plan.rows[1].work_package_name, "Research");
    }

    #[test]
    fn test_lump_sum_plan_row_partner_and_grand_totals() {
        let a = make_partner("A", true, None);
        let b = make_partner("B", false, None);
        let shares = [
            share(1, a.id, dec!(10000)),
            share(1, b.id, dec!(20000)),
            share(2, a.id, dec!(30000)),
        ];
        let plan = calculate_lump_sum_plan(&[a.clone(), b.clone()], &shares, &wps());

        assert_eq!(plan.rows[0].total_eur, dec!(30000));
        assert_eq!(plan.rows[1].total_eur, dec!(30000));
        assert_eq!(plan.partner_totals[0].amount_eur, dec!(40000));
        assert_eq!(plan.partner_totals[1].amount_eur, dec!(20000));
        assert_eq!(plan.grand_total_eur, dec!(60000));
        // cell order follows partner order
        assert_eq!(plan.rows[0].cells[0].partner_id, a.id);
        assert_eq!(plan.rows[0].cells[1].partner_id, b.id);
        assert_eq!(plan.rows[1].cells[1].amount_eur, dec!(0));
    }

    #[test]
    fn test_lump_sum_plan_ignores_shares_for_unknown_partner_or_wp() {
        let a = make_partner("A", false, None);
        let shares = [
            share(1, Uuid::new_v4(), dec!(5000)), // unknown partner
            share(9, a.id, dec!(7000)),           // WP not in the list
            share(1, a.id, dec!(1000)),
        ];
        let plan = calculate_lump_sum_plan(&[a], &shares, &wps());
        assert_eq!(plan.grand_total_eur, dec!(1000));
        assert_eq!(plan.partner_totals[0].amount_eur, dec!(1000));
    }

    #[test]
    fn test_lump_sum_plan_with_no_partners_has_rows_but_no_cells() {
        let plan = calculate_lump_sum_plan(&[], &[], &wps());
        assert_eq!(plan.rows.len(), 2);
        assert!(plan.rows[0].cells.is_empty());
        assert!(plan.partner_totals.is_empty());
    }
}
