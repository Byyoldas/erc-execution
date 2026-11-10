/**
 * M-13: Issue Log. `is_stale_warning` (BR-IS-02) flags a High-priority Open
 * issue unresolved for more than 14 days. Closing an issue without a
 * resolution is rejected server-side (BR-IS-01).
 */

import { useState } from 'react';
import { DetailField, EntryBlock, EntryInput, EntryScope, EntrySelect, EntrySubmit } from '../components/EntryTable';
import { useExecutionStore } from '../store/executionStore';
import { useExecutionMutation } from '../hooks/useExecutionMutation';
import { addIssueEntry, deleteIssueEntry } from '../ipc/commands';
import type { IssueEntryInputDto, Level } from '../types';

const LEVELS: Level[] = ['Low', 'Medium', 'High'];

const emptyForm: IssueEntryInputDto = {
  description: '',
  work_package_id: null,
  raised_date: '',
  priority: 'Medium',
  owner_role_id: null,
  status: 'Open',
  resolution: null,
  linked_risk_id: null,
};

export function IssueLog() {
  const summary = useExecutionStore((s) => s.summary);
  const { run, error, isSubmitting } = useExecutionMutation();
  const [form, setForm] = useState(emptyForm);

  if (!summary) return null;
  const { issues, risks } = summary;
  const openCount = issues.filter((i) => i.status === 'Open').length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await run(() => addIssueEntry(form));
    if (ok) setForm(emptyForm);
  };

  return (
    <div className="screen">
      <h1>Issue Log</h1>
      {error && <p className="error-banner">{error}</p>}
      <p>Open issues: {openCount}</p>

      <EntryScope id="issue-form" onSubmit={submit}>
        <div className="matrix-scroll">
          <table className="entry-table">
            <thead>
              <tr>
                <th className="col-wide">Description</th>
                <th>WP</th>
                <th>Raised</th>
                <th>Priority</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {issues.map((i) => (
                <tr key={i.id}>
                  <td>{i.description}</td>
                  <td>{i.work_package_id ? `WP${i.work_package_id}` : '—'}</td>
                  <td>{i.raised_date}</td>
                  <td>{i.priority}</td>
                  <td>
                    {i.status}
                    {i.is_stale_warning && <span className="warning-banner"> Stale &gt;14d</span>}
                  </td>
                  <td>
                    <button onClick={() => run(() => deleteIssueEntry(i.id))} disabled={isSubmitting}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <EntryBlock
              columnCount={6}
              caption="Add an issue"
              details={
                <>
                  <DetailField label="Linked risk (optional)">
                    <EntrySelect
                      value={form.linked_risk_id ?? ''}
                      onChange={(e) => setForm({ ...form, linked_risk_id: e.target.value || null })}
                    >
                      <option value="">None</option>
                      {risks.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title}
                        </option>
                      ))}
                    </EntrySelect>
                  </DetailField>
                </>
              }
            >
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
                  type="number"
                  min={1}
                  aria-label="Work package"
                  placeholder="WP"
                  value={form.work_package_id ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, work_package_id: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </td>
              <td>
                <EntryInput
                  type="date"
                  aria-label="Raised date"
                  value={form.raised_date}
                  onChange={(e) => setForm({ ...form, raised_date: e.target.value })}
                  required
                />
              </td>
              <td>
                <EntrySelect
                  aria-label="Priority"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value as Level })}
                >
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </EntrySelect>
              </td>
              <td>
                <span className="subtitle hint">Open</span>
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
