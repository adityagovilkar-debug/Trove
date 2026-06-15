import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "You";

  return (
    <AppShell email={user.email ?? ""} name={displayName}>
      {children}
    </AppShell>
  );
}
