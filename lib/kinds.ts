// The three broad kinds Stuff is filtered by. Built on the domain key so no
// migration is needed; items saved without a kind show as "unsorted" rather
// than being guessed into the wrong group.

export type Kind = "food" | "supplies" | "things" | "unsorted";

export const KIND_LABEL: Record<Kind, string> = {
  food: "Food",
  supplies: "Supplies",
  things: "Things",
  unsorted: "Unsorted",
};

export const KIND_ORDER: Kind[] = ["food", "supplies", "things", "unsorted"];

export function kindOf(domainKey: string | null | undefined): Kind {
  if (!domainKey) return "unsorted";
  if (domainKey === "grocery") return "food";
  if (domainKey === "household") return "supplies";
  return "things";
}

export function isKind(v: string | null): v is Kind {
  return v === "food" || v === "supplies" || v === "things" || v === "unsorted";
}
