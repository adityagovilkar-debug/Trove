"use client";

import { fieldsForDomainKey, NUTRITION, type FieldDef } from "@/lib/domainFields";
import { BookClassificationField } from "./BookClassificationField";
import { ScanLabelButton } from "./ScanLabelButton";

// Renders the domain-specific attribute inputs for a given domain key.
// Controlled: parent owns the `values` object and gets updates via onChange.
// Fields with a `group` are tucked into a collapsible <details> section.
export function AttributeFields({
  domainKey,
  values,
  onChange,
}: {
  domainKey: string | null | undefined;
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const fields = fieldsForDomainKey(domainKey);
  if (fields.length === 0) return null;

  const ungrouped = fields.filter((f) => !f.group);
  const groupNames = [...new Set(fields.filter((f) => f.group).map((f) => f.group!))];

  function set(key: string, v: unknown) {
    onChange({ ...values, [key]: v });
  }

  function renderField(f: FieldDef) {
    if (f.type === "classification") {
      return <BookClassificationField key={f.key} values={values} onChange={onChange} />;
    }
    const val = (values[f.key] ?? "") as string;
    return (
      <div key={f.key}>
        <label className="label">{f.label}</label>
        {f.type === "select" ? (
          <select className="input" value={val} onChange={(e) => set(f.key, e.target.value)}>
            <option value="">—</option>
            {f.options?.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="input"
            type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
            inputMode={f.type === "number" ? "decimal" : undefined}
            value={val}
            placeholder={f.placeholder}
            onChange={(e) => set(f.key, e.target.value)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="card space-y-4 p-4">
      {ungrouped.length > 0 && (
        <>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Details
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {ungrouped.map(renderField)}
          </div>
        </>
      )}

      {groupNames.map((g) => (
        <details key={g} className="rounded-xl border bg-surface-2/40 p-3 [&_summary]:list-none">
          <summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-text-muted hover:text-text">
            {g}
            <span className="text-xs">▾</span>
          </summary>
          {g === NUTRITION && (
            <div className="mt-3 flex items-center gap-2">
              <ScanLabelButton
                onResult={(parsed) => onChange({ ...values, ...parsed })}
              />
              <span className="text-xs text-text-muted">
                Photograph the label to auto-fill
              </span>
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {fields.filter((f) => f.group === g).map(renderField)}
          </div>
        </details>
      ))}
    </div>
  );
}
