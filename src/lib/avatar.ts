// An avatar is six small numbers: hat, eyes, disguise, collar, colour, skin (the maker's arrows, top
// to bottom). Folio's agent emblem draws the agent from them (<ewo-emblem theme="agent">, vendor/ewo;
// development/plans/emblems.md), so every screen draws the same one. The server checks the same
// ranges (server/avatar.mjs; tests/avatar.test.mjs keeps them in step).

import { isEmblem, randomEmblem } from '../../vendor/ewo/elements/emblem-core.js';

export type Avatar = number[];

export const isAvatar = (value: unknown): value is Avatar => isEmblem('agent', value);

export const randomAvatar = () => randomEmblem('agent') as Avatar;
