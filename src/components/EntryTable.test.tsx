import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntryBlock, EntryInput, EntryScope, EntrySubmit } from './EntryTable';

function Harness({ onSubmit, onDelete }: { onSubmit: () => void; onDelete: () => void }) {
  return (
    <EntryScope
      id="test-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Existing row</td>
            <td>
              <button onClick={onDelete}>Delete</button>
            </td>
          </tr>
        </tbody>
        <EntryBlock columnCount={2} caption="Add one">
          <td>
            <EntryInput aria-label="name" required />
          </td>
          <td>
            <EntrySubmit>Add</EntrySubmit>
          </td>
        </EntryBlock>
      </table>
    </EntryScope>
  );
}

describe('EntryTable helpers', () => {
  it('points every control at the scope form via the form attribute', () => {
    render(<Harness onSubmit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByLabelText('name').getAttribute('form')).toBe('test-form');
    expect(screen.getByRole('button', { name: 'Add' }).getAttribute('form')).toBe('test-form');
  });

  it('submits when the submit button is clicked', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} onDelete={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('name'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  // Enter-to-submit is intentionally NOT unit-tested here: user-event simulates
  // implicit submission by searching for a submit button *inside* the <form>
  // element, but ours sits outside it and is linked via the `form` attribute
  // (the only legal way to put a form's controls inside a table). Real
  // browsers follow the HTML spec and handle it correctly -- verified by hand
  // in the browser pane (Enter in a Milestones title field calls add_milestone).

  it('does not submit while a required field is empty', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} onDelete={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('an existing row’s own button never submits the form', async () => {
    const onSubmit = vi.fn();
    const onDelete = vi.fn();
    render(<Harness onSubmit={onSubmit} onDelete={onDelete} />);
    await userEvent.type(screen.getByLabelText('name'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('only renders the details row when details are given', () => {
    const { container, rerender } = render(<Harness onSubmit={vi.fn()} onDelete={vi.fn()} />);
    expect(container.querySelector('.entry-details')).toBeNull();
    rerender(
      <EntryScope id="f" onSubmit={vi.fn()}>
        <table>
          <EntryBlock columnCount={1} caption="c" details={<span>more</span>}>
            <td />
          </EntryBlock>
        </table>
      </EntryScope>,
    );
    expect(container.querySelector('.entry-details')).not.toBeNull();
  });
});
