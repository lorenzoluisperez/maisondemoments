import { NextResponse } from "next/server";
import { syncCustomerAccount } from "@/lib/accounts/service";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  if (!code) return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  const supabase = await createClient();
  const exchanged = await supabase.auth.exchangeCodeForSession(code);
  if (exchanged.error) return NextResponse.redirect(new URL("/login?error=invalid_link", url.origin));
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.redirect(new URL("/login?error=missing_email", url.origin));
  const displayName = typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : user.email.split("@")[0];
  await syncCustomerAccount({ authUserId: user.id, displayName, email: user.email });
  return NextResponse.redirect(new URL(returnTo, url.origin));
}

function safeReturnTo(value: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/portal";
  try {
    const resolved = new URL(value, "https://app.local");
    return resolved.origin === "https://app.local" ? `${resolved.pathname}${resolved.search}${resolved.hash}` : "/portal";
  } catch { return "/portal"; }
}
