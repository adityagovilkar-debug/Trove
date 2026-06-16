"use client";

import {
  DEWEY_CLASSES,
  GENRE_TAXONOMY,
  type ClassificationSystem,
} from "@/lib/bookClassification";

// Structured classification picker for the Book domain. Writes three keys
// into the shared attributes object: classification_system, classification
// (label), and classification_code (Dewey only).
export function BookClassificationField({
  values,
  onChange,
}: {
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const system =
    (values.classification_system as ClassificationSystem | undefined) ??
    (values.classification ? "custom" : "genre");
  const label = (values.classification as string) ?? "";
  const code = (values.classification_code as string) ?? "";

  function patch(p: Record<string, unknown>) {
    onChange({ ...values, ...p });
  }

  function setSystem(next: ClassificationSystem) {
    // Reset the value when switching systems to avoid mismatched labels.
    patch({ classification_system: next, classification: "", classification_code: "" });
  }

  // Genre: "Group › Item" label. We track selection by parsing the label.
  const [genreGroup, genreItem] = label.includes("›")
    ? label.split("›").map((s) => s.trim())
    : ["", ""];
  const genreGroupObj = GENRE_TAXONOMY.find((g) => g.group === genreGroup);

  // Dewey: code drives the selection; class = first digit bucket.
  const deweyClass = code ? DEWEY_CLASSES.find((c) => c.code[0] === code[0]) : undefined;

  return (
    <div className="sm:col-span-2">
      <label className="label">Classification</label>

      {/* System switcher */}
      <div className="mb-2 inline-flex rounded-lg bg-surface-2 p-0.5 text-xs">
        {(["genre", "dewey", "custom"] as ClassificationSystem[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSystem(s)}
            className={`rounded-md px-2.5 py-1 font-medium capitalize transition-colors ${
              system === s ? "bg-surface text-text shadow-sm" : "text-text-muted"
            }`}
          >
            {s === "dewey" ? "Dewey" : s}
          </button>
        ))}
      </div>

      {system === "genre" && (
        <div className="grid grid-cols-2 gap-3">
          <select
            className="input"
            value={genreGroup}
            onChange={(e) =>
              patch({
                classification_system: "genre",
                classification: e.target.value ? `${e.target.value} › ` : "",
                classification_code: "",
              })
            }
          >
            <option value="">Category…</option>
            {GENRE_TAXONOMY.map((g) => (
              <option key={g.group} value={g.group}>
                {g.group}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={genreItem}
            disabled={!genreGroupObj}
            onChange={(e) =>
              patch({
                classification_system: "genre",
                classification: `${genreGroup} › ${e.target.value}`,
              })
            }
          >
            <option value="">Genre…</option>
            {genreGroupObj?.items.map((it) => (
              <option key={it} value={it}>
                {it}
              </option>
            ))}
          </select>
        </div>
      )}

      {system === "dewey" && (
        <div className="grid grid-cols-2 gap-3">
          <select
            className="input"
            value={deweyClass?.code ?? ""}
            onChange={(e) => {
              const cls = DEWEY_CLASSES.find((c) => c.code === e.target.value);
              patch({
                classification_system: "dewey",
                classification_code: cls?.code ?? "",
                classification: cls ? `${cls.code} — ${cls.label}` : "",
              });
            }}
          >
            <option value="">Class…</option>
            {DEWEY_CLASSES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.label}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={code}
            disabled={!deweyClass}
            onChange={(e) => {
              const div = deweyClass?.divisions.find((d) => d.code === e.target.value);
              patch({
                classification_system: "dewey",
                classification_code: div?.code ?? deweyClass?.code ?? "",
                classification: div
                  ? `${div.code} — ${div.label}`
                  : deweyClass
                    ? `${deweyClass.code} — ${deweyClass.label}`
                    : "",
              });
            }}
          >
            <option value="">Division (optional)…</option>
            {deweyClass?.divisions.map((d) => (
              <option key={d.code} value={d.code}>
                {d.code} · {d.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {system === "custom" && (
        <input
          className="input"
          value={label}
          placeholder="Your own shelf / code, e.g. “Cookbooks” or a LoC call number"
          onChange={(e) =>
            patch({
              classification_system: "custom",
              classification: e.target.value,
              classification_code: "",
            })
          }
        />
      )}

      {label && (
        <p className="mt-1.5 text-xs text-text-muted">
          Shelf as: <span className="font-medium text-text">{label}</span>
        </p>
      )}
    </div>
  );
}
