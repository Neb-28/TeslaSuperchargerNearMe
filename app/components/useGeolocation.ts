"use client";

import { useCallback, useEffect, useState } from "react";
import type { LatLng } from "@/lib/stations";

export type GeoStatus =
  | "idle" // nothing asked yet (or the visitor chose "Not now")
  | "checking" // reading the permission state before asking
  | "asking" // the browser's Allow/Block prompt is (or is about to be) on screen
  | "locating" // permission granted, waiting for a position
  | "located"
  | "dismissed" // prompt closed without choosing; we may ask again
  | "denied" // blocked in browser or phone settings; only the visitor can undo it
  | "unavailable" // no GPS fix or timed out
  | "insecure"; // http page: browsers only share location over https

type PermissionState = "granted" | "prompt" | "denied" | "unknown";

async function queryPermission(): Promise<PermissionState> {
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state;
  } catch {
    return "unknown"; // Permissions API missing (older browsers)
  }
}

export function useGeolocation(autoStart: boolean) {
  const [status, setStatus] = useState<GeoStatus>(autoStart ? "checking" : "idle");
  const [position, setPosition] = useState<LatLng | null>(null);
  // Bumped on every successful fix so the map knows to re-center.
  const [fixCount, setFixCount] = useState(0);

  // Every state change happens in a promise or browser callback, so this is safe to
  // start from an effect as well as from a tap.
  const request = useCallback(() => {
    void queryPermission().then((permission) => {
      if (!("geolocation" in navigator)) {
        setStatus("unavailable");
        return;
      }
      if (!window.isSecureContext) {
        setStatus("insecure");
        return;
      }

      setStatus(permission === "granted" ? "locating" : "asking");
      navigator.geolocation.getCurrentPosition(
        (fix) => {
          setPosition([fix.coords.latitude, fix.coords.longitude]);
          setStatus("located");
          setFixCount((count) => count + 1);
        },
        (error) => {
          if (error.code !== error.PERMISSION_DENIED) {
            setStatus("unavailable");
            return;
          }
          // Closing the prompt also reports "denied", but the permission is still askable.
          void queryPermission().then((state) => setStatus(state === "prompt" ? "dismissed" : "denied"));
        },
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
      );
    });
  }, []);

  useEffect(() => {
    if (autoStart) request();
  }, [autoStart, request]);

  // While blocked, watch for the visitor turning location back on (in the browser's
  // site settings or the phone's Settings app) and continue without a reload.
  useEffect(() => {
    if (status !== "denied") return;

    let permission: PermissionStatus | null = null;
    const recheck = async () => {
      if ((await queryPermission()) !== "denied") request();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void recheck();
    };

    document.addEventListener("visibilitychange", onVisible);
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((result) => {
        permission = result;
        result.onchange = () => {
          if (result.state !== "denied") request();
        };
      })
      .catch(() => {});

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (permission) permission.onchange = null;
    };
  }, [status, request]);

  const dismiss = useCallback(() => setStatus("idle"), []);

  return { status, position, fixCount, request, dismiss };
}
