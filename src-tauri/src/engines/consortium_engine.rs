//! Partner Organization Management (M-24) derivation.

use crate::domain::dto::PersonMonthDetailDto;
use crate::domain::execution_entities::Person;
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
}
