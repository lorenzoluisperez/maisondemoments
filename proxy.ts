import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/portal/:path*", "/studio/:path*", "/api/account/:path*", "/api/orders/:path*", "/api/media/:path*", "/api/studio/:path*"],
};
