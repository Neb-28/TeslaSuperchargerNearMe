// Sentry in the browser: errors, performance traces and Session Replay. Off until
// NEXT_PUBLIC_SENTRY_DSN is set.
import * as Sentry from "@sentry/nextjs";

const live = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT === "production";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,

  // Capture 100% in dev, 10% in production. Adjust based on traffic volume.
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Session Replay (browser only; never add it to the server or edge config). By default all
  // text and form entries are masked and images/media blocked, so replays show layout and
  // clicks, not what people read or type.
  integrations: [Sentry.replayIntegration()],
  // Every session while testing, 10% on the live site; always the sessions that hit an error.
  replaysSessionSampleRate: live ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 1.0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
