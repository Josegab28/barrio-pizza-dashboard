// Test double for `next/navigation`. Mirrors the real `redirect`, which
// interrupts rendering by throwing instead of returning.
export class RedirectSignal extends Error {
  constructor(location) {
    super(`NEXT_REDIRECT ${location}`);
    this.name = "RedirectSignal";
    this.location = location;
  }
}

export function redirect(location) {
  throw new RedirectSignal(location);
}
