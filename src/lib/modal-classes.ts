// Canonical modal classes per Modal Pattern Discipline (Chat 39 commit 536eec1)
// Outer wrapper: tap-outside-to-close handler attaches here
export const MODAL_OVERLAY_CLASSES =
  "fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50";

// Content panel: e.stopPropagation attaches here so taps inside don't close
// pb-safe defined in globals.css — applies env(safe-area-inset-bottom, 16px) on mobile
export const MODAL_PANEL_CLASSES =
  "w-full sm:w-[480px] sm:max-w-[90vw] rounded-t-2xl sm:rounded-2xl bg-white max-h-[85vh] overflow-y-auto pb-safe sm:pb-0";

// Sticky action footer — use inside MODAL_PANEL when actions must stay reachable
export const MODAL_STICKY_FOOTER_CLASSES =
  "sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 flex gap-2 justify-end";
