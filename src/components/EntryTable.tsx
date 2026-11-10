/**
 * Shared building blocks for "table with an add-form" screens, so the form's
 * inputs sit directly under the table's own column headers instead of in a
 * separate wrap-around block below it.
 *
 * Usage:
 *
 *   <EntryScope id="trip-form" onSubmit={submit}>
 *     <div className="matrix-scroll">
 *       <table className="entry-table">
 *         <thead>...</thead>
 *         <tbody>...existing rows...</tbody>
 *         <EntryBlock columnCount={8} caption="Add a trip execution" details={...}>
 *           <td><EntrySelect .../></td>
 *           ...one <td> per column...
 *         </EntryBlock>
 *       </table>
 *     </div>
 *   </EntryScope>
 *
 * A <form> can't legally sit inside a <table>, so `EntryScope` renders an
 * empty <form id=...> next to it and every `Entry*` control points at it with
 * the HTML `form` attribute. Enter-to-submit and native `required` validation
 * work exactly as in a normal form, and the existing rows' own buttons (e.g.
 * Delete) are NOT inside the form, so they can never submit it by accident.
 */

import { createContext, useContext } from 'react';
import type {
  ButtonHTMLAttributes,
  FormEvent,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';

const FormIdContext = createContext<string | undefined>(undefined);

export function EntryScope({
  id,
  onSubmit,
  children,
}: {
  id: string;
  onSubmit: (e: FormEvent) => void;
  children: ReactNode;
}) {
  return (
    <FormIdContext.Provider value={id}>
      <form id={id} onSubmit={onSubmit} />
      {children}
    </FormIdContext.Provider>
  );
}

export function EntryInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const form = useContext(FormIdContext);
  return <input form={form} {...props} />;
}

export function EntrySelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const form = useContext(FormIdContext);
  return <select form={form} {...props} />;
}

/** The form's submit button. */
export function EntrySubmit(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'form'>) {
  const form = useContext(FormIdContext);
  return <button type="submit" form={form} {...props} />;
}

/** A checkbox with its label, vertically aligned like the other controls. */
export function EntryCheck({
  label,
  ...props
}: { label: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const form = useContext(FormIdContext);
  return (
    <label className="check-cell">
      <input type="checkbox" form={form} {...props} />
      {label}
    </label>
  );
}

/** A labelled field for the secondary "details" row. */
export function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      {label}
      {children}
    </label>
  );
}

/**
 * The entry rows themselves. `children` must be exactly one <td> per table
 * column; use an empty <td /> where the form has no matching field. `details`
 * (optional) holds the fields that have no column of their own.
 */
export function EntryBlock({
  columnCount,
  caption,
  children,
  details,
}: {
  columnCount: number;
  caption: ReactNode;
  children: ReactNode;
  details?: ReactNode;
}) {
  return (
    <tbody className="entry-block">
      <tr className="entry-caption">
        <td colSpan={columnCount}>{caption}</td>
      </tr>
      <tr className="entry-row">{children}</tr>
      {details && (
        <tr className="entry-details">
          <td colSpan={columnCount}>
            <div className="details-grid">{details}</div>
          </td>
        </tr>
      )}
    </tbody>
  );
}
