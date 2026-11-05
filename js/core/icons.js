// Trusted, local SVG paths: controls do not depend on a remote icon font.
const paths = {
  cards: '<rect x="7" y="7" width="13" height="14" rx="2"/><path d="M4 17V5a2 2 0 0 1 2-2h11"/>',
  books: '<path d="M4 4h5v16H4zM9 4h5v16H9zM14 6l4-1 4 14-4 1zM3 20h19"/>',
  'clipboard-check': '<rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3m-6 9 2 2 4-4"/>',
  add: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8m-4-4h8"/>',
  again: '<path d="m6 6 12 12M18 6 6 18"/>',
  hard: '<path d="M17 17 6 6M6 14V6h8"/><path d="M18 8v4m0 3v.01"/>',
  good: '<path d="M7 10v11H3V10h4Zm0 0 5-8c2 0 3 2 2 4l-1 4h6a2 2 0 0 1 2 2l-2 7a3 3 0 0 1-3 2H7"/>',
  easy: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
  flip: '<path d="M4 8h14l-4-4m6 12H6l4 4M4 8v5m16 3v-5"/>',
  audio: '<path d="m11 5-6 4H2v6h3l6 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  previous: '<path d="M19 12H5m6-6-6 6 6 6"/>',
  next: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14v6Z"/>',
  delete: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  merge: '<path d="M4 6h4a4 4 0 0 1 3.2 1.6l2.6 3.4a2.5 2.5 0 0 0 2 1H20m-4-4 4 4-4 4M4 18h4a4 4 0 0 0 3.2-1.6l2.6-3.4"/>',
  share: '<path d="M12 16V3m-4 4 4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>'
};
export function icon(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.flip}</svg>`;
}
