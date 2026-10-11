import { authConfigured } from "@/lib/supabase/env";

export const navLinks = [
  { label: "Home", href: "/" },
  { label: "Near me", href: "/map?near=1" },
  { label: "Map", href: "/map" },
  { label: "Route planner", href: "/route-planner" },
  { label: "Favorites", href: "/favorites" },
  // Sign-in shows only once Supabase is set up for this deployment.
  ...(authConfigured ? [{ label: "Account", href: "/account" }] : []),
];
