// Supabase Edge Function: daily expiry digest email.
//
// Finds active stock expiring within EXPIRY_WINDOW_DAYS across every
// household, groups by household member, and emails a digest via Resend.
//
// Deploy:  supabase functions deploy expiry-digest --no-verify-jwt
// Secrets: supabase secrets set RESEND_API_KEY=... EXPIRY_EMAIL_FROM="Larder <...>"
// Schedule it with pg_cron — see supabase/migrations/0002_cron.sql.

import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPIRY_WINDOW_DAYS = 7;

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EXPIRY_EMAIL_FROM") ?? "Trove <onboarding@resend.dev>";

  // Pull expiring items joined to the item name + household.
  const { data: rows, error } = await supabase
    .from("inventory_detail")
    .select("household_id, item_name, quantity, unit, expiry_date, days_to_expiry, location_name")
    .eq("status", "active")
    .not("expiry_date", "is", null)
    .lte("days_to_expiry", EXPIRY_WINDOW_DAYS);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Group items by household.
  const byHousehold = new Map<string, typeof rows>();
  for (const r of rows ?? []) {
    if (!byHousehold.has(r.household_id)) byHousehold.set(r.household_id, []);
    byHousehold.get(r.household_id)!.push(r);
  }

  let sent = 0;
  for (const [householdId, items] of byHousehold) {
    // Recipients = all members' emails.
    const { data: members } = await supabase
      .from("household_members")
      .select("profiles(email)")
      .eq("household_id", householdId);
    const emails = (members ?? [])
      .map((m: any) => m.profiles?.email)
      .filter(Boolean) as string[];
    if (emails.length === 0 || !resendKey) continue;

    const sorted = items.sort((a, b) => (a.days_to_expiry ?? 0) - (b.days_to_expiry ?? 0));
    const list = sorted
      .map((i) => {
        const when =
          (i.days_to_expiry ?? 0) < 0
            ? `expired ${Math.abs(i.days_to_expiry ?? 0)}d ago`
            : (i.days_to_expiry ?? 0) === 0
              ? "expires today"
              : `${i.days_to_expiry}d left`;
        return `<li><b>${i.item_name}</b> — ${i.quantity}${i.unit ? " " + i.unit : ""}${i.location_name ? ` (${i.location_name})` : ""} — <span style="color:#d97706">${when}</span></li>`;
      })
      .join("");
    const html = `<div style="font-family:system-ui;max-width:520px">
      <h2 style="color:#ad520d">Trove · Use these soon</h2>
      <p>${sorted.length} item(s) in your home are expiring within ${EXPIRY_WINDOW_DAYS} days:</p>
      <ul>${list}</ul></div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: emails,
        subject: `🥫 ${sorted.length} item(s) expiring soon`,
        html,
      }),
    });
    if (res.ok) sent++;
  }

  return Response.json({ households: byHousehold.size, emailsSent: sent });
});
