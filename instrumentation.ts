import * as Sentry from "@sentry/nextjs";
import { operationalLog } from "@/lib/operations/logger";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
  operationalLog("info", "application.runtime.started", { release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local" });
}

export const onRequestError = Sentry.captureRequestError;
