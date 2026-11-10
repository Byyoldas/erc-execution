import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { invoke } from '@tauri-apps/api/core';
import { ConsortiumBudget } from './ConsortiumBudget';
import { useExecutionStore } from '../store/executionStore';
import { emptyConsortiumPlanning } from '../__tests__/fixtures';
import type { ConsortiumBudgetRowDto, ExecutionProjectSummaryDto } from '../types';

const ZERO = { A: '0', B: '0', C1: '0', C2: '0', C3: '0', D: '0', E: '0' } as const;

const ownRow: ConsortiumBudgetRowDto = {
  partner_id: 'own',
  partner_name: 'Own University',
  is_own_organization: true,
  source: 'BudgetFile',
  amounts: { ...ZERO, A: '100000', E: '25000' },
  total_eligible_eur: '125000',
  funding_rate_pct: null,
  requested_eu_contribution_eur: '125000',
};

const kthRow: ConsortiumBudgetRowDto = {
  partner_id: 'kth',
  partner_name: 'KTH',
  is_own_organization: false,
  source: 'Entered',
  amounts: { ...ZERO, A: '200000' },
  total_eligible_eur: '200000',
  funding_rate_pct: '100',
  requested_eu_contribution_eur: '200000',
};

function seed(rows: ConsortiumBudgetRowDto[], hasOwn: boolean) {
  const base = emptyConsortiumPlanning();
  const summary = {
    ...base,
    funding_model: 'HorizonActualCost',
    consortium_budget: {
      ...base.consortium_budget,
      rows,
      has_own_organization: hasOwn,
      total_eligible_eur: '325000',
      total_requested_eu_contribution_eur: '325000',
    },
    partner_organizations: [],
  } as unknown as ExecutionProjectSummaryDto;
  useExecutionStore.setState({ summary, activeScreen: 'consortium-budget' });
  return summary;
}

describe('ConsortiumBudget screen', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it('own organization row is read-only; other partners are editable', () => {
    seed([ownRow, kthRow], true);
    render(<ConsortiumBudget />);

    const rows = screen.getAllByRole('row');
    const own = rows.find((r) => within(r).queryByText(/Own University/))!;
    const kth = rows.find((r) => within(r).queryByText('KTH'))!;

    expect(within(own).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(kth).getAllByRole('textbox')).toHaveLength(7);
    expect(within(own).getByText(/from the Budget file/)).toBeTruthy();
  });

  it('warns when no partner is marked as the own organization', () => {
    seed([kthRow], false);
    render(<ConsortiumBudget />);
    expect(screen.getByText(/None of your partners/)).toBeTruthy();
  });

  it('does not warn when an own organization exists', () => {
    seed([ownRow, kthRow], true);
    render(<ConsortiumBudget />);
    expect(screen.queryByText(/None of your partners/)).toBeNull();
  });

  it('asks the user to add partners when there are none', () => {
    seed([], false);
    render(<ConsortiumBudget />);
    expect(screen.getByText(/No partners yet/)).toBeTruthy();
  });

  it('editing a cell sends the right command', async () => {
    const summary = seed([kthRow], false);
    vi.mocked(invoke).mockResolvedValue(summary);
    render(<ConsortiumBudget />);

    const cell = screen.getByLabelText(/KTH C2/);
    await userEvent.type(cell, '15000');
    await userEvent.tab();

    expect(invoke).toHaveBeenCalledWith('set_partner_budget_amount', {
      partner_id: 'kth',
      category: 'C2',
      amount: '15000',
    });
  });

  it('shows the consortium totals row', () => {
    seed([ownRow, kthRow], true);
    render(<ConsortiumBudget />);
    expect(screen.getByText('Consortium total')).toBeTruthy();
  });
});
