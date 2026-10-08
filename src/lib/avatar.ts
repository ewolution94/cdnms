// An avatar is five small numbers: hat, eyes, disguise, collar, skin (the maker's arrows, top to
// bottom). Folio's agent emblem draws the agent from them (<ewo-emblem theme="agent">, vendor/ewo;
// development/plans/emblems.md), so every screen draws the same one. The server checks the same
// ranges (server/avatar.mjs; tests/avatar.test.mjs keeps them in step).

import { isEmblem, randomEmblem } from '../../vendor/ewo/elements/emblem-core.js';

export type Avatar = number[];

export const isAvatar = (value: unknown): value is Avatar => isEmblem('agent', value);

export const randomAvatar = () => randomEmblem('agent') as Avatar;

/** Until 2026-10-08 an avatar had six numbers, the fifth its colour (server/avatar.mjs does the same). */
export const fromSixParts = (value: unknown): unknown => (Array.isArray(value) && value.length === 6 ? [...value.slice(0, 4), value[5]] : value);
