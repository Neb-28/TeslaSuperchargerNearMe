export type MenuLink = { label: string; href: string };

// The ☰ menu (a panel that slides in from the right), in groups separated by dividers.
export const accountLinks: MenuLink[] = [
  { label: "My Profile", href: "/account" },
  { label: "Log in", href: "/login" },
];

// Home, Near me and Map aren't in the menu: the logo goes Home, and Near me and Map are on Home.
const pageLinks: MenuLink[] = [
  { label: "Route planner", href: "/route-planner" },
  { label: "Favorites", href: "/favorites" },
];

// On desktop the header already has a Route planner icon.
const desktopPageLinks = pageLinks.filter((link) => link.href !== "/route-planner");

export function menuGroups(variant: "mobile" | "desktop"): MenuLink[][] {
  return [accountLinks, variant === "desktop" ? desktopPageLinks : pageLinks, [{ label: "Contact us", href: "/contact" }]];
}

// Shown as a small text link at the bottom of the menu.
export const menuSmallLinks: MenuLink[] = [{ label: "Privacy policy", href: "/privacy" }];
