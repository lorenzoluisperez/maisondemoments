import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  sendDefaultPii: false,
  tracesSampleRate: 0.05,
  beforeSend(event) {
    if (event.request) event.request = { method: event.request.method, url: event.request.url };
    return event;
  },
});
