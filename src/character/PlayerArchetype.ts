import type { CharacterAppearance } from "./CharacterAppearance";

export const ARCHETYPE_LABELS = ["Achintya", "Trygve", "Aaron", "Ashish", "Misha"] as const;

/** One-line descriptions shown in CharacterSelectScene (source: README ## Characters). */
export const ARCHETYPE_DESCRIPTIONS: Record<number, string> = {
  0: "Default hero",
  1: "Nordic warrior",
  2: "Speedrunner",
  3: "Tech wizard",
  4: "Stealth runner",
};

export const ARCHETYPE_COUNT = ARCHETYPE_LABELS.length;

export type PlayerArchetypeId = 0 | 1 | 2 | 3 | 4;

export interface PlayerCharacterSelection {
  archetypeId: PlayerArchetypeId;
  appearance: CharacterAppearance;
}

export function normalizeArchetypeId(n: number): PlayerArchetypeId {
  const m = ((n % ARCHETYPE_COUNT) + ARCHETYPE_COUNT) % ARCHETYPE_COUNT;
  return m as PlayerArchetypeId;
}

/** Set by CharacterSelectScene before opening the color builder. */
export const SELECTED_ARCHETYPE_REGISTRY_KEY = "selectedArchetypeId";

/** Registry key for the full playable character choice (archetype + palette). */
export const PLAYER_CHARACTER_REGISTRY_KEY = "playerCharacter";
