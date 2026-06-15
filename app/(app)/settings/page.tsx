"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Plus, Trash2, Check, Users } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useHouseholdId, useRefData } from "@/lib/queries";

const CURRENCIES = ["INR", "USD", "EUR", "GBP"];

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data: householdId } = useHouseholdId();
  const { data: ref } = useRefData();
  const [copied, setCopied] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  const members = useQuery({
    queryKey: ["members", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      const sb = supabaseBrowser();
      const { data, error } = await sb
        .from("household_members")
        .select("role, user_id, profiles(full_name, email)")
        .eq("household_id", householdId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function updateHousehold(patch: Record<string, unknown>) {
    const sb = supabaseBrowser();
    const { error } = await sb.from("households").update(patch).eq("id", householdId!);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["ref-data"] });
  }

  async function addRef(table: "locations" | "categories", payload: Record<string, unknown>) {
    const sb = supabaseBrowser();
    const { error } = await sb.from(table).insert({ household_id: householdId, ...payload });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["ref-data"] });
  }

  async function deleteRef(table: "locations" | "categories", id: string) {
    const sb = supabaseBrowser();
    const { error } = await sb.from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["ref-data"] });
  }

  async function joinHousehold() {
    const code = joinCode.trim();
    if (!code) return;
    const sb = supabaseBrowser();
    const { data: auth } = await sb.auth.getUser();
    const { error } = await sb
      .from("household_members")
      .insert({ household_id: code, user_id: auth.user!.id, role: "member" });
    if (error) return toast.error("Couldn't join — check the code.");
    toast.success("Joined household! Reloading…");
    qc.clear();
    setTimeout(() => window.location.reload(), 600);
  }

  function copyCode() {
    navigator.clipboard.writeText(householdId ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      {/* Household */}
      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Household</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              defaultValue={ref?.household.name}
              onBlur={(e) => updateHousehold({ name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Currency</label>
            <select
              className="input"
              value={ref?.household.base_currency ?? "INR"}
              onChange={(e) => updateHousehold({ base_currency: e.target.value })}
            >
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Share code (let family join this household)</label>
          <div className="flex gap-2">
            <input className="input font-mono text-xs" readOnly value={householdId ?? ""} />
            <button onClick={copyCode} className="btn-outline shrink-0">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1 text-xs text-text-muted">
            Anyone you give this code to can join and share your inventory.
          </p>
        </div>
      </section>

      {/* Members */}
      <section className="card space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Users className="h-5 w-5" /> Members
        </h2>
        <ul className="space-y-1 text-sm">
          {(members.data ?? []).map((m: any) => (
            <li key={m.user_id} className="flex items-center justify-between">
              <span>{m.profiles?.full_name ?? m.profiles?.email ?? "Member"}</span>
              <span className="chip bg-surface-2 text-text-muted ring-border">{m.role}</span>
            </li>
          ))}
        </ul>
        <div className="border-t pt-3">
          <label className="label">Join another household by code</label>
          <div className="flex gap-2">
            <input
              className="input font-mono text-xs"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="paste a share code"
            />
            <button onClick={joinHousehold} className="btn-outline shrink-0">
              Join
            </button>
          </div>
        </div>
      </section>

      {/* Locations */}
      <EditableList
        title="Locations"
        placeholder="e.g. Garage shelf"
        items={(ref?.locations ?? []).map((l) => ({ id: l.id, label: l.name }))}
        onAdd={(name) => addRef("locations", { name })}
        onDelete={(id) => deleteRef("locations", id)}
      />

      {/* Categories */}
      <EditableList
        title="Categories"
        placeholder="e.g. Cleaning supplies"
        items={(ref?.categories ?? []).map((c) => ({ id: c.id, label: c.name }))}
        onAdd={(name) => addRef("categories", { name })}
        onDelete={(id) => deleteRef("categories", id)}
      />
    </div>
  );
}

function EditableList({
  title,
  placeholder,
  items,
  onAdd,
  onDelete,
}: {
  title: string;
  placeholder: string;
  items: { id: string; label: string }[];
  onAdd: (name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-semibold">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => (
          <span
            key={it.id}
            className="chip group bg-surface-2 text-text ring-border"
          >
            {it.label}
            <button
              onClick={() => onDelete(it.id)}
              className="text-text-muted hover:text-rose-500"
              aria-label={`Delete ${it.label}`}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        ))}
        {items.length === 0 && (
          <span className="text-sm text-text-muted">None yet.</span>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) {
            onAdd(value.trim());
            setValue("");
          }
        }}
        className="flex gap-2"
      >
        <input
          className="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
        />
        <button className="btn-outline shrink-0">
          <Plus className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}
