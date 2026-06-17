import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Stores (or removes) a browser's push subscription for the signed-in user.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { subscription } = await request.json();
  if (!subscription?.endpoint || !subscription?.keys)
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });

  const { data: member } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      household_id: member?.household_id ?? null,
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    { onConflict: "endpoint" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { endpoint } = await request.json();
  if (endpoint)
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint)
      .eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
