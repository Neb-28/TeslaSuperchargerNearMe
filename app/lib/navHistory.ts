// Counts in-app page visits so the Back button only calls history.back() when the
// previous entry is one of our pages. Browser "forward" undercounts, which is safe:
// Back then falls back to its link instead of leaving the site.

let depth = 0;
let poppedByBrowser = false;
let lastPath: string | null = null;

export function trackPageChange(pathname: string) {
  if (lastPath === null) {
    window.addEventListener("popstate", () => {
      // Fragment jumps (e.g. the skip link) also fire popstate; only count page changes.
      if (window.location.pathname !== lastPath) poppedByBrowser = true;
    });
  } else if (pathname !== lastPath) {
    depth = poppedByBrowser ? Math.max(0, depth - 1) : depth + 1;
  }
  poppedByBrowser = false;
  lastPath = pathname;
}

export function canGoBackInApp() {
  return depth > 0;
}
