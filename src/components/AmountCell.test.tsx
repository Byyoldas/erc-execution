import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AmountCell } from './AmountCell';

function setup(value = '0', onCommit = vi.fn().mockResolvedValue(true)) {
  render(<AmountCell value={value} ariaLabel="cell" onCommit={onCommit} />);
  return { input: screen.getByLabelText('cell') as HTMLInputElement, onCommit };
}

describe('AmountCell', () => {
  it('shows blank for a zero amount and the stored value otherwise', () => {
    expect(setup('0').input.value).toBe('');
  });

  it('shows an existing amount', () => {
    expect(setup('2500.5').input.value).toBe('2500.5');
  });

  it('commits the parsed amount on blur', async () => {
    const { input, onCommit } = setup();
    await userEvent.type(input, '1,500');
    await userEvent.tab();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('1500');
  });

  it('commits on Enter', async () => {
    const { input, onCommit } = setup();
    await userEvent.type(input, '42{Enter}');
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('42');
  });

  it('does not commit while typing', async () => {
    const { input, onCommit } = setup();
    await userEvent.type(input, '123');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits null when an existing amount is cleared', async () => {
    const { input, onCommit } = setup('900');
    await userEvent.clear(input);
    await userEvent.tab();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(null);
  });

  it('does not commit when nothing changed', async () => {
    const { input, onCommit } = setup('900.00');
    await userEvent.click(input);
    await userEvent.type(input, '{Backspace}0'); // 900.00 -> 900.0, numerically unchanged
    await userEvent.tab();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('flags invalid input and never commits it', async () => {
    const { input, onCommit } = setup();
    await userEvent.type(input, 'abc');
    await userEvent.tab();
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('reverts to the stored value when the backend rejects the change', async () => {
    const { input, onCommit } = setup('100', vi.fn().mockResolvedValue(false));
    await userEvent.clear(input);
    await userEvent.type(input, '999');
    await userEvent.tab();
    expect(onCommit).toHaveBeenCalledWith('999');
    expect(input.value).toBe('100');
  });

  it('Escape discards the draft', async () => {
    const { input, onCommit } = setup('100');
    await userEvent.clear(input);
    await userEvent.type(input, '555{Escape}');
    expect(input.value).toBe('100');
    await userEvent.tab();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('follows the backend when the stored value changes', () => {
    const { rerender } = render(<AmountCell value="10" ariaLabel="x" onCommit={vi.fn()} />);
    rerender(<AmountCell value="20" ariaLabel="x" onCommit={vi.fn()} />);
    expect((screen.getByLabelText('x') as HTMLInputElement).value).toBe('20');
  });
});
