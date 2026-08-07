// Shared "is the user actively working?" tracker. Any interaction — clicking
// a menu, typing, scrolling, touching — counts as activity. After 5 minutes
// with no interaction the user is considered idle (even with the tab open),
// so the work clock stops until they interact again.

export const IDLE_AFTER_MS = 5 * 60_000;

let lastActivityAt = typeof window !== "undefined" ? Date.now() : 0;
let listening = false;

const mark = () => {
  lastActivityAt = Date.now();
};

const EVENTS: (keyof DocumentEventMap)[] = [
  "pointerdown",
  "keydown",
  "wheel",
  "touchstart",
  "mousemove",
  "scroll",
];

export function startActivityTracking() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  mark();
  for (const ev of EVENTS) {
    document.addEventListener(ev, mark, { passive: true, capture: true });
  }
}

export function isActivelyWorking(): boolean {
  return (
    typeof document !== "undefined" &&
    document.visibilityState === "visible" &&
    Date.now() - lastActivityAt < IDLE_AFTER_MS
  );
}
