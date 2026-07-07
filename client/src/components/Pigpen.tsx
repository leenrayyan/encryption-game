// Renders letters as standard Pigpen (Freemason) cipher glyphs, and the key chart.
// The Operator sees glyphs (PigpenGlyph); the Cryptographer sees the chart (PigpenKey).
//
// Standard layout:
//   Grid 1 (no dot):  A B C / D E F / G H I   -> box edges by cell position
//   Grid 2 (dot):     J K L / M N O / P Q R   -> same shapes, with a dot
//   X 1 (no dot):     S T U V  (up/left/right/down wedges)
//   X 2 (dot):        W X Y Z  (same wedges, with a dot)

type Edges = { top: boolean; right: boolean; bottom: boolean; left: boolean };

// For the 3x3 grid, each cell keeps the borders shared with the outer frame.
// row/col 0..2; a border exists where the cell touches the grid's outside.
function gridEdges(row: number, col: number): Edges {
  return {
    top: row === 0,
    bottom: row === 2,
    left: col === 0,
    right: col === 2,
  };
}

const GRID_LETTERS = "ABCDEFGHI"; // grid 1
const GRID_LETTERS_DOT = "JKLMNOPQR"; // grid 2
const X_LETTERS = "STUV"; // wedges: up,left,right,down
const X_LETTERS_DOT = "WXYZ";

function PigpenSVG({ letter, size = 40 }: { letter: string; size?: number }) {
  const L = letter.toUpperCase();
  const s = size;
  const pad = s * 0.15;
  const a = pad;
  const b = s - pad;
  const mid = s / 2;
  const stroke = "var(--accent)";
  const sw = Math.max(2, s * 0.06);

  const lines: [number, number, number, number][] = [];
  let dot = false;
  let wedge: "up" | "left" | "right" | "down" | null = null;

  if (GRID_LETTERS.includes(L) || GRID_LETTERS_DOT.includes(L)) {
    const isDot = GRID_LETTERS_DOT.includes(L);
    const idx = (isDot ? GRID_LETTERS_DOT : GRID_LETTERS).indexOf(L);
    const row = Math.floor(idx / 3);
    const col = idx % 3;
    const e = gridEdges(row, col);
    if (e.top) lines.push([a, a, b, a]);
    if (e.bottom) lines.push([a, b, b, b]);
    if (e.left) lines.push([a, a, a, b]);
    if (e.right) lines.push([b, a, b, b]);
    dot = isDot;
  } else if (X_LETTERS.includes(L) || X_LETTERS_DOT.includes(L)) {
    const isDot = X_LETTERS_DOT.includes(L);
    const idx = (isDot ? X_LETTERS_DOT : X_LETTERS).indexOf(L);
    wedge = (["up", "left", "right", "down"] as const)[idx]!;
    dot = isDot;
  }

  if (wedge === "up") {
    lines.push([a, b, mid, a], [mid, a, b, b]);
  } else if (wedge === "down") {
    lines.push([a, a, mid, b], [mid, b, b, a]);
  } else if (wedge === "left") {
    lines.push([b, a, a, mid], [a, mid, b, b]);
  } else if (wedge === "right") {
    lines.push([a, a, b, mid], [b, mid, a, b]);
  }

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ display: "block" }}>
      {lines.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      ))}
      {dot && <circle cx={mid} cy={mid} r={s * 0.07} fill={stroke} />}
    </svg>
  );
}

export function PigpenGlyph({ letter, size }: { letter: string; size?: number }) {
  if (letter === " ") return <span style={{ display: "inline-block", width: size ?? 40 }} />;
  return <PigpenSVG letter={letter} size={size} />;
}

/** The reference chart the Cryptographer uses (shape -> letter). */
export function PigpenKey() {
  const all = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))",
        gap: "0.4rem",
      }}
    >
      {all.map((letter) => (
        <div key={letter} className="legend-cell" style={{ padding: "0.3em" }}>
          <PigpenSVG letter={letter} size={34} />
          <span className="letter">{letter}</span>
        </div>
      ))}
    </div>
  );
}
