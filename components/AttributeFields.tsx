"use client";

import { fieldsForDomainKey } from "@/lib/domainFields";

// Renders the domain-specific attribute inputs for a given domain key.
// Controlled: parent owns the `values` object and gets updates via onChange.
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

  function set(key: string, v: unknown) {
    onChange({ ...values, [key]: v });
  }

  return (
    <div className="card space-y-4 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
        Details
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((f) => {
          const val = (values[f.key] ?? "") as string;
          return (
            <div key={f.key}>
              <label className="label">{f.label}</label>
              {f.type === "select" ? (
                <select
                  className="input"
                  value={val}
                  onChange={(e) => set(f.key, e.target.value)}
                >
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
                  value={val}
                  placeholder={f.placeholder}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
