import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

// Daily reminder job (triggered by Vercel Cron — see vercel.json). Push only:
// food expiring within two days, and warranties reaching a milestone
// (30 / 7 / 1 / 0 days left — a nudge, not a daily nag). The email digest and
// payment reminders were retired in the 2026-11 rework (payments → Kosha).
// Protected by CRON_SECRET.
export const runtime = "nodejs";

const EXPIRY_WINDOW = 2; // days ahead
const WARRANTY_MILESTONES = new Set([30, 7, 1, 0]);

interface Digest {
  expNames: string[];
  warNames: string[];
}

function daysUntil(date: string): number | null {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((Date.UTC(y, m - 1, d) - today) / 86_400_000);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!pub || !priv || !serviceKey)
    return NextResponse.json({ error: "Missing VAPID / service key" }, { status: 500 });

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:trove@example.com", pub, priv);
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

  // Expiries: within the window, but not stale (expired more than a day ago —
  // those belong in the in-app view, not a daily push).
  const { data: expiring } = await supabase
    .from("inventory_detail")
    .select("household_id, item_name, days_to_expiry")
    .eq("status", "active")
    .not("expiry_date", "is", null)
    .gte("days_to_expiry", -1)
    .lte("days_to_expiry", EXPIRY_WINDOW);

  // Warranties live in item attributes.
  const { data: withWarranty } = await supabase
    .from("inventory_detail")
    .select("household_id, item_name, item_attributes")
    .eq("status", "active")
    .not("item_attributes->>warranty_until", "is", null);

  const digests = new Map<string, Digest>();
  const get = (hh: string) => {
    let d = digests.get(hh);
    if (!d) digests.set(hh, (d = { expNames: [], warNames: [] }));
    return d;
  };
  for (const e of expiring ?? []) {
    if (e.household_id) get(e.household_id).expNames.push(e.item_name);
  }
  for (const w of withWarranty ?? []) {
    const until = (w.item_attributes as Record<string, unknown> | null)?.warranty_until;
    if (!w.household_id || typeof until !== "string" || !until) continue;
    const d = daysUntil(until);
    if (d != null && WARRANTY_MILESTONES.has(d)) get(w.household_id).warNames.push(w.item_name);
  }

  function bodyFor(hh: string | null): string | null {
    if (!hh) return null;
    const d = digests.get(hh);
    if (!d || (d.expNames.length === 0 && d.warNames.length === 0)) return null;
    const parts: string[] = [];
    if (d.expNames.length)
      parts.push(
        d.expNames.length === 1
          ? `${d.expNames[0]} is expiring`
          : `${d.expNames.length} things expiring soon`,
      );
    if (d.warNames.length)
      parts.push(
        d.warNames.length === 1
          ? `${d.warNames[0]}: warranty ending`
          : `${d.warNames.length} warranties ending`,
      );
    return parts.join(" · ");
  }

  const { data: subs } = await supabase.from("push_subscriptions").select("*");
  let pushed = 0;
  for (const s of subs ?? []) {
    const body = bodyFor(s.household_id);
    if (!body) continue;
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: "Trove", body, url: "/upcoming", tag: "trove-daily" }),
      );
      pushed++;
    } catch (err: unknown) {
      const code = (err as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410)
        await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
    }
  }

  return NextResponse.json({ pushed });
}
