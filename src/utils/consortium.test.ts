import { describe, it, expect } from 'vitest';
import {
  displayAmount,
  isZeroAmount,
  parseAmountInput,
  plannedTotalForPartner,
  sameAmount,
} from './consortium';
import { emptyConsortiumPlanning } from '../__tests__/fixtures';
import type { ExecutionProjectSummaryDto, PartnerOrganizationDetailDto } from '../types';

describe('isZeroAmount', () => {
  it.each([null, undefined, '', '  ', '0', '0.00', 'abc'])('treats %j as zero/blank', (v) => {
    expect(isZeroAmount(v as string | null | undefined)).toBe(true);
  });
  it.each(['1', '0.01', '1234.50'])('treats %j as a real amount', (v) => {
    expect(isZeroAmount(v)).toBe(false);
  });
});

describe('parseAmountInput', () => {
  it('treats blank as "clear the cell"', () => {
    expect(parseAmountInput('')).toEqual({ ok: true, value: null });
    expect(parseAmountInput('   ')).toEqual({ ok: true, value: null });
  });
  it('accepts plain amounts with up to two decimals', () => {
    expect(parseAmountInput('1000')).toEqual({ ok: true, value: '1000' });
    expect(parseAmountInput('1000.5')).toEqual({ ok: true, value: '1000.5' });
    expect(parseAmountInput('1000.55')).toEqual({ ok: true, value: '1000.55' });
  });
  it('strips thousands separators and spaces', () => {
    expect(parseAmountInput('1,234,567.89')).toEqual({ ok: true, value: '1234567.89' });
    expect(parseAmountInput(' 1 000 ')).toEqual({ ok: true, value: '1000' });
  });
  it.each(['-5', '1.234', 'abc', '1e5', '12.', '.5', '€100'])('rejects %j', (raw) => {
    const result = parseAmountInput(raw);
    expect(result.ok).toBe(false);
  });
});

describe('sameAmount / displayAmount', () => {
  it('compares numerically, not as strings', () => {
    expect(sameAmount('1000.00', '1000')).toBe(true);
    expect(sameAmount('1000', '1000.5')).toBe(false);
  });
  it('treats unset and zero as equal', () => {
    expect(sameAmount('0', null)).toBe(true);
    expect(sameAmount('0.00', '0')).toBe(true);
    expect(sameAmount('0', '5')).toBe(false);
  });
  it('shows blank for zero and the stored string otherwise', () => {
    expect(displayAmount('0')).toBe('');
    expect(displayAmount('0.00')).toBe('');
    expect(displayAmount('2500.5')).toBe('2500.5');
  });
});

function partner(id: string, overrides: Partial<PartnerOrganizationDetailDto> = {}) {
  return {
    id,
    name: `Partner ${id}`,
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
    funding_rate_pct: null,
    actual_personnel_cost_eur: '0',
    linked_person_count: 0,
    over_budget_warning: false,
    ...overrides,
  } as PartnerOrganizationDetailDto;
}

function summaryWith(overrides: Partial<ExecutionProjectSummaryDto>): ExecutionProjectSummaryDto {
  return {
    partner_organizations: [],
    ...emptyConsortiumPlanning(),
    ...overrides,
  } as unknown as ExecutionProjectSummaryDto;
}

describe('plannedTotalForPartner', () => {
  it('ERC: uses the legacy hand-entered planned share', () => {
    const s = summaryWith({
      partner_organizations: [partner('p1', { planned_budget_share_eur: '450000' })],
    });
    expect(plannedTotalForPartner(s, 'p1')).toBe('450000');
  });

  it('ERC: is null when no share was entered', () => {
    const s = summaryWith({ partner_organizations: [partner('p1')] });
    expect(plannedTotalForPartner(s, 'p1')).toBeNull();
  });

  it('actual cost: uses the consortium budget row, ignoring the legacy share', () => {
    const base = emptyConsortiumPlanning();
    const s = summaryWith({
      funding_model: 'HorizonActualCost',
      partner_organizations: [partner('p1', { planned_budget_share_eur: '1' })],
      consortium_budget: {
        ...base.consortium_budget,
        rows: [
          {
            partner_id: 'p1',
            partner_name: 'Partner p1',
            is_own_organization: false,
            source: 'Entered',
            amounts: { ...base.consortium_budget.total_amounts, A: '200000' },
            total_eligible_eur: '200000',
            funding_rate_pct: '100',
            requested_eu_contribution_eur: '200000',
          },
        ],
      },
    });
    expect(plannedTotalForPartner(s, 'p1')).toBe('200000');
  });

  it('actual cost: a partner with no row, or a zero total, shows nothing', () => {
    const s = summaryWith({ funding_model: 'HorizonActualCost' });
    expect(plannedTotalForPartner(s, 'missing')).toBeNull();
  });

  it('lump sum: uses the partner total across work packages', () => {
    const s = summaryWith({
      funding_model: 'HorizonLumpSum',
      lump_sum_plan: {
        rows: [],
        partner_totals: [
          { partner_id: 'p1', amount_eur: '80000' },
          { partner_id: 'p2', amount_eur: '0' },
        ],
        grand_total_eur: '80000',
      },
    });
    expect(plannedTotalForPartner(s, 'p1')).toBe('80000');
    expect(plannedTotalForPartner(s, 'p2')).toBeNull();
  });
});
