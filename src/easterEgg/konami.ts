export const KONAMI_SEQUENCE = ["UP", "DOWN", "B", "A"] as const;

export type KonamiKey = (typeof KONAMI_SEQUENCE)[number];

export function keyboardEventToKonamiKey(e: KeyboardEvent): KonamiKey | null {
  if (e.code === "ArrowUp") {
    return "UP";
  }
  if (e.code === "ArrowDown") {
    return "DOWN";
  }
  if (e.code === "KeyB") {
    return "B";
  }
  if (e.code === "KeyA") {
    return "A";
  }
  return null;
}

/** Wrong key resets; correct first key after partial progress restarts from step 1. */
export function advanceKonamiIndex(current: number, key: KonamiKey | null): number {
  if (key === null) {
    return current;
  }
  if (key === KONAMI_SEQUENCE[current]) {
    return current + 1;
  }
  if (key === KONAMI_SEQUENCE[0]) {
    return 1;
  }
  return 0;
}

export function isKonamiComplete(index: number): boolean {
  return index >= KONAMI_SEQUENCE.length;
}

export const EASTER_EGG_REGISTRY_KEY = "konamiEasterEgg";
