//! IPC commands for M-25 Funding Model & Consortium Planned Budget.
//!
//! The actual state changes live in small pure `apply_*` / `remove_*`
//! functions (unit-tested below); the `#[tauri::command]` wrappers only add
//! locking, validation, summary rebuilding, and auto-save -- the same shape
//! as every other command module in this app.

use crate::commands::project::build_summary;
use crate::domain::dto::ExecutionProjectSummaryDto;
use crate::domain::enums::{CostCategory, FundingModel};
use crate::domain::execution_entities::{ExecutionData, LumpSumShare, PartnerBudgetLine};
use crate::error::AppError;
use crate::persistence;
use crate::validation::{validate_lump_sum_share, validate_partner_budget_amount};
use crate::AppState;
use rust_decimal::Decimal;
use tauri::State;
use uuid::Uuid;

/// BR-CB-01: upserts one partner's amount in one category. `None` or zero
/// removes the line, so storage only ever holds amounts > 0.
pub(crate) fn apply_partner_budget_amount(
    exec: &mut ExecutionData,
    partner_id: Uuid,
    category: CostCategory,
    amount: Option<Decimal>,
) {
    let amount = amount.filter(|a| *a > Decimal::ZERO);
    let existing = exec
        .partner_budget_lines
        .iter()
        .position(|l| l.partner_id == partner_id && l.category == category);

    match (existing, amount) {
        (Some(index), Some(amount)) => exec.partner_budget_lines[index].amount_eur = amount,
        (Some(index), None) => {
            exec.partner_budget_lines.remove(index);
        }
        (None, Some(amount)) => exec.partner_budget_lines.push(PartnerBudgetLine {
            id: Uuid::new_v4(),
            partner_id,
            category,
            amount_eur: amount,
        }),
        (None, None) => {}
    }
}

/// BR-LS-01: upserts one partner's lump-sum share of one work package.
/// `None` or zero removes the share.
pub(crate) fn apply_lump_sum_share(
    exec: &mut ExecutionData,
    work_package_id: u8,
    partner_id: Uuid,
    amount: Option<Decimal>,
) {
    let amount = amount.filter(|a| *a > Decimal::ZERO);
    let existing = exec
        .lump_sum_shares
        .iter()
        .position(|s| s.work_package_id == work_package_id && s.partner_id == partner_id);

    match (existing, amount) {
        (Some(index), Some(amount)) => exec.lump_sum_shares[index].amount_eur = amount,
        (Some(index), None) => {
            exec.lump_sum_shares.remove(index);
        }
        (None, Some(amount)) => exec.lump_sum_shares.push(LumpSumShare {
            id: Uuid::new_v4(),
            work_package_id,
            partner_id,
            amount_eur: amount,
        }),
        (None, None) => {}
    }
}

/// BR-PO-09: a deleted partner takes its planned budget lines and lump-sum
/// shares with it -- they are owned data, so leaving them behind would only
/// create orphans.
pub(crate) fn remove_partner_planning_data(exec: &mut ExecutionData, partner_id: Uuid) {
    exec.partner_budget_lines
        .retain(|l| l.partner_id != partner_id);
    exec.lump_sum_shares.retain(|s| s.partner_id != partner_id);
}

#[tauri::command(rename_all = "snake_case")]
pub fn set_funding_model(
    state: State<'_, AppState>,
    model: FundingModel,
) -> Result<ExecutionProjectSummaryDto, AppError> {
    let project_lock = state.project.lock().unwrap();
    let project = project_lock.as_ref().ok_or(AppError::NoProject)?;

    let mut exec_lock = state.execution_data.lock().unwrap();
    let exec = exec_lock.as_mut().ok_or(AppError::NoProject)?;

    // BR-FM-01: only the model changes -- every other piece of data stays.
    exec.funding_model = model;

    let summary = build_summary(project, exec, &state)?;
    if let Some(path) = state.project_path.lock().unwrap().as_deref() {
        persistence::auto_save(project, exec, path)?;
    }
    Ok(summary)
}

