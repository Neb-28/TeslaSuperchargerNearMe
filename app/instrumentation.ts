import * as Sentry from "@sentry/nextjs";

// Registers Sentry for the server and edge runtimes (see sentry.*.config.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Capture errors from Server Components, route handlers, server actions and proxy.ts.
export const onRequestError = Sentry.captureRequestError;
