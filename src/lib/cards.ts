// What a card shows: its word, or its picture (two motifs, laid out the way server/pictures says,
// so every screen draws the same card), and its name for screen readers and the log.

import { BY_ID, VIEW, layout, pictureName } from '../../server/pictures/index.mjs';
import type { Card, Key } from './api';
import { i18n, t, teamName } from './i18n.svelte';

/** The picture's SVG content (motifs are our own static strings, server/pictures/motifs.mjs). */
export function pictureSvg(card: Extract<Card, { kind: 'pic' }>) {
  return layout(card)
    .map(({ id, cx, cy, size, rot }) => {
      const motif = BY_ID.get(id);
      if (!motif) return '';
      return `<g transform="translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${rot}) scale(${(size / 24).toFixed(3)}) translate(-12 -12)">${motif.svg}</g>`;
    })
    .join('');
}

export const pictureView = `0 0 ${VIEW.w} ${VIEW.h}`;

/** The card's name: its word, or "Fisch in Glühbirne". */
export function cardName(card: Card) {
  return card.kind === 'word' ? card.text : pictureName(card, i18n.lang);
}

/** What a key means, in words: "Agent Grün", "Passant", "Attentäter". */
export function keyName(k: Key) {
  if (k === 'a') return t('assassin');
  if (k === 'b') return t('bystander');
  return `${t('agent')} ${teamName(k)}`;
}
