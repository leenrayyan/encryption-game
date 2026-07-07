// Purely visual: maps a glyph id (e.g. "g7") to an alien-looking symbol.
// Server only ever deals with abstract ids; this table is what makes them
// look like a real alphabet on screen. Kept identical on Operator and
// Cryptographer views so the legend actually matches the signal.
const GLYPH_CHARS = [
  "▲", "△", "▼", "▽", "◆", "◇", "●", "○", "■", "□",
  "★", "☆", "✦", "✧", "✚", "✜", "✕", "✖", "✳", "✴",
  "❖", "❊", "❋", "⬟", "⬢", "⬣",
];

export function glyphChar(glyphId: string): string {
  const idx = Number(glyphId.replace("g", ""));
  return GLYPH_CHARS[idx] ?? "?";
}
