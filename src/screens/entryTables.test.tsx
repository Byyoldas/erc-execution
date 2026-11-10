/**
 * Alignment guard: every table that carries an add-form must have exactly one
 * entry cell per column header, so each input sits under its own column title.
 * (jsdom can't measure layout, but a count mismatch is precisely what would
 * make the entry row drift out of alignment.)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import type { ComponentType } from 'react';
import { useExecutionStore } from '../store/executionStore';
import { emptyConsortiumPlanning } from '../__tests__/fixtures';
import type { ExecutionProjectSummaryDto, FundingModel } from '../types';
import { Amendments } from './Amendments';
import { Deliverables } from './Deliverables';
import { Equipment } from './Equipment';
import { IssueLog } from './IssueLog';
import { Milestones } from './Milestones';
import { OtherCosts } from './OtherCosts';
import { Partners } from './Partners';
import { Personnel } from './Personnel';
import { ReportingPeriods } from './ReportingPeriods';
import { RiskRegister } from './RiskRegister';
import { Subcontracting } from './Subcontracting';
import { Travel } from './Travel';

function seed(model: FundingModel = 'Erc') {
  const summary = {
    ...emptyConsortiumPlanning(),
    funding_model: model,
    personnel_roles: [],
    planned_trips: [],
    planned_equipment: [],
    planned_other_costs: [],
    persons: [],
    person_months: [],
    milestones: [],
    amendments: [],
    trip_executions: [],
    equipment_procurements: [],
    actual_cost_entries: [],
    subcontracting_lines: [],
    deliverables: [],
    reporting_periods: [],
    reporting_period_coverage: { gaps_detected: false, final_period_covers_project_end: true },
    risks: [],
    issues: [],
    partner_organizations: [],
  } as unknown as ExecutionProjectSummaryDto;
  useExecutionStore.setState({ summary });
}

const SCREENS: [string, ComponentType, number][] = [
  ['Amendments', Amendments, 1],
  ['Deliverables', Deliverables, 1],
  ['Equipment', Equipment, 1],
  ['IssueLog', IssueLog, 1],
  ['Milestones', Milestones, 1],
  ['OtherCosts', OtherCosts, 1],
  ['Partners', Partners, 1],
  ['Personnel', Personnel, 2],
  ['ReportingPeriods', ReportingPeriods, 1],
  ['RiskRegister', RiskRegister, 1],
  ['Subcontracting', Subcontracting, 1],
  ['Travel', Travel, 1],
];

describe('entry tables stay aligned with their column headers', () => {
  beforeEach(() => seed());

  it.each(SCREENS)('%s: one entry cell per column header', (_name, Screen, expectedTables) => {
    const { container } = render(<Screen />);
    const tables = container.querySelectorAll('table.entry-table');
    expect(tables.length).toBe(expectedTables);

    tables.forEach((table) => {
      const headers = table.querySelectorAll('thead th').length;
      const entryCells = table.querySelectorAll('.entry-row > td').length;
      expect(entryCells).toBe(headers);
      // The caption and details rows span the full width.
      const caption = table.querySelector('.entry-caption > td');
      expect(Number(caption?.getAttribute('colspan'))).toBe(headers);
    });
  });

  it.each(['Erc', 'HorizonActualCost', 'HorizonLumpSum'] as FundingModel[])(
    'Partners (%s): entry cells match headers in every funding model',
    (model) => {
      seed(model);
      const { container } = render(<Partners />);
      const table = container.querySelector('table.entry-table')!;
      expect(table.querySelectorAll('.entry-row > td').length).toBe(
        table.querySelectorAll('thead th').length,
      );
    },
  );

  it('every control in an entry row is wired to its form', () => {
    for (const [, Screen] of SCREENS) {
      const { container, unmount } = render(<Screen />);
      container
        .querySelectorAll('.entry-row input, .entry-row select, .entry-details input, .entry-details select')
        .forEach((control) => {
          expect(control.getAttribute('form')).toBeTruthy();
        });
      unmount();
    }
  });
});
