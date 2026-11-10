/**
 * M-25: Consortium Budget (Horizon Europe, actual-cost model). A partners x
 * cost-categories matrix of planned eligible costs.
 *
 * - Your own organization's row is read-only: its figures come from the
 *   Budget file (BR-CB-02), so they can't drift from it.
 * - Every other partner's row is editable. Indirect costs (E) are entered as
 *   listed in the Grant Agreement's budget table -- there's no automatic 25%
 *   calculation here yet (see docs/consortium-foundation-requirements.md §6).
 */

import { useExecutionStore } from '../store/executionStore';
import { useExecutionMutation } from '../hooks/useExecutionMutation';
import { setPartnerBudgetAmount } from '../ipc/commands';
import { AmountCell } from '../components/AmountCell';
import { fmtEur } from '../utils/currency';
import { COST_CATEGORIES, COST_CATEGORY_LABEL, isZeroAmount } from '../utils/consortium';

export function ConsortiumBudget() {
  const summary = useExecutionStore((s) => s.summary);
  const setActiveScreen = useExecutionStore((s) => s.setActiveScreen);
  const { run, error, isSubmitting } = useExecutionMutation();

  if (!summary) return null;
  const { rows, total_amounts, total_eligible_eur, total_requested_eu_contribution_eur } =
    summary.consortium_budget;

  return (
    <div className="screen">
      <h1>Consortium Budget</h1>
      <p className="subtitle">
        Planned eligible costs per partner and cost category, as listed in the Grant Agreement.
      </p>
      {error && <p className="error-banner">{error}</p>}

      {rows.length === 0 ? (
        <p>
          No partners yet.{' '}
          <button onClick={() => setActiveScreen('partners')}>Add partners</button> first — each one
          gets a row here.
        </p>
      ) : (
        <>
          {!summary.consortium_budget.has_own_organization && (
            <p className="warning-banner">
              None of your partners is marked as <strong>your own organization</strong>, so your
              Budget file’s figures are not included below.{' '}
              <button onClick={() => setActiveScreen('partners')}>Mark it on Partners</button>
            </p>
          )}

          <table className="matrix">
            <thead>
              <tr>
                <th>Partner</th>
                {COST_CATEGORIES.map((c) => (
                  <th key={c} className="num" title={COST_CATEGORY_LABEL[c]}>
                    {c}
                  </th>
                ))}
                <th className="num">Total eligible</th>
                <th className="num">Funding rate</th>
                <th className="num">Requested EU contribution</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.partner_id} className={row.is_own_organization ? 'row-own' : undefined}>
                  <td>
                    {row.partner_name}
                    {row.is_own_organization && (
                      <div className="subtitle">Your organization — from the Budget file</div>
                    )}
                  </td>
                  {COST_CATEGORIES.map((c) => (
                    <td key={c} className="num">
                      {row.source === 'BudgetFile' ? (
                        isZeroAmount(row.amounts[c]) ? (
                          '—'
                        ) : (
                          fmtEur(row.amounts[c])
                        )
                      ) : (
                        <AmountCell
                          value={row.amounts[c]}
                          ariaLabel={`${row.partner_name} ${c} (${COST_CATEGORY_LABEL[c]})`}
                          disabled={isSubmitting}
                          onCommit={(amount) =>
                            run(() => setPartnerBudgetAmount(row.partner_id, c, amount))
                          }
                        />
                      )}
                    </td>
                  ))}
                  <td className="num">
                    <strong>{fmtEur(row.total_eligible_eur)}</strong>
                  </td>
                  <td className="num">
                    {row.funding_rate_pct === null ? '—' : `${row.funding_rate_pct}%`}
                  </td>
                  <td className="num">{fmtEur(row.requested_eu_contribution_eur)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Consortium total</th>
                {COST_CATEGORIES.map((c) => (
                  <th key={c} className="num">
                    {isZeroAmount(total_amounts[c]) ? '—' : fmtEur(total_amounts[c])}
                  </th>
                ))}
                <th className="num">{fmtEur(total_eligible_eur)}</th>
                <th />
                <th className="num">{fmtEur(total_requested_eu_contribution_eur)}</th>
              </tr>
            </tfoot>
          </table>

          <p className="subtitle">
            A Personnel · B Subcontracting · C1 Travel · C2 Equipment · C3 Other goods &amp;
            services · D Other categories · E Indirect. Each partner’s EU funding rate is set on
            the Partners screen (blank means 100%).
          </p>
        </>
      )}
    </div>
  );
}
