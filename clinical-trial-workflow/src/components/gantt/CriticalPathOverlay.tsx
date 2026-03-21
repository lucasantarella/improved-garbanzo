"use client";

/**
 * CriticalPathOverlay
 *
 * Utility component and helper for critical-path visual treatment.
 * When the criticalPathOnly filter is NOT active but we still want to
 * visually distinguish critical-path items, we export a helper that
 * returns the appropriate opacity / accent classes.
 *
 * ActivityBar uses these helpers directly so no separate overlay element
 * is needed in the DOM.
 */

export function criticalPathClasses(
  isCriticalPath: boolean,
  criticalPathFilterActive: boolean,
): string {
  if (!criticalPathFilterActive) {
    // Filter is off -- everyone is full opacity; critical items get a red accent
    return isCriticalPath ? "ring-1 ring-red-500/60" : "";
  }

  // Filter is on -- non-critical fades, critical gets red accent
  if (isCriticalPath) {
    return "ring-1 ring-red-500/80";
  }
  return "opacity-30";
}

/**
 * Standalone component (renders nothing visible) -- kept so the file
 * satisfies the "use client" component contract and can be imported
 * as a component if needed in the future.
 */
export default function CriticalPathOverlay() {
  return null;
}
