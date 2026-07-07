import type { OperatorPayload, CryptoPayload, Decision } from "@signal-lock/shared";
import {
  ROUND1_PHRASES,
  ROUND2_PHRASES,
  ROUND3_CODEWORDS,
  ROUND3_GENUINE,
  ROUND3_IMPOSTOR,
  ROUND4_KEYWORDS,
  ROUND4_PHRASES,
  PLAYFAIR_KEYWORDS,
  ROUND5_SCENARIOS,
} from "./pools";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export interface RoundInstance {
  operator: OperatorPayload;
  crypto: CryptoPayload;
  /** the canonical correct answer (the decoded phrase) */
  answer: string;
  /** all accepted answers, normalized */
  accept: string[];
  /** a decode-then-decide prompt (round 5 branch), shown after a correct decode */
  decision: Decision | null;
  /** true when the decision only records a branch (finale ending), not scored */
  branching: boolean;
}

export function normalizeAnswer(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, " ");
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ---- Round 1: Pigpen (visual warm-up) ----
export function generatePigpen(): RoundInstance {
  const phrase = pick(ROUND1_PHRASES);
  const words = phrase.split(" ").map((w) => w.split(""));
  return simple(
    { kind: "pigpen", words },
    {
      kind: "pigpen",
      note: "Use the Pigpen key below to translate the symbols your Operator sees.",
    },
    phrase
  );
}

// ---- Round 2: shift cipher ----
const DIAL_CLUE_TEMPLATES = [
  (a: number, b: number) =>
    `The signal is rolled forward on the alphabet. Two nav readings blink: ${a} and ${b}. Add them — that's the shift. Move every letter BACKWARD by that many to read it (e.g. shift 3: D→A).`,
  (a: number, b: number) =>
    `The array drifted ${a} sectors, then ${b} more. Sum the drift, then walk each letter backward through the alphabet by that number (shift 3: D→A) to recover the message.`,
  (a: number, b: number) =>
    `Fuel gauges read ${a} and ${b}. Their total is how far the alphabet was pushed forward — subtract it from every letter (shift 3: D→A) to decode.`,
];

export function generateShiftCipher(): RoundInstance {
  const phrase = pick(ROUND2_PHRASES);
  const shift = randInt(3, 24);
  const a = randInt(1, shift - 1);
  const b = shift - a;
  const ciphertext = phrase
    .split("")
    .map((ch) => (ch === " " ? " " : ALPHABET[(ALPHABET.indexOf(ch) + shift) % 26]))
    .join("");
  return simple(
    { kind: "shift-cipher", ciphertext },
    { kind: "shift-cipher", dialClueText: pick(DIAL_CLUE_TEMPLATES)(a, b) },
    phrase
  );
}

// ---- Round 3: trap-signal (decode three, TYPE the impostor's order) ----
const ROW_LABELS = ["A", "B", "C", "D", "E"];
const COL_LABELS = ["1", "2", "3", "4", "5", "6"];
const WORD_BREAK = "/";

function buildGrid(): { grid: string[][]; coordOf: Map<string, string> } {
  const shuffledLetters = shuffle(ALPHABET.split(""));
  const grid: string[][] = [];
  let cursor = 0;
  for (let r = 0; r < 5; r++) {
    const row: string[] = [];
    for (let c = 0; c < 6; c++) row.push(cursor < 26 ? (shuffledLetters[cursor++] as string) : "*");
    grid.push(row);
  }
  const coordOf = new Map<string, string>();
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 6; c++) {
      const letter = grid[r]![c]!;
      if (letter !== "*") coordOf.set(letter, `${ROW_LABELS[r]}${COL_LABELS[c]}`);
    }
  return { grid, coordOf };
}

function encodeToCoords(text: string, coordOf: Map<string, string>): string[] {
  const words = text.split(" ");
  const coords: string[] = [];
  words.forEach((word, wi) => {
    word.split("").forEach((letter) => coords.push(coordOf.get(letter) as string));
    if (wi < words.length - 1) coords.push(WORD_BREAK);
  });
  return coords;
}

export function generateTrapSignal(): RoundInstance {
  const { grid, coordOf } = buildGrid();
  const codeword = pick(ROUND3_CODEWORDS);
  const genuinePair = shuffle([...ROUND3_GENUINE]).slice(0, 2);
  const impostor = pick(ROUND3_IMPOSTOR);

  const messages = [
    `${codeword} ${genuinePair[0]}`,
    `${codeword} ${genuinePair[1]}`,
    impostor,
  ];
  const arranged = shuffle(messages);
  const signals = arranged.map((m) => encodeToCoords(m, coordOf));

  return {
    operator: { kind: "trap-signal", signals },
    crypto: {
      kind: "trap-signal",
      rowLabels: ROW_LABELS,
      colLabels: COL_LABELS,
      grid,
      briefing: `Command signs every genuine order with the codeword "${codeword}". The forgery won't have it. Decode all three, then type the fake order — the one missing the codeword — exactly as it reads.`,
    },
    answer: normalizeAnswer(impostor),
    accept: [normalizeAnswer(impostor)],
    decision: null,
    branching: false,
  };
}

