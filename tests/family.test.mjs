import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
// What CDNMS hands Dashboard (public/ewo.config.json), checked with Folio's own rules, and the
// order a setting is decided in: this device's own choice, then Dashboard's value, then the
// built-in one (src/lib/defaults.ts, and public/boot.js before first paint).
import { checkManifest, resolve } from '../vendor/ewo/elements/config-core.js';
import { choiceFor, languageFor, soundsFor } from '../src/lib/defaults.ts';

const manifest = JSON.parse(readFileSync(new URL('../public/ewo.config.json', import.meta.url), 'utf8'));
const en = () => 'en';
const de = () => 'de';

test('the manifest is one Dashboard takes: the family’s language and sounds, with CDNMS’s own defaults', () => {
  const { ok, problems, manifest: checked } = checkManifest(manifest);
  assert.deepEqual(problems, []);
  assert.ok(ok);
  assert.equal(checked.app, 'cdnms');
  assert.deepEqual(Object.keys(checked.settings), ['lang', 'sounds']);
});

test('with nothing set in Dashboard: German and sounds on, the page as it ships', () => {
  const { values, sources } = resolve(manifest, {});
  assert.deepEqual(values, { lang: 'de', sounds: true });
  assert.deepEqual(sources, { lang: 'own', sounds: 'own' });
  // On any browser: CDNMS speaks German first.
  assert.equal(languageFor(null, values.lang, en), 'de');
  assert.equal(languageFor(null, values.lang, de), 'de');
  assert.equal(soundsFor(null, values.sounds), true);
});

test('a value set for CDNMS reaches the page; the family’s stops at CDNMS’s own German and sounds on', () => {
  assert.deepEqual(resolve(manifest, { family: { lang: 'en', sounds: false } }).values, { lang: 'de', sounds: true });
  assert.deepEqual(resolve(manifest, { app: { lang: 'en', sounds: false } }).values, { lang: 'en', sounds: false });
  assert.deepEqual(resolve(manifest, { family: { lang: 'de' }, app: { lang: 'en' } }).values, { lang: 'en', sounds: true });
  // Dashboard's System sets no language: German, the built-in one.
  assert.equal(languageFor(null, resolve(manifest, { app: { lang: 'system' } }).values.lang, en), 'de');
});

test('the device’s own choice beats Dashboard’s, which beats the built-in one', () => {
  // QA's `ewo:lang` = `en` is this device's own choice, so it keeps winning.
  assert.equal(languageFor('en', 'de', de), 'en');
  assert.equal(languageFor('de', 'en', en), 'de');
  assert.equal(languageFor(null, 'en', de), 'en');
  assert.equal(languageFor(null, 'system', en), 'de');
  assert.equal(languageFor(null, undefined, en), 'de');
  assert.equal(languageFor('nonsense', 'purple', en), 'de');
  // An older pick of System still follows the browser, whatever Dashboard says.
  assert.equal(languageFor('system', 'de', en), 'en');
  assert.equal(languageFor('system', 'en', de), 'de');
  // The pill: Standard when nothing is picked, the browser's language for an older System.
  assert.equal(choiceFor(null, en), 'system');
  assert.equal(choiceFor('en', de), 'en');
  assert.equal(choiceFor('system', en), 'en');
  // Sounds: the switch on this device, else Dashboard's, else on.
  assert.equal(soundsFor('off', true), false);
  assert.equal(soundsFor('on', false), true);
  assert.equal(soundsFor(null, false), false);
  assert.equal(soundsFor(null, 'yes'), true);
  assert.equal(soundsFor(null, undefined), true);
});

/** public/boot.js against a stub page: the language it applies before first paint. */
function boot({ saved, config, languages = ['de-DE'] }) {
  const root = { lang: 'de', dataset: {}, classList: { add() {}, remove() {} }, style: { setProperty() {} } };
  const document = {
    documentElement: root,
    getElementById: (id) => (id === 'ewo-config' && config ? { textContent: JSON.stringify(config) } : null),
    addEventListener() {},
  };
  const storage = { getItem: (key) => (key === 'ewo:lang' && saved ? saved : null) };
  vm.runInNewContext(readFileSync(new URL('../public/boot.js', import.meta.url), 'utf8'), {
    document,
    localStorage: storage,
    matchMedia: () => ({ matches: false }),
    navigator: { languages },
    location: { search: '' },
    screen: {},
    addEventListener() {},
    setTimeout() {},
  });
  return root.lang;
}

test('before first paint: the saved language, else Dashboard’s, else German', () => {
  assert.equal(boot({ languages: ['en-GB'] }), 'de');
  assert.equal(boot({ config: { lang: 'de', sounds: true }, languages: ['en-GB'] }), 'de');
  assert.equal(boot({ config: { lang: 'system' }, languages: ['en-GB'] }), 'de');
  assert.equal(boot({ config: { lang: 'en' } }), 'en');
  assert.equal(boot({ saved: 'en', config: { lang: 'de' } }), 'en');
  assert.equal(boot({ saved: 'de', config: { lang: 'en' } }), 'de');
  assert.equal(boot({ saved: 'system', config: { lang: 'de' }, languages: ['en-US'] }), 'en');
});
