"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { loginHref } from "@/lib/authRedirect";
import { authConfigured, hasAuthCookie } from "@/lib/supabase/env";

const noop = () => () => {};

// The Favorites page is static, so whether the visitor is signed in is read in the browser.
export default function FavoritesSyncNote() {
  const signedIn = useSyncExternalStore(noop, () => hasAuthCookie(document.cookie), () => false);

  if (signedIn) return <p className="page-sub">Your saved stations sync to every device where you&apos;re signed in.</p>;
  return (
    <p className="page-sub">
      Stations you save are kept on this device.
      {authConfigured ? (
        <>
          {" "}
          <Link href={loginHref("/favorites")}>Sign in</Link> to keep them on all your devices.
        </>
      ) : null}
    </p>
  );
}