/// `rename_all = "snake_case"`: the frontend sends `partner_id`, matching
/// every other multi-word-argument command in this app (Tauri 2's default
/// would expect `partnerId` and silently reject the call at runtime).
#[tauri::command(rename_all = "snake_case")]
pub fn set_partner_budget_amount(
    state: State<'_, AppState>,
    partner_id: Uuid,
    category: CostCategory,
    amount: Option<Decimal>,
) -> Result<ExecutionProjectSummaryDto, AppError> {
    let project_lock = state.project.lock().unwrap();
    let project = project_lock.as_ref().ok_or(AppError::NoProject)?;

    let mut exec_lock = state.execution_data.lock().unwrap();
    let exec = exec_lock.as_mut().ok_or(AppError::NoProject)?;

    validate_partner_budget_amount(partner_id, amount, &exec.partner_organizations)?;
    apply_partner_budget_amount(exec, partner_id, category, amount);

    let summary = build_summary(project, exec, &state)?;
    if let Some(path) = state.project_path.lock().unwrap().as_deref() {
        persistence::auto_save(project, exec, path)?;
    }
    Ok(summary)
}

/// See `set_partner_budget_amount` for why this is `snake_case`.
#[tauri::command(rename_all = "snake_case")]
pub fn set_lump_sum_share(
    state: State<'_, AppState>,
    work_package_id: u8,
    partner_id: Uuid,
    amount: Option<Decimal>,
) -> Result<ExecutionProjectSummaryDto, AppError> {
    let project_lock = state.project.lock().unwrap();
    let project = project_lock.as_ref().ok_or(AppError::NoProject)?;

    let mut exec_lock = state.execution_data.lock().unwrap();
    let exec = exec_lock.as_mut().ok_or(AppError::NoProject)?;

    validate_lump_sum_share(
        work_package_id,
        partner_id,
        amount,
        &exec.partner_organizations,
        project.config.work_package_count,
    )?;
    apply_lump_sum_share(exec, work_package_id, partner_id, amount);

    let summary = build_summary(project, exec, &state)?;
    if let Some(path) = state.project_path.lock().unwrap().as_deref() {
        persistence::auto_save(project, exec, path)?;
    }
    Ok(summary)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    #[test]
    fn test_budget_amount_inserts_then_updates_in_place() {
        let mut exec = ExecutionData::default();
        let partner = Uuid::new_v4();

        apply_partner_budget_amount(&mut exec, partner, CostCategory::A, Some(dec!(1000)));
        assert_eq!(exec.partner_budget_lines.len(), 1);

        apply_partner_budget_amount(&mut exec, partner, CostCategory::A, Some(dec!(2500)));
        assert_eq!(exec.partner_budget_lines.len(), 1, "upsert, not append");
        assert_eq!(exec.partner_budget_lines[0].amount_eur, dec!(2500));
    }

    #[test]
    fn test_budget_amount_keeps_id_when_updating() {
        let mut exec = ExecutionData::default();
        let partner = Uuid::new_v4();
        apply_partner_budget_amount(&mut exec, partner, CostCategory::B, Some(dec!(1)));
        let id = exec.partner_budget_lines[0].id;
        apply_partner_budget_amount(&mut exec, partner, CostCategory::B, Some(dec!(2)));
        assert_eq!(exec.partner_budget_lines[0].id, id);
    }

    #[test]
    fn test_budget_amount_distinct_per_partner_and_category() {
        let mut exec = ExecutionData::default();
        let (p1, p2) = (Uuid::new_v4(), Uuid::new_v4());
        apply_partner_budget_amount(&mut exec, p1, CostCategory::A, Some(dec!(1)));
        apply_partner_budget_amount(&mut exec, p1, CostCategory::B, Some(dec!(2)));
        apply_partner_budget_amount(&mut exec, p2, CostCategory::A, Some(dec!(3)));
        assert_eq!(exec.partner_budget_lines.len(), 3);
    }

    #[test]
    fn test_budget_amount_none_and_zero_remove_the_line() {
        for removal in [None, Some(dec!(0))] {
            let mut exec = ExecutionData::default();
            let partner = Uuid::new_v4();
            apply_partner_budget_amount(&mut exec, partner, CostCategory::C1, Some(dec!(500)));
            apply_partner_budget_amount(&mut exec, partner, CostCategory::C1, removal);
            assert!(exec.partner_budget_lines.is_empty(), "removal {removal:?}");
        }
    }

    #[test]
    fn test_budget_amount_removing_a_missing_line_is_a_no_op() {
        let mut exec = ExecutionData::default();
        apply_partner_budget_amount(&mut exec, Uuid::new_v4(), CostCategory::E, None);
        apply_partner_budget_amount(&mut exec, Uuid::new_v4(), CostCategory::E, Some(dec!(0)));
        assert!(exec.partner_budget_lines.is_empty());
    }

    #[test]
    fn test_budget_amount_removal_leaves_other_lines_alone() {
        let mut exec = ExecutionData::default();
        let partner = Uuid::new_v4();
        apply_partner_budget_amount(&mut exec, partner, CostCategory::A, Some(dec!(1)));
        apply_partner_budget_amount(&mut exec, partner, CostCategory::B, Some(dec!(2)));
        apply_partner_budget_amount(&mut exec, partner, CostCategory::A, None);
        assert_eq!(exec.partner_budget_lines.len(), 1);
        assert_eq!(exec.partner_budget_lines[0].category, CostCategory::B);
    }

    #[test]
    fn test_lump_sum_share_inserts_updates_and_removes() {
        let mut exec = ExecutionData::default();
        let partner = Uuid::new_v4();

        apply_lump_sum_share(&mut exec, 2, partner, Some(dec!(40000)));
        assert_eq!(exec.lump_sum_shares.len(), 1);

        apply_lump_sum_share(&mut exec, 2, partner, Some(dec!(45000)));
        assert_eq!(exec.lump_sum_shares.len(), 1, "upsert, not append");
        assert_eq!(exec.lump_sum_shares[0].amount_eur, dec!(45000));

        apply_lump_sum_share(&mut exec, 2, partner, Some(dec!(0)));
        assert!(exec.lump_sum_shares.is_empty());
    }

    #[test]
    fn test_lump_sum_share_distinct_per_wp_and_partner() {
        let mut exec = ExecutionData::default();
        let (p1, p2) = (Uuid::new_v4(), Uuid::new_v4());
        apply_lump_sum_share(&mut exec, 1, p1, Some(dec!(1)));
        apply_lump_sum_share(&mut exec, 2, p1, Some(dec!(2)));
        apply_lump_sum_share(&mut exec, 1, p2, Some(dec!(3)));
        assert_eq!(exec.lump_sum_shares.len(), 3);
    }

    #[test]
    fn test_remove_partner_planning_data_cascades_only_that_partner() {
        let mut exec = ExecutionData::default();
        let (gone, kept) = (Uuid::new_v4(), Uuid::new_v4());
        apply_partner_budget_amount(&mut exec, gone, CostCategory::A, Some(dec!(1)));
        apply_partner_budget_amount(&mut exec, kept, CostCategory::A, Some(dec!(2)));
        apply_lump_sum_share(&mut exec, 1, gone, Some(dec!(3)));
        apply_lump_sum_share(&mut exec, 1, kept, Some(dec!(4)));

        remove_partner_planning_data(&mut exec, gone);

        assert_eq!(exec.partner_budget_lines.len(), 1);
        assert_eq!(exec.partner_budget_lines[0].partner_id, kept);
        assert_eq!(exec.lump_sum_shares.len(), 1);
        assert_eq!(exec.lump_sum_shares[0].partner_id, kept);
    }
}