// ---- Round 4: keyed layer (Vigenere, keyword from a math puzzle) ----
function arithmeticFor(target: number): string {
  const kind = randInt(0, 2);
  if (kind === 0) {
    const a = randInt(1, target);
    return `${a} + ${target - a}`;
  }
  if (kind === 1 && target % 2 === 0) return `${target / 2} x 2`;
  const a = randInt(target + 1, target + 10);
  return `${a} - ${a - target}`;
}

export function generateKeyedLayer(): RoundInstance {
  const phrase = pick(ROUND4_PHRASES);
  const keyword = pick(ROUND4_KEYWORDS);
  const puzzleText = keyword
    .split("")
    .map((letter) => `${arithmeticFor(ALPHABET.indexOf(letter) + 1)} = ?`)
    .join("   |   ");
  const ciphertext = phrase
    .split("")
    .map((ch, i) => {
      if (ch === " ") return " ";
      const shift = ALPHABET.indexOf(keyword[i % keyword.length] as string);
      return ALPHABET[(ALPHABET.indexOf(ch) + shift) % 26];
    })
    .join("");
  return simple(
    { kind: "keyed-layer", ciphertext },
    {
      kind: "keyed-layer",
      puzzleText,
      puzzleHint: "Solve each, convert number to letter (A=1, B=2 ... Z=26), read in order.",
    },
    phrase
  );
}

// ---- Round 5: Playfair finale (serious digraph cipher + branching ending) ----
function buildPlayfairSquare(keyword: string): string[][] {
  const seen = new Set<string>();
  const letters: string[] = [];
  for (const ch of (keyword + "ABCDEFGHIKLMNOPQRSTUVWXYZ").toUpperCase()) {
    const c = ch === "J" ? "I" : ch;
    if (c >= "A" && c <= "Z" && !seen.has(c)) {
      seen.add(c);
      letters.push(c);
    }
  }
  const square: string[][] = [];
  for (let r = 0; r < 5; r++) square.push(letters.slice(r * 5, r * 5 + 5));
  return square;
}

function playfairEncode(plain: string, square: string[][]): string[] {
  const pos = new Map<string, [number, number]>();
  square.forEach((row, r) => row.forEach((ch, c) => pos.set(ch, [r, c])));
  const pairs: string[] = [];
  for (let i = 0; i < plain.length; i += 2) {
    const [ra, ca] = pos.get(plain[i] as string) as [number, number];
    const [rb, cb] = pos.get(plain[i + 1] as string) as [number, number];
    let ea: string, eb: string;
    if (ra === rb) {
      ea = square[ra]![(ca + 1) % 5]!;
      eb = square[rb]![(cb + 1) % 5]!;
    } else if (ca === cb) {
      ea = square[(ra + 1) % 5]![ca]!;
      eb = square[(rb + 1) % 5]![cb]!;
    } else {
      ea = square[ra]![cb]!;
      eb = square[rb]![ca]!;
    }
    pairs.push(ea + eb);
  }
  return pairs;
}

export function generatePlayfairFinal(scenarioIndex: number): RoundInstance {
  const scenario = ROUND5_SCENARIOS[scenarioIndex % ROUND5_SCENARIOS.length]!;
  const keyword = pick(PLAYFAIR_KEYWORDS);
  const square = buildPlayfairSquare(keyword);
  const plain = scenario.message.replace(/[^A-Za-z]/g, "").toUpperCase().replace(/J/g, "I");
  const pairs = playfairEncode(plain, square);

  const decision: Decision = {
    prompt: scenario.prompt,
    options: scenario.options,
    branching: true,
  };
  const normalized = normalizeAnswer(scenario.message);
  return {
    operator: { kind: "playfair", pairs },
    crypto: {
      kind: "playfair",
      square,
      note:
        "Split the signal into its letter pairs. For each pair, find both letters in the grid: same ROW → take the letter to the LEFT of each (wrap around); same COLUMN → take the letter ABOVE each (wrap); otherwise → keep each letter's row but swap to the other's column. Read the result.",
    },
    answer: normalized,
    accept: [normalized, normalized.replace(/ /g, "")],
    decision,
    branching: true,
  };
}

function simple(operator: OperatorPayload, crypto: CryptoPayload, phrase: string): RoundInstance {
  const answer = normalizeAnswer(phrase);
  return { operator, crypto, answer, accept: [answer], decision: null, branching: false };
}

export function generateRound(roundIndex: number, finaleScenarioIndex: number): RoundInstance {
  switch (roundIndex) {
    case 0:
      return generatePigpen();
    case 1:
      return generateShiftCipher();
    case 2:
      return generateTrapSignal();
    case 3:
      return generateKeyedLayer();
    case 4:
      return generatePlayfairFinal(finaleScenarioIndex);
    default:
      throw new Error(`No generator for round ${roundIndex}`);
  }
}
