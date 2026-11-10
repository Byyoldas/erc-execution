/**
 * One editable euro amount in a planning matrix (Consortium Budget, Lump Sum
 * Plan). Commits on blur or Enter, never on every keystroke -- each commit
 * is a backend round-trip plus an auto-save. Blank clears the cell.
 */

import { useEffect, useState } from 'react';
import { displayAmount, parseAmountInput, sameAmount } from '../utils/consortium';

interface AmountCellProps {
  /** The backend's current decimal string for this cell ("0" when unset). */
  value: string;
  ariaLabel: string;
  disabled?: boolean;
  /** Resolves `true` when the backend accepted the change. */
  onCommit: (amount: string | null) => Promise<boolean>;
}

export function AmountCell({ value, ariaLabel, disabled, onCommit }: AmountCellProps) {
  const [draft, setDraft] = useState(displayAmount(value));
  const [invalid, setInvalid] = useState<string | null>(null);

  // Follow the backend whenever it sends a new figure (after any mutation).
  useEffect(() => {
    setDraft(displayAmount(value));
    setInvalid(null);
  }, [value]);

  const commit = async () => {
    const parsed = parseAmountInput(draft);
    if (!parsed.ok) {
      setInvalid(parsed.message);
      return;
    }
    setInvalid(null);
    if (sameAmount(value, parsed.value)) {
      // Nothing changed -- just normalise what's shown (e.g. "1,000" -> "1000").
      setDraft(displayAmount(value));
      return;
    }
    const accepted = await onCommit(parsed.value);
    if (!accepted) setDraft(displayAmount(value));
  };

  return (
    <input
      className={`amount-cell${invalid ? ' amount-cell-invalid' : ''}`}
      inputMode="decimal"
      placeholder="0"
      aria-label={ariaLabel}
      title={invalid ?? undefined}
      aria-invalid={invalid ? true : undefined}
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setDraft(displayAmount(value));
          setInvalid(null);
        }
      }}
    />
  );
}
