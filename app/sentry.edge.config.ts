// Sentry in the edge runtime: errors and performance traces. Off until NEXT_PUBLIC_SENTRY_DSN is set.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,

  // Capture 100% in dev, 10% in production. Adjust based on traffic volume.
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Sentry.logger.* calls are sent as Logs (on by default since SDK 11), linked to the request's
  // trace. Put values in attributes, never names, emails, addresses or typed text.
  // Every console.warn and console.error (ours and libraries') is sent as a Log too, so the same
  // rule applies to what they print.
  integrations: [Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] })],
});
