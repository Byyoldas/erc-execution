/**
 * M-25 helpers shared by the funding-model screens: labels, amount-input
 * parsing, and "which planned total applies to this partner right now".
 */

import type { CostCategory, ExecutionProjectSummaryDto, FundingModel } from '../types';

/** Budget-table order, matching the backend's `CostCategory::ALL`. */
export const COST_CATEGORIES: CostCategory[] = ['A', 'B', 'C1', 'C2', 'C3', 'D', 'E'];

export const COST_CATEGORY_LABEL: Record<CostCategory, string> = {
  A: 'Personnel',
  B: 'Subcontracting',
  C1: 'Travel',
  C2: 'Equipment',
  C3: 'Other goods & services',
  D: 'Other categories',
  E: 'Indirect (25%)',
};

export const FUNDING_MODELS: FundingModel[] = ['Erc', 'HorizonActualCost', 'HorizonLumpSum'];

export const FUNDING_MODEL_LABEL: Record<FundingModel, string> = {
  Erc: 'ERC grant',
  HorizonActualCost: 'Horizon Europe — actual costs',
  HorizonLumpSum: 'Horizon Europe — lump sum',
};

export const FUNDING_MODEL_DESCRIPTION: Record<FundingModel, string> = {
  Erc: 'Single beneficiary. Planned figures come entirely from the Budget file.',
  HorizonActualCost:
    'Consortium. Your organization’s planned costs come from the Budget file; enter every other partner’s planned costs per category.',
  HorizonLumpSum:
    'Consortium. Enter each partner’s planned lump-sum share of every work package.',
};

/** True for null/empty/zero amounts, which the UI shows as blank or "—". */
export function isZeroAmount(value: string | null | undefined): boolean {
  if (value === null || value === undefined || value.trim() === '') return true;
  const n = Number(value);
  return Number.isNaN(n) || n === 0;
}

/**
 * The planned total that applies to one partner under the active funding
 * model, or `null` when there is nothing to show:
 * - ERC: the legacy, hand-entered `planned_budget_share_eur` (M-24).
 * - Horizon actual cost: that partner's total eligible cost in the
 *   consortium budget (the own organization's figure is from the Budget file).
 * - Horizon lump sum: that partner's total across all work packages.
 */
export function plannedTotalForPartner(
  summary: ExecutionProjectSummaryDto,
  partnerId: string,
): string | null {
  let total: string | null | undefined;

  switch (summary.funding_model) {
    case 'HorizonActualCost':
      total = summary.consortium_budget.rows.find((r) => r.partner_id === partnerId)
        ?.total_eligible_eur;
      break;
    case 'HorizonLumpSum':
      total = summary.lump_sum_plan.partner_totals.find((t) => t.partner_id === partnerId)
        ?.amount_eur;
      break;
    default:
      total = summary.partner_organizations.find((p) => p.id === partnerId)
        ?.planned_budget_share_eur;
  }

  return isZeroAmount(total) ? null : (total as string);
}

export type AmountParse = { ok: true; value: string | null } | { ok: false; message: string };

/**
 * Parses what a user typed into an amount cell. Blank means "clear the
 * cell" (`value: null`). Accepts plain non-negative numbers with at most two
 * decimals; thousands separators are tolerated and stripped.
 */
export function parseAmountInput(raw: string): AmountParse {
  const cleaned = raw.trim().replace(/[,\s]/g, '');
  if (cleaned === '') return { ok: true, value: null };
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return { ok: false, message: 'Enter a non-negative amount with at most 2 decimals.' };
  }
  return { ok: true, value: cleaned };
}

/** Numeric equality between a typed value and the stored decimal string. */
export function sameAmount(stored: string, typed: string | null): boolean {
  const a = isZeroAmount(stored) ? 0 : Number(stored);
  const b = typed === null || isZeroAmount(typed) ? 0 : Number(typed);
  return a === b;
}

/** What an amount cell shows: blank for zero, otherwise the stored string. */
export function displayAmount(stored: string): string {
  return isZeroAmount(stored) ? '' : stored;
}
