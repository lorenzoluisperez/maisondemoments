import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { showcaseOnly } from "@/lib/site-mode";

export async function proxy(request: NextRequest) {
  const pausedWorkspaces = ["/portal", "/checkout", "/login", "/mfa", "/admin", "/studio", "/review"];
  if (showcaseOnly && (pausedWorkspaces.some((path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`)) || /^\/designs\/[^/]+\/quote\/?$/.test(request.nextUrl.pathname))) {
    return NextResponse.redirect(new URL("/how-to-order", request.url));
  }
  return updateSession(request);
}

export const config = {
  matcher: ["/portal/:path*", "/checkout/:path*", "/login", "/mfa", "/admin/:path*", "/designs/:slug/quote", "/studio/:path*", "/review/:path*", "/api/account/:path*", "/api/orders/:path*", "/api/media/:path*", "/api/studio/:path*", "/api/reviews/:path*", "/api/admin/:path*"],
};
