/**
 * Left navigation panel. Sprint E2 added Personnel/Work Packages/Milestones
 * (M-03/M-04/M-06) and Amendments; Sprint E3 added Travel/Equipment/Other
 * Costs/Subcontracting (M-08–M-11); Sprint E4 added Deliverables (M-05) and
 * Reporting Periods (M-14); Sprint E5 added Risk Register (M-12) and Issue
 * Log (M-13); Sprint E7 adds Reports & Export (M-20) — the last real
 * MVP-catalogue module.
 */

import { useExecutionStore } from '../store/executionStore';
import type { ExecutionScreen } from '../types';
import { SaveButton } from './SaveButton';

/**
 * Ordered by data dependency, not by module number -- a screen never
 * appears before something its own data can reference:
 * - Partners before Personnel (Person.partner_organization_id)
 * - Personnel before Travel (TripExecution.traveller_person_id)
 * - Deliverables before Milestones (Milestone.linked_deliverable_ids)
 * - Risk Register before Issue Log (IssueEntry.linked_risk_id)
 * Work Packages, Equipment, Other Costs, Subcontracting, Reporting
 * Periods, and Amendments only reference Budget App data (already
 * available the moment a project opens, no execution-side screen visit
 * required), so their relative position isn't dependency-constrained --
 * Work Packages stays early since nearly every other screen's "Work
 * Package" dropdown draws from it. Reports & Export is last, since it
 * depends on everything.
 */
const MODULES: { label: string; screen: ExecutionScreen | null }[] = [
  { label: 'Dashboard', screen: 'dashboard' },
  { label: 'Partners', screen: 'partners' },
  { label: 'Work Packages', screen: 'work-packages' },
  { label: 'Personnel', screen: 'personnel' },
  { label: 'Deliverables', screen: 'deliverables' },
  { label: 'Milestones', screen: 'milestones' },
  { label: 'Amendments', screen: 'amendments' },
  { label: 'Travel', screen: 'travel' },
  { label: 'Equipment', screen: 'equipment' },
  { label: 'Other Costs', screen: 'other-costs' },
  { label: 'Subcontracting', screen: 'subcontracting' },
  { label: 'Reporting Periods', screen: 'reporting-periods' },
  { label: 'Risk Register', screen: 'risk-register' },
  { label: 'Issue Log', screen: 'issue-log' },
  { label: 'Reports & Export', screen: 'reports-export' },
];

export function Sidebar() {
  const activeScreen = useExecutionStore((s) => s.activeScreen);
  const setActiveScreen = useExecutionStore((s) => s.setActiveScreen);

  return (
    <nav className="sidebar">
      <div className="sidebar-title">ERC Execution</div>
      <SaveButton />
      <ul>
        {MODULES.map((m) => (
          <li
            key={m.label}
            className={m.screen === null ? 'disabled' : m.screen === activeScreen ? 'active' : ''}
            onClick={() => m.screen && setActiveScreen(m.screen)}
          >
            {m.label}
          </li>
        ))}
      </ul>
    </nav>
  );
}
