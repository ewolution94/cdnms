// This device's own game preferences (Settings → CDNMS): the key hidden at first, for a spymaster
// who shares their screen on a call. Kept in localStorage; blocked storage just means the default.

const KEY_HIDDEN = 'cdnms:key-hidden';

function stored() {
  try {
    return localStorage.getItem(KEY_HIDDEN) === 'on';
  } catch {
    return false;
  }
}

export const prefs = $state({ keyHidden: stored() });

export function setKeyHidden(on: boolean) {
  prefs.keyHidden = on;
  try {
    localStorage.setItem(KEY_HIDDEN, on ? 'on' : 'off');
  } catch {
    // not kept
  }
}
