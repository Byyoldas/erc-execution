import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { invoke } from '@tauri-apps/api/core';
import { LumpSumPlan } from './LumpSumPlan';
import { useExecutionStore } from '../store/executionStore';
import { emptyConsortiumPlanning } from '../__tests__/fixtures';
import type { ExecutionProjectSummaryDto } from '../types';

function seed(withPartners: boolean) {
  const partners = withPartners
    ? [
        { id: 'a', name: 'Own University', short_name: 'OWN', is_own_organization: true },
        { id: 'b', name: 'KTH', short_name: null, is_own_organization: false },
      ]
    : [];
  const summary = {
    ...emptyConsortiumPlanning(),
    funding_model: 'HorizonLumpSum',
    partner_organizations: partners,
    lump_sum_plan: {
      rows: withPartners
        ? [
            {
              work_package_id: 1,
              work_package_name: 'Management',
              cells: [
                { partner_id: 'a', amount_eur: '10000' },
                { partner_id: 'b', amount_eur: '0' },
              ],
              total_eur: '10000',
            },
          ]
        : [],
      partner_totals: withPartners
        ? [
            { partner_id: 'a', amount_eur: '10000' },
            { partner_id: 'b', amount_eur: '0' },
          ]
        : [],
      grand_total_eur: '10000',
    },
  } as unknown as ExecutionProjectSummaryDto;
  useExecutionStore.setState({ summary, activeScreen: 'lump-sum-plan' });
  return summary;
}

describe('LumpSumPlan screen', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it('asks for partners first when there are none', () => {
    seed(false);
    render(<LumpSumPlan />);
    expect(screen.getByText(/No partners yet/)).toBeTruthy();
  });

  it('renders every partner as an editable cell, including your own organization', () => {
    seed(true);
    render(<LumpSumPlan />);
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    expect(screen.getByLabelText('WP1 Own University')).toBeTruthy();
  });

  it('editing a cell sends the right command', async () => {
    const summary = seed(true);
    vi.mocked(invoke).mockResolvedValue(summary);
    render(<LumpSumPlan />);

    await userEvent.type(screen.getByLabelText('WP1 KTH'), '25000');
    await userEvent.tab();

    expect(invoke).toHaveBeenCalledWith('set_lump_sum_share', {
      work_package_id: 1,
      partner_id: 'b',
      amount: '25000',
    });
  });
});
