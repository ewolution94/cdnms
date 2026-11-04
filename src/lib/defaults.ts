// The order a family setting is decided in (Dashboard, plans/dashboard.md in the workspace): this
// device's own choice, then Dashboard's value (#ewo-config), then the built-in one, which is today's.
// CDNMS's manifest (public/ewo.config.json) names German and sounds on as its own defaults, so the
// family's language and sounds don't reach it; a value set in Dashboard for CDNMS does.
// public/boot.js does the same for the language before first paint. No Svelte and no DOM here, so
// the tests load it as it is.

export type Lang = 'de' | 'en';
/** `system` is the first choice, Standard: nothing picked on this device. */
export type LangChoice = Lang | 'system';

/** CDNMS speaks German first: its players are the German-speaking afternoon meeting (the user, 2026-10-08). */
export const BUILT_IN_LANG: Lang = 'de';
/** Sounds are on until a device switches them off. */
export const BUILT_IN_SOUNDS = true;

const isLang = (value: unknown): value is Lang => value === 'de' || value === 'en';

/**
 * The language pill's choice from what this device saved under `ewo:lang`: Deutsch or English, or
 * Standard when it saved nothing. An older pick of System (saved as 'system' before Standard took
 * its place) stays this device's own: the browser's language, as before.
 */
export const choiceFor = (saved: unknown, browser: () => Lang): LangChoice =>
  isLang(saved) ? saved : saved === 'system' ? browser() : 'system';

/** The language to show: this device's own, else Dashboard's, else German. Dashboard's `system` sets none. */
export function languageFor(saved: unknown, dashboard: unknown, browser: () => Lang): Lang {
  const choice = choiceFor(saved, browser);
  if (choice !== 'system') return choice;
  return isLang(dashboard) ? dashboard : BUILT_IN_LANG;
}

/** Sounds: this device's switch (`cdnms:sound`, 'on' or 'off'), else Dashboard's, else on. */
export const soundsFor = (saved: unknown, dashboard: unknown): boolean =>
  saved === 'on' ? true : saved === 'off' ? false : typeof dashboard === 'boolean' ? dashboard : BUILT_IN_SOUNDS;
