import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

// Daily push job (triggered by Vercel Cron — see vercel.json). Computes, per
// household, what's expiring soon and which payments are due, then notifies
// every subscribed device. Protected by CRON_SECRET.
export const runtime = "nodejs";

const EXPIRY_WINDOW = 2; // days
const PAYMENT_WINDOW = 2; // days

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!pub || !priv || !serviceKey)
    return NextResponse.json({ error: "Missing VAPID / service key" }, { status: 500 });

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:trove@example.com",
    pub,
    priv,
  );
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

  const { data: subs } = await supabase.from("push_subscriptions").select("*");
  if (!subs?.length) return NextResponse.json({ sent: 0 });

  // Expiries (<= window) per household.
  const { data: expiring } = await supabase
    .from("inventory_detail")
    .select("household_id, item_name, days_to_expiry")
    .eq("status", "active")
    .not("expiry_date", "is", null)
    .lte("days_to_expiry", EXPIRY_WINDOW);

  // Active subscriptions; filter to those due within the window.
  const { data: payments } = await supabase
    .from("subscriptions")
    .select("household_id, name, next_payment")
    .eq("status", "active")
    .not("next_payment", "is", null);

  const expByHh = new Map<string, number>();
  for (const e of expiring ?? [])
    expByHh.set(e.household_id, (expByHh.get(e.household_id) ?? 0) + 1);

  const payByHh = new Map<string, number>();
  for (const p of payments ?? []) {
    const days = Math.ceil(
      (new Date(p.next_payment + "T00:00:00").getTime() - Date.now()) / 86_400_000,
    );
    if (days >= 0 && days <= PAYMENT_WINDOW)
      payByHh.set(p.household_id, (payByHh.get(p.household_id) ?? 0) + 1);
  }

  function bodyFor(hh: string | null): string | null {
    if (!hh) return null;
    const exp = expByHh.get(hh) ?? 0;
    const pay = payByHh.get(hh) ?? 0;
    if (exp === 0 && pay === 0) return null;
    const parts: string[] = [];
    if (exp > 0) parts.push(`${exp} item${exp > 1 ? "s" : ""} expiring soon`);
    if (pay > 0) parts.push(`${pay} payment${pay > 1 ? "s" : ""} due`);
    return parts.join(" · ");
  }

  let sent = 0;
  for (const s of subs) {
    const body = bodyFor(s.household_id);
    if (!body) continue;
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: "Trove", body, url: "/upcoming", tag: "trove-daily" }),
      );
      sent++;
    } catch (err: unknown) {
      // Drop stale/expired subscriptions.
      const code = (err as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410)
        await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
    }
  }

  return NextResponse.json({ sent });
}
