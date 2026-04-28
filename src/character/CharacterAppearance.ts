export interface CharacterAppearance {
  bodyColor: number;
  skinColor: number;
  legsColor: number;
}

export const DEFAULT_CHARACTER: CharacterAppearance = {
  bodyColor: 0x2255cc,
  skinColor: 0xffcc88,
  legsColor: 0x334488,
};

/** Outfit / shirt tones */
export const BODY_PALETTE: number[] = [
  0x2255cc, 0xcc2255, 0x22cc55, 0xaa55cc, 0xcc7722, 0x44aaaa, 0x888888, 0xeeee22,
];

/** Skin tones */
export const SKIN_PALETTE: number[] = [
  0xffcc88, 0xf5c4a0, 0xd4a574, 0x8d5a3c, 0xffe0bd, 0xc68642, 0xfff5e6, 0xb87333,
];

/** Pants / leg tones (darker) */
export const LEGS_PALETTE: number[] = [
  0x334488, 0x443366, 0x225544, 0x553322, 0x334433, 0x222244, 0x114466, 0x554422,
];

export function appearanceFromIndices(
  bodyIndex: number,
  skinIndex: number,
  legsIndex: number,
): CharacterAppearance {
  const b = ((bodyIndex % BODY_PALETTE.length) + BODY_PALETTE.length) % BODY_PALETTE.length;
  const s = ((skinIndex % SKIN_PALETTE.length) + SKIN_PALETTE.length) % SKIN_PALETTE.length;
  const l = ((legsIndex % LEGS_PALETTE.length) + LEGS_PALETTE.length) % LEGS_PALETTE.length;
  return {
    bodyColor: BODY_PALETTE[b],
    skinColor: SKIN_PALETTE[s],
    legsColor: LEGS_PALETTE[l],
  };
}
