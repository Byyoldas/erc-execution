/**
 * M-10: Other Costs Tracking (Category C3). Entries not linked to a planned
 * item are "unbudgeted" and require justification text (BR-OC-03).
 */

import { useState } from 'react';
import { DetailField, EntryBlock, EntryInput, EntryScope, EntrySelect, EntrySubmit } from '../components/EntryTable';
import { useExecutionStore } from '../store/executionStore';
import { useExecutionMutation } from '../hooks/useExecutionMutation';
import { addActualCostEntry, deleteActualCostEntry } from '../ipc/commands';
import type { ActualCostEntryInputDto, EntryStatus } from '../types';
import { fmtEur } from '../utils/currency';

const emptyForm: ActualCostEntryInputDto = {
  linked_entity_id: null,
  amount_eur: '',
  description: '',
  incurred_date: '',
  status: 'Approved',
  justification: null,
};

export function OtherCosts() {
  const summary = useExecutionStore((s) => s.summary);
  const { run, error, isSubmitting } = useExecutionMutation();
  const [form, setForm] = useState(emptyForm);

  if (!summary) return null;
  const { planned_other_costs, actual_cost_entries } = summary;
  const isUnbudgeted = form.linked_entity_id === null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await run(() => addActualCostEntry(form));
    if (ok) setForm(emptyForm);
  };

  return (
    <div className="screen">
      <h1>Other Costs Tracking</h1>
      {error && <p className="error-banner">{error}</p>}

      <EntryScope id="other-cost-form" onSubmit={submit}>
        <div className="matrix-scroll">
          <table className="entry-table">
            <thead>
              <tr>
                <th>Linked Item</th>
                <th className="col-wide">Description</th>
                <th>Amount (EUR)</th>
                <th>Date</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {actual_cost_entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.linked_entity_name ?? 'Unbudgeted'}</td>
                  <td>{entry.description}</td>
                  <td>{fmtEur(entry.amount_eur)}</td>
                  <td>{entry.incurred_date}</td>
                  <td>{entry.status}</td>
                  <td>
                    {entry.overspend_warning && <span className="warning-banner">&gt;10% over</span>}
                    <button
                      onClick={() => run(() => deleteActualCostEntry(entry.id))}
                      disabled={isSubmitting}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <EntryBlock
              columnCount={6}
              caption="Add a cost entry"
              details={
                isUnbudgeted ? (
                  <DetailField label="Justification (required for unbudgeted items)">
                    <EntryInput
                      value={form.justification ?? ''}
                      onChange={(e) => setForm({ ...form, justification: e.target.value || null })}
                      required
                    />
                  </DetailField>
                ) : undefined
              }
            >
              <td>
                <EntrySelect
                  aria-label="Linked item"
                  value={form.linked_entity_id ?? ''}
                  onChange={(e) => setForm({ ...form, linked_entity_id: e.target.value || null })}
                >
                  <option value="">Unbudgeted item</option>
                  {planned_other_costs.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} (planned {fmtEur(item.amount_eur)})
                    </option>
                  ))}
                </EntrySelect>
              </td>
              <td>
                <EntryInput
                  aria-label="Description"
                  placeholder="Description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  required
                />
              </td>
              <td>
                <EntryInput
                  aria-label="Amount (EUR)"
                  placeholder="Amount (EUR)"
                  value={form.amount_eur}
                  onChange={(e) => setForm({ ...form, amount_eur: e.target.value })}
                  required
                />
              </td>
              <td>
                <EntryInput
                  type="date"
                  aria-label="Date incurred"
                  value={form.incurred_date}
                  onChange={(e) => setForm({ ...form, incurred_date: e.target.value })}
                  required
                />
              </td>
              <td>
                <EntrySelect
                  aria-label="Status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as EntryStatus })}
                >
                  <option value="Approved">Approved</option>
                  <option value="Pending">Pending</option>
                  <option value="Rejected">Rejected</option>
                </EntrySelect>
              </td>
              <td>
                <EntrySubmit disabled={isSubmitting}>Add</EntrySubmit>
              </td>
            </EntryBlock>
          </table>
        </div>
      </EntryScope>
    </div>
  );
}
