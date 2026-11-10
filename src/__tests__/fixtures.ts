/**
 * Shared test fixtures. `emptyConsortiumPlanning()` supplies the M-25 fields
 * of `ExecutionProjectSummaryDto` for a plain ERC project with no consortium
 * data, so summary fixtures only spell out what a given test cares about.
 */

import type { CostCategory, ExecutionProjectSummaryDto } from '../types';

const ZERO_AMOUNTS: Record<CostCategory, string> = {
  A: '0',
  B: '0',
  C1: '0',
  C2: '0',
  C3: '0',
  D: '0',
  E: '0',
};

export function emptyConsortiumPlanning(): Pick<
  ExecutionProjectSummaryDto,
  'funding_model' | 'consortium_budget' | 'lump_sum_plan'
> {
  return {
    funding_model: 'Erc',
    consortium_budget: {
      rows: [],
      total_amounts: { ...ZERO_AMOUNTS },
      total_eligible_eur: '0',
      total_requested_eu_contribution_eur: '0',
      has_own_organization: false,
    },
    lump_sum_plan: { rows: [], partner_totals: [], grand_total_eur: '0' },
  };
}
