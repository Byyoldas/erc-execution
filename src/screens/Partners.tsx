/**
 * M-24: Partner Organization Management. Consortium data tracking, not a
 * shared cross-organization workspace — see
 * docs/partner-organizations-requirements.md §1. Actual cost is personnel
 * only (BR-PO-05); other categories aren't allocated to a partner yet, same
 * limitation Work Package actual cost has always had (§6).
 */

import { useState } from 'react';
import { useExecutionStore } from '../store/executionStore';
import { useExecutionMutation } from '../hooks/useExecutionMutation';
import { addPartnerOrganization, deletePartnerOrganization } from '../ipc/commands';
import { fmtEur } from '../utils/currency';
import type { PartnerOrganizationInputDto, PartnerRole, PartnerValidationStatus } from '../types';

const ROLES: PartnerRole[] = ['Coordinator', 'Beneficiary', 'AssociatedPartner'];
const VALIDATION_STATUSES: PartnerValidationStatus[] = ['NotStarted', 'Pending', 'Validated'];

const ROLE_LABEL: Record<PartnerRole, string> = {
  Coordinator: 'Coordinator',
  Beneficiary: 'Beneficiary',
  AssociatedPartner: 'Associated Partner',
};

const emptyForm: PartnerOrganizationInputDto = {
  name: '',
  short_name: null,
  country: '',
  pic_number: null,
  role: 'Beneficiary',
  contact_name: null,
  contact_email: null,
  validation_status: 'NotStarted',
  grant_agreement_signed: false,
  planned_budget_share_eur: null,
  notes: null,
};

export function Partners() {
  const summary = useExecutionStore((s) => s.summary);
  const setActiveScreen = useExecutionStore((s) => s.setActiveScreen);
  const { run, error, isSubmitting } = useExecutionMutation();
  const [form, setForm] = useState(emptyForm);

  if (!summary) return null;
  const { partner_organizations: partners, persons } = summary;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await run(() => addPartnerOrganization(form));
    if (ok) setForm(emptyForm);
  };

  const linkedNames = (partnerId: string) =>
    persons.filter((p) => p.partner_organization_id === partnerId).map((p) => p.full_name);

  return (
    <div className="screen">
      <h1>Partners</h1>
      {error && <p className="error-banner">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Country</th>
            <th>Validation</th>
            <th>GA Signed</th>
            <th>Planned Share</th>
            <th>Actual (personnel only)</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {partners.map((p) => {
            const linked = linkedNames(p.id);
            return (
              <tr key={p.id}>
                <td>
                  {p.name}
                  {p.short_name && <div className="subtitle">{p.short_name}</div>}
                </td>
                <td>{p.role === 'Coordinator' ? <strong>Coordinator</strong> : ROLE_LABEL[p.role]}</td>
                <td>{p.country}</td>
                <td>{p.validation_status}</td>
                <td>{p.grant_agreement_signed ? '✓' : '—'}</td>
                <td>{p.planned_budget_share_eur ? fmtEur(p.planned_budget_share_eur) : '—'}</td>
                <td>
                  {fmtEur(p.actual_personnel_cost_eur)}
                  {p.over_budget_warning && ' ⚠️'}
                </td>
                <td>
                  {linked.length > 0 ? (
                    <span className="subtitle" title={linked.join(', ')}>
                      Linked: {linked.length} —{' '}
                      <button onClick={() => setActiveScreen('personnel')}>view</button>
                    </span>
                  ) : (
                    <button
                      onClick={() => run(() => deletePartnerOrganization(p.id))}
                      disabled={isSubmitting}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <form onSubmit={submit} className="inline-form">
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          placeholder="Short name"
          value={form.short_name ?? ''}
          onChange={(e) => setForm({ ...form, short_name: e.target.value || null })}
        />
        <input
          placeholder="Country"
          value={form.country}
          onChange={(e) => setForm({ ...form, country: e.target.value })}
          required
        />
        <input
          placeholder="PIC number"
          value={form.pic_number ?? ''}
          onChange={(e) => setForm({ ...form, pic_number: e.target.value || null })}
        />
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value as PartnerRole })}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <input
          placeholder="Contact name"
          value={form.contact_name ?? ''}
          onChange={(e) => setForm({ ...form, contact_name: e.target.value || null })}
        />
        <input
          placeholder="Contact email"
          value={form.contact_email ?? ''}
          onChange={(e) => setForm({ ...form, contact_email: e.target.value || null })}
        />
        <select
          value={form.validation_status}
          onChange={(e) =>
            setForm({ ...form, validation_status: e.target.value as PartnerValidationStatus })
          }
        >
          {VALIDATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <label>
          <input
            type="checkbox"
            checked={form.grant_agreement_signed}
            onChange={(e) => setForm({ ...form, grant_agreement_signed: e.target.checked })}
          />
          GA signed
        </label>
        <input
          placeholder="Planned budget share (€)"
          value={form.planned_budget_share_eur ?? ''}
          onChange={(e) => setForm({ ...form, planned_budget_share_eur: e.target.value || null })}
        />
        <button type="submit" disabled={isSubmitting}>
          Add Partner
        </button>
      </form>
    </div>
  );
}
