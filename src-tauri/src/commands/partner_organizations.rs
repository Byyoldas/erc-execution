//! IPC commands for M-24 Partner Organization Management.

use crate::commands::project::build_summary;
use crate::domain::dto::{ExecutionProjectSummaryDto, PartnerOrganizationInputDto};
use crate::domain::execution_entities::PartnerOrganization;
use crate::error::AppError;
use crate::persistence;
use crate::validation::{validate_partner_organization, validate_partner_organization_deletion};
use crate::AppState;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn add_partner_organization(
    state: State<'_, AppState>,
    input: PartnerOrganizationInputDto,
) -> Result<ExecutionProjectSummaryDto, AppError> {
    let project_lock = state.project.lock().unwrap();
    let project = project_lock.as_ref().ok_or(AppError::NoProject)?;

    let mut exec_lock = state.execution_data.lock().unwrap();
    let exec = exec_lock.as_mut().ok_or(AppError::NoProject)?;

    validate_partner_organization(&input, &exec.partner_organizations, None)?;

    exec.partner_organizations.push(PartnerOrganization {
        id: Uuid::new_v4(),
        name: input.name,
        short_name: input.short_name,
        country: input.country,
        pic_number: input.pic_number,
        role: input.role,
        contact_name: input.contact_name,
        contact_email: input.contact_email,
        validation_status: input.validation_status,
        grant_agreement_signed: input.grant_agreement_signed,
        planned_budget_share_eur: input.planned_budget_share_eur,
        notes: input.notes,
    });

    let summary = build_summary(project, exec, &state)?;
    if let Some(path) = state.project_path.lock().unwrap().as_deref() {
        persistence::auto_save(project, exec, path)?;
    }
    Ok(summary)
}

#[tauri::command]
pub fn update_partner_organization(
    state: State<'_, AppState>,
    id: Uuid,
    input: PartnerOrganizationInputDto,
) -> Result<ExecutionProjectSummaryDto, AppError> {
    let project_lock = state.project.lock().unwrap();
    let project = project_lock.as_ref().ok_or(AppError::NoProject)?;

    let mut exec_lock = state.execution_data.lock().unwrap();
    let exec = exec_lock.as_mut().ok_or(AppError::NoProject)?;

    validate_partner_organization(&input, &exec.partner_organizations, Some(id))?;

    let partner = exec
        .partner_organizations
        .iter_mut()
        .find(|p| p.id == id)
        .ok_or_else(|| AppError::NotFound(format!("Partner organization '{id}' not found.")))?;
    partner.name = input.name;
    partner.short_name = input.short_name;
    partner.country = input.country;
    partner.pic_number = input.pic_number;
    partner.role = input.role;
    partner.contact_name = input.contact_name;
    partner.contact_email = input.contact_email;
    partner.validation_status = input.validation_status;
    partner.grant_agreement_signed = input.grant_agreement_signed;
    partner.planned_budget_share_eur = input.planned_budget_share_eur;
    partner.notes = input.notes;

    let summary = build_summary(project, exec, &state)?;
    if let Some(path) = state.project_path.lock().unwrap().as_deref() {
        persistence::auto_save(project, exec, path)?;
    }
    Ok(summary)
}

#[tauri::command]
pub fn delete_partner_organization(
    state: State<'_, AppState>,
    id: Uuid,
) -> Result<ExecutionProjectSummaryDto, AppError> {
    let project_lock = state.project.lock().unwrap();
    let project = project_lock.as_ref().ok_or(AppError::NoProject)?;

    let mut exec_lock = state.execution_data.lock().unwrap();
    let exec = exec_lock.as_mut().ok_or(AppError::NoProject)?;

    // BR-PO-03: blocked while any Person still links to this partner.
    validate_partner_organization_deletion(id, &exec.persons)?;

    let before = exec.partner_organizations.len();
    exec.partner_organizations.retain(|p| p.id != id);
    if exec.partner_organizations.len() == before {
        return Err(AppError::NotFound(format!(
            "Partner organization '{id}' not found."
        )));
    }

    let summary = build_summary(project, exec, &state)?;
    if let Some(path) = state.project_path.lock().unwrap().as_deref() {
        persistence::auto_save(project, exec, path)?;
    }
    Ok(summary)
}
