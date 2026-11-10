/**
 * M-01: Project Dashboard. Sprint E1 built the project header + planned
 * budget; Sprint E3 adds the planned-vs-actual panel (M-07) now that
 * financial_engine exists (see docs/executer/execution-architecture.md §7).
 * Progress/warnings panels are still deferred — no notification_engine yet.
 *
 * Project Start Date is editable right here, not in ERC Budget -- the
 * project's own explicit choice, and the one deliberate exception to this
 * app's "read Budget App data, never write it back" rule (see
 * commands::project::set_project_start_date's doc comment on the Rust
 * side for the full rationale). Every other field on this screen stays
 * read-only.
 *
 * M-25: the Funding Model is also chosen right here. Unlike Project Start
 * Date it is execution-side data (never written to the Budget file), and
 * switching it only changes which screens are shown, never any data.
 */

import { useState, useEffect } from 'react';
import { useExecutionStore } from '../store/executionStore';
import { useExecutionMutation } from '../hooks/useExecutionMutation';
import { setFundingModel, setProjectStartDate } from '../ipc/commands';
import { fmtEur } from '../utils/currency';
import {
  FUNDING_MODELS,
  FUNDING_MODEL_DESCRIPTION,
  FUNDING_MODEL_LABEL,
  plannedTotalForPartner,
} from '../utils/consortium';
import type { FundingModel } from '../types';

const CFS_LABELS: Record<string, string> = {
  NOT_REQUIRED: 'Not Required',
  REQUIRED_AND_PRESENT: 'Required — Present',
  REQUIRED_BUT_DISMISSED: 'Required — Dismissed',
  REQUIRED_AND_UNADDRESSED: 'Required — Unaddressed',
};

export function Dashboard() {
  const summary = useExecutionStore((s) => s.summary);
  const { run, error, isSubmitting } = useExecutionMutation();
  const [startDateInput, setStartDateInput] = useState(summary?.project_info.project_start_date ?? '');

  useEffect(() => {
    setStartDateInput(summary?.project_info.project_start_date ?? '');
  }, [summary?.project_info.project_start_date]);

  if (!summary) return null;

  const { project_info, planned, actuals, current_project_month, partner_organizations } = summary;
  const validatedCount = partner_organizations.filter((p) => p.validation_status === 'Validated').length;
  const timeElapsedPct =
    project_info.duration_years > 0
      ? Math.round((current_project_month / (project_info.duration_years * 12)) * 100)
      : 0;

  return (
    <div className="dashboard-screen">
      <header className="project-header">
        <h1>{project_info.project_title}</h1>
        <p>
          {project_info.pi_name} · {project_info.call_reference} ·{' '}
          {project_info.duration_years} year(s) · {project_info.work_package_count} WPs · Month{' '}
          {current_project_month} ({timeElapsedPct}% elapsed)
        </p>
        <div className="inline-form project-start-date-form">
          <label htmlFor="project_start_date">Project Start Date</label>
          <input
            id="project_start_date"
            type="date"
            value={startDateInput}
            onChange={(e) => setStartDateInput(e.target.value)}
          />
          <button
            onClick={() => run(() => setProjectStartDate(startDateInput || null))}
            disabled={isSubmitting || startDateInput === (project_info.project_start_date ?? '')}
          >
            Save
          </button>
          {error && <span className="save-status-error">{error}</span>}
        </div>
        <div className="inline-form funding-model-form">
          <label htmlFor="funding_model">Funding Model</label>
          <select
            id="funding_model"
            value={summary.funding_model}
            disabled={isSubmitting}
            onChange={(e) => run(() => setFundingModel(e.target.value as FundingModel))}
          >
            {FUNDING_MODELS.map((m) => (
              <option key={m} value={m}>
                {FUNDING_MODEL_LABEL[m]}
              </option>
            ))}
          </select>
        </div>
        <p className="subtitle">{FUNDING_MODEL_DESCRIPTION[summary.funding_model]}</p>
        <p className="subtitle">
          When the Grant Agreement takes effect — drives every "Month X"
          shown in this app. Distinct from Call Opening Date (set in ERC
          Budget), which only affects the EU travel rate version.
          {!project_info.project_start_date &&
            ' Currently unset, so progress tracking defaults to Month 1.'}
        </p>
      </header>

      <section className="budget-summary-panel">
        <h2>Planned vs. Actual</h2>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Planned</th>
              <th>Actual</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>A (Personnel)</td>
              <td>{fmtEur(planned.category_a_total)}</td>
              <td>{fmtEur(actuals.a_actual)}</td>
              <td>{actuals.category_a_overrun && <span className="warning-banner">&gt;15%</span>}</td>
            </tr>
            <tr>
              <td>B (Subcontracting)</td>
              <td>{fmtEur(planned.category_b_total)}</td>
              <td>{fmtEur(actuals.b_actual)}</td>
              <td>{actuals.category_b_overrun && <span className="warning-banner">&gt;15%</span>}</td>
            </tr>
            <tr>
              <td>C1 (Travel)</td>
              <td>{fmtEur(planned.category_c1_total)}</td>
              <td>{fmtEur(actuals.c1_actual)}</td>
              <td>{actuals.category_c1_overrun && <span className="warning-banner">&gt;15%</span>}</td>
            </tr>
            <tr>
              <td>C2 (Equipment)</td>
              <td>{fmtEur(planned.category_c2_total)}</td>
              <td>{fmtEur(actuals.c2_actual)}</td>
              <td>{actuals.category_c2_overrun && <span className="warning-banner">&gt;15%</span>}</td>
            </tr>
            <tr>
              <td>C3 (Other)</td>
              <td>{fmtEur(planned.category_c3_total)}</td>
              <td>{fmtEur(actuals.c3_actual)}</td>
              <td>{actuals.category_c3_overrun && <span className="warning-banner">&gt;15%</span>}</td>
            </tr>
            <tr>
              <td>E (Indirect)</td>
              <td>{fmtEur(planned.category_e_total)}</td>
              <td>{fmtEur(actuals.e_actual)}</td>
              <td />
            </tr>
            <tr>
              <td>
                <strong>Requested EU Contribution</strong>
              </td>
              <td>
                <strong>{fmtEur(planned.requested_eu_contribution)}</strong>
              </td>
              <td>
                <strong>{fmtEur(actuals.requested_eu_contribution_actual)}</strong>
              </td>
              <td />
            </tr>
          </tbody>
        </table>
        <p>CFS status (actual): {CFS_LABELS[actuals.cfs_status_actual] ?? actuals.cfs_status_actual}</p>
      </section>

      {partner_organizations.length > 0 && (
        <section className="budget-summary-panel">
          <h2>Consortium</h2>
          <p className="subtitle">
            {partner_organizations.length} partner(s) · {validatedCount}/{partner_organizations.length}{' '}
            validated
          </p>
          <table>
            <thead>
              <tr>
                <th>Partner</th>
                <th>{summary.funding_model === 'Erc' ? 'Planned Share' : 'Planned'}</th>
                <th>Actual (personnel only)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {partner_organizations.map((p) => (
                <tr key={p.id}>
                  <td>{p.short_name ?? p.name}</td>
                  <td>
                    {(() => {
                      const planned = plannedTotalForPartner(summary, p.id);
                      return planned ? fmtEur(planned) : '—';
                    })()}
                  </td>
                  <td>{fmtEur(p.actual_personnel_cost_eur)}</td>
                  <td>{p.over_budget_warning && <span className="warning-banner">&gt;10%</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
