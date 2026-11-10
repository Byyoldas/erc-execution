import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { setFundingModel, setLumpSumShare, setPartnerBudgetAmount } from './commands';

/**
 * Argument names must match the Rust side exactly. The M-25 commands are
 * declared `#[tauri::command(rename_all = "snake_case")]`, so the payload
 * keys must be snake_case -- camelCase would be silently rejected by Tauri
 * at runtime and no Rust unit test could catch it.
 */
describe('M-25 IPC payloads', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockClear();
  });

  it('set_funding_model', async () => {
    await setFundingModel('HorizonLumpSum');
    expect(invoke).toHaveBeenCalledWith('set_funding_model', { model: 'HorizonLumpSum' });
  });

  it('set_partner_budget_amount uses snake_case argument names', async () => {
    await setPartnerBudgetAmount('p-1', 'C2', '1500.50');
    expect(invoke).toHaveBeenCalledWith('set_partner_budget_amount', {
      partner_id: 'p-1',
      category: 'C2',
      amount: '1500.50',
    });
  });

  it('set_lump_sum_share uses snake_case argument names', async () => {
    await setLumpSumShare(3, 'p-1', null);
    expect(invoke).toHaveBeenCalledWith('set_lump_sum_share', {
      work_package_id: 3,
      partner_id: 'p-1',
      amount: null,
    });
  });
});
