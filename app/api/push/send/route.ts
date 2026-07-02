import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

// Daily digest job (triggered by Vercel Cron — see vercel.json). Computes, per
// household, what's expiring soon and which payments are due, then delivers it
// two ways: web-push to every subscribed device, and — when Resend is
// configured (RESEND_API_KEY + RESEND_FROM) — an email to each member.
// Protected by CRON_SECRET.
export const runtime = "nodejs";

const EXPIRY_WINDOW = 2; // days ahead
const PAYMENT_WINDOW = 2; // days ahead

interface Digest {
  expNames: string[];
  payNames: string[];
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
  // those keep nagging otherwise and belong in the in-app view, not a daily push).
  const { data: expiring } = await supabase
    .from("inventory_detail")
    .select("household_id, item_name, days_to_expiry")
    .eq("status", "active")
    .not("expiry_date", "is", null)
    .gte("days_to_expiry", -1)
    .lte("days_to_expiry", EXPIRY_WINDOW);

  const { data: payments } = await supabase
    .from("subscriptions")
    .select("household_id, name, next_payment")
    .eq("status", "active")
    .not("next_payment", "is", null);

  // Build a per-household digest.
  const digests = new Map<string, Digest>();
  const get = (hh: string) => {
    let d = digests.get(hh);
    if (!d) digests.set(hh, (d = { expNames: [], payNames: [] }));
    return d;
  };
  for (const e of expiring ?? []) {
    if (e.household_id) get(e.household_id).expNames.push(e.item_name);
  }
  for (const p of payments ?? []) {
    const days = Math.ceil(
      (new Date(p.next_payment + "T00:00:00").getTime() - Date.now()) / 86_400_000,
    );
    if (p.household_id && days >= 0 && days <= PAYMENT_WINDOW)
      get(p.household_id).payNames.push(p.name);
  }

  function bodyFor(hh: string | null): string | null {
    if (!hh) return null;
    const d = digests.get(hh);
    if (!d || (d.expNames.length === 0 && d.payNames.length === 0)) return null;
    const parts: string[] = [];
    if (d.expNames.length)
      parts.push(`${d.expNames.length} item${d.expNames.length > 1 ? "s" : ""} expiring soon`);
    if (d.payNames.length)
      parts.push(`${d.payNames.length} payment${d.payNames.length > 1 ? "s" : ""} due`);
    return parts.join(" · ");
  }

  // ---- Web push -----------------------------------------------------------
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

  // ---- Email (optional, via Resend) --------------------------------------
  const resendKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM;
  let emailed = 0;
  if (resendKey && resendFrom) {
    const { data: members } = await supabase
      .from("household_members")
      .select("household_id, profiles(email)");
    for (const m of members ?? []) {
      const body = bodyFor(m.household_id);
      if (!body) continue;
      const prof = m.profiles as unknown;
      const email = Array.isArray(prof)
        ? (prof[0]?.email as string | undefined)
        : ((prof as { email?: string } | null)?.email);
      if (!email) continue;
      const d = digests.get(m.household_id)!;
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: resendFrom,
            to: [email],
            subject: `Trove — ${body}`,
            html: emailHtml(d),
          }),
        });
        if (res.ok) emailed++;
      } catch {
        // best-effort; don't fail the whole job on one email
      }
    }
  }

  return NextResponse.json({ pushed, emailed });
}

function emailHtml(d: Digest): string {
  const list = (title: string, names: string[]) =>
    names.length
      ? `<p style="margin:16px 0 4px;font-weight:600;color:#2e241b">${title}</p>
         <ul style="margin:0;padding-left:18px;color:#5f5a52">
           ${names.slice(0, 12).map((n) => `<li>${escapeHtml(n)}</li>`).join("")}
           ${names.length > 12 ? `<li>…and ${names.length - 12} more</li>` : ""}
         </ul>`
      : "";
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:8px">
    <h2 style="color:#c2410c;margin:0 0 8px">Trove daily digest</h2>
    ${list("Expiring soon", d.expNames)}
    ${list("Payments due", d.payNames)}
    <p style="margin-top:20px">
      <a href="https://trove.vercel.app/upcoming" style="color:#c2410c">Open Trove →</a>
    </p>
  </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
