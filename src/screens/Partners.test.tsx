import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { invoke } from '@tauri-apps/api/core';
import { Partners } from './Partners';
import { useExecutionStore } from '../store/executionStore';
import { emptyConsortiumPlanning } from '../__tests__/fixtures';
import type {
  ExecutionProjectSummaryDto,
  FundingModel,
  PartnerOrganizationDetailDto,
} from '../types';

const kth: PartnerOrganizationDetailDto = {
  id: 'kth-id',
  name: 'KTH',
  short_name: null,
  country: 'Sweden',
  pic_number: null,
  role: 'Beneficiary',
  contact_name: null,
  contact_email: null,
  validation_status: 'NotStarted',
  grant_agreement_signed: false,
  planned_budget_share_eur: null,
  notes: null,
  is_own_organization: false,
  funding_rate_pct: '70',
  actual_personnel_cost_eur: '0',
  linked_person_count: 0,
  over_budget_warning: false,
};

function seed(model: FundingModel, partners = [kth]) {
  const summary = {
    ...emptyConsortiumPlanning(),
    funding_model: model,
    partner_organizations: partners,
    persons: [],
  } as unknown as ExecutionProjectSummaryDto;
  useExecutionStore.setState({ summary, activeScreen: 'partners' });
  return summary;
}

describe('Partners screen', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it('ERC: shows no own-organization or funding-rate fields (unchanged screen)', () => {
    seed('Erc');
    render(<Partners />);
    expect(screen.queryByLabelText('My organization')).toBeNull();
    expect(screen.queryByLabelText('EU funding rate percent')).toBeNull();
    expect(screen.getByPlaceholderText('Planned budget share (€)')).toBeTruthy();
  });

  it('actual cost: shows both new fields and hides the legacy planned share', () => {
    seed('HorizonActualCost');
    render(<Partners />);
    expect(screen.getByLabelText('My organization')).toBeTruthy();
    expect(screen.getByLabelText('EU funding rate percent')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Planned budget share (€)')).toBeNull();
  });

  it('lump sum: shows the own-organization box but no funding rate', () => {
    seed('HorizonLumpSum');
    render(<Partners />);
    expect(screen.getByLabelText('My organization')).toBeTruthy();
    expect(screen.queryByLabelText('EU funding rate percent')).toBeNull();
  });

  it('Edit loads the partner into the form and saves through update, not add', async () => {
    const summary = seed('HorizonActualCost');
    vi.mocked(invoke).mockResolvedValue(summary);
    render(<Partners />);

    const row = screen.getAllByRole('row').find((r) => within(r).queryByText('KTH'))!;
    await userEvent.click(within(row).getByRole('button', { name: 'Edit' }));

    expect((screen.getByPlaceholderText('Name') as HTMLInputElement).value).toBe('KTH');
    expect((screen.getByLabelText('EU funding rate percent') as HTMLInputElement).value).toBe('70');

    await userEvent.click(screen.getByLabelText('My organization'));
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(invoke).toHaveBeenCalledTimes(1);
    const [command, args] = vi.mocked(invoke).mock.calls[0] as [string, Record<string, unknown>];
    expect(command).toBe('update_partner_organization');
    expect(args.id).toBe('kth-id');
    expect((args.input as { is_own_organization: boolean }).is_own_organization).toBe(true);
    expect((args.input as { funding_rate_pct: string }).funding_rate_pct).toBe('70');
  });

  it('Cancel leaves edit mode without saving', async () => {
    seed('Erc');
    render(<Partners />);
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Add Partner' })).toBeTruthy();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('marks the own organization in the table', () => {
    seed('HorizonActualCost', [{ ...kth, is_own_organization: true }]);
    render(<Partners />);
    expect(screen.getByText('your organization')).toBeTruthy();
  });
});
