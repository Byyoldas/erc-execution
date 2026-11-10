/**
 * M-25: Lump Sum Plan (Horizon Europe, lump-sum model). A work packages x
 * partners matrix of planned lump-sum shares. Every cell is editable --
 * including your own organization's, since the Budget file has no lump-sum
 * structure to read it from (BR-LS-02).
 *
 * Work packages come from the Budget file (`work_package_count`); see
 * docs/consortium-foundation-requirements.md §9 if the Grant Agreement has
 * more work packages than the Budget file declares.
 */

import { useExecutionStore } from '../store/executionStore';
import { useExecutionMutation } from '../hooks/useExecutionMutation';
import { setLumpSumShare } from '../ipc/commands';
import { AmountCell } from '../components/AmountCell';
import { fmtEur } from '../utils/currency';

export function LumpSumPlan() {
  const summary = useExecutionStore((s) => s.summary);
  const setActiveScreen = useExecutionStore((s) => s.setActiveScreen);
  const { run, error, isSubmitting } = useExecutionMutation();

  if (!summary) return null;
  const { partner_organizations: partners, lump_sum_plan: plan } = summary;

  return (
    <div className="screen">
      <h1>Lump Sum Plan</h1>
      <p className="subtitle">
        Each partner’s planned lump-sum share of every work package, as listed in the Grant
        Agreement.
      </p>
      {error && <p className="error-banner">{error}</p>}

      {partners.length === 0 ? (
        <p>
          No partners yet. <button onClick={() => setActiveScreen('partners')}>Add partners</button>{' '}
          first — each one gets a column here.
        </p>
      ) : plan.rows.length === 0 ? (
        <p className="warning-banner">This project has no work packages to plan against.</p>
      ) : (
        <div className="matrix-scroll">
          <table className="matrix">
            <thead>
              <tr>
                <th>Work package</th>
                {partners.map((p) => (
                  <th key={p.id} className="num" title={p.name}>
                    {p.short_name ?? p.name}
                    {p.is_own_organization && <div className="subtitle">you</div>}
                  </th>
                ))}
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {plan.rows.map((row) => (
                <tr key={row.work_package_id}>
                  <td>
                    WP{row.work_package_id}
                    {row.work_package_name && <div className="subtitle">{row.work_package_name}</div>}
                  </td>
                  {row.cells.map((cell, index) => (
                    <td key={cell.partner_id} className="num">
                      <AmountCell
                        value={cell.amount_eur}
                        ariaLabel={`WP${row.work_package_id} ${partners[index]?.name ?? 'partner'}`}
                        disabled={isSubmitting}
                        onCommit={(amount) =>
                          run(() => setLumpSumShare(row.work_package_id, cell.partner_id, amount))
                        }
                      />
                    </td>
                  ))}
                  <td className="num">
                    <strong>{fmtEur(row.total_eur)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Partner total</th>
                {plan.partner_totals.map((t) => (
                  <th key={t.partner_id} className="num">
                    {fmtEur(t.amount_eur)}
                  </th>
                ))}
                <th className="num">{fmtEur(plan.grand_total_eur)}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
