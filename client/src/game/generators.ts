import type { OperatorPayload, CryptoPayload, Decision } from "@signal-lock/shared";
import {
  ROUND1_PHRASES,
  ROUND2_PHRASES,
  ROUND3_CODEWORDS,
  ROUND3_GENUINE,
  ROUND3_IMPOSTOR,
  ROUND4_KEYWORDS,
  ROUND4_PHRASES,
  ROUND5_SCENARIOS,
} from "./pools";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export interface RoundInstance {
  operator: OperatorPayload;
  crypto: CryptoPayload;
  /** the canonical correct answer (a phrase, or a decision option id) */
  answer: string;
  /** all accepted answers, normalized; defaults to [answer] */
  accept: string[];
  /** a decode-then-decide prompt shown to the player, if any */
  decision: Decision | null;
  /** true when any accepted answer is fine and we only record the branch */
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

// ---- Round 1: glyph substitution ----
export function generateGlyphSubstitution(): RoundInstance {
  const phrase = pick(ROUND1_PHRASES);
  const shuffledLetters = shuffle(ALPHABET.split(""));
  const letterToGlyph = new Map<string, string>();
  const legend: Record<string, string> = {};
  shuffledLetters.forEach((letter, i) => {
    const glyphId = `g${i}`;
    letterToGlyph.set(letter, glyphId);
    legend[glyphId] = letter;
  });

  const words = phrase.split(" ").map((word) =>
    word.split("").map((letter) => letterToGlyph.get(letter) as string)
  );

  return simple(
    { kind: "glyph-substitution", words },
    { kind: "glyph-substitution", legend },
    phrase
  );
}

// ---- Round 2: shift cipher (clear, single-step derived offset) ----
const DIAL_CLUE_TEMPLATES = [
  (a: number, b: number) =>
    `Two nav readings blink on the console: ${a} and ${b}. Add them for your dial offset, then shift each letter backward by that number.`,
  (a: number, b: number) =>
    `The array drifted ${a} sectors, then ${b} more. Sum the drift — that's how far to roll the signal back.`,
  (a: number, b: number) =>
    `Fuel gauges read ${a} and ${b}. Their total is the shift; subtract it from every letter to decode.`,
];

export function generateShiftCipher(): RoundInstance {
  const phrase = pick(ROUND2_PHRASES);
  const shift = randInt(3, 24);
  const a = randInt(1, shift - 1);
  const b = shift - a;
  const ciphertext = phrase
    .split("")
    .map((ch) => {
      if (ch === " ") return " ";
      const idx = ALPHABET.indexOf(ch);
      return ALPHABET[(idx + shift) % 26];
    })
    .join("");

  const dialClueText = pick(DIAL_CLUE_TEMPLATES)(a, b);

  return simple(
    { kind: "shift-cipher", ciphertext },
    { kind: "shift-cipher", dialClueText },
    phrase
  );
}

// ---- Round 3: trap-signal (decode three, flag the impostor) ----
const ROW_LABELS = ["A", "B", "C", "D", "E"];
const COL_LABELS = ["1", "2", "3", "4", "5", "6"];

function buildGrid(): { grid: string[][]; coordOf: Map<string, string> } {
  const shuffledLetters = shuffle(ALPHABET.split(""));
  const grid: string[][] = [];
  let cursor = 0;
  for (let r = 0; r < 5; r++) {
    const row: string[] = [];
    for (let c = 0; c < 6; c++) {
      row.push(cursor < 26 ? (shuffledLetters[cursor++] as string) : "*");
    }
    grid.push(row);
  }
  const coordOf = new Map<string, string>();
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 6; c++) {
      const letter = grid[r]![c]!;
      if (letter !== "*") coordOf.set(letter, `${ROW_LABELS[r]}${COL_LABELS[c]}`);
    }
  }
  return { grid, coordOf };
}

const WORD_BREAK = "/";

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
  const order = shuffle([0, 1, 2]);
  const arranged = order.map((i) => messages[i] as string);
  const impostorSlot = order.indexOf(2);

  const signals = arranged.map((m) => encodeToCoords(m, coordOf));

  const decision: Decision = {
    prompt: "One order is a forgery. Which signal is the impostor?",
    options: [
      { id: "1", label: "Signal 1" },
      { id: "2", label: "Signal 2" },
      { id: "3", label: "Signal 3" },
    ],
    branching: false,
  };

  return {
    operator: { kind: "trap-signal", signals },
    crypto: {
      kind: "trap-signal",
      rowLabels: ROW_LABELS,
      colLabels: COL_LABELS,
      grid,
      briefing: `Command authenticates every genuine order with the codeword "${codeword}". The impostor won't have it. Decode all three, then flag the one missing the codeword.`,
    },
    answer: String(impostorSlot + 1),
    accept: [String(impostorSlot + 1)],
    decision,
    branching: false,
  };
}

// ---- Round 4: keyed layer (Vigenere, keyword from a math puzzle) ----
function arithmeticFor(target: number): string {
  const kind = randInt(0, 2);
  if (kind === 0) {
    const a = randInt(1, target);
    const b = target - a;
    return b >= 0 ? `${a} + ${b}` : `${target}`;
  }
  if (kind === 1 && target % 2 === 0) {
    return `${target / 2} x 2`;
  }
  const a = randInt(target + 1, target + 10);
  const b = a - target;
  return `${a} - ${b}`;
}

export function generateKeyedLayer(): RoundInstance {
  const phrase = pick(ROUND4_PHRASES);
  const keyword = pick(ROUND4_KEYWORDS);

  const puzzleParts = keyword.split("").map((letter) => {
    const target = ALPHABET.indexOf(letter) + 1;
    return `${arithmeticFor(target)} = ?`;
  });
  const puzzleText = puzzleParts.join("   |   ");
  const puzzleHint = "Solve each, convert number to letter (A=1, B=2 ... Z=26), read in order.";

  const ciphertext = phrase
    .split("")
    .map((ch, i) => {
      if (ch === " ") return " ";
      const keyLetter = keyword[i % keyword.length] as string;
      const shift = ALPHABET.indexOf(keyLetter);
      const idx = ALPHABET.indexOf(ch);
      return ALPHABET[(idx + shift) % 26];
    })
    .join("");

  return simple(
    { kind: "keyed-layer", ciphertext },
    { kind: "keyed-layer", puzzleText, puzzleHint },
    phrase
  );
}

// ---- Round 5: pigpen finale (visual cipher + branching choice) ----
export function generatePigpenFinal(scenarioIndex: number): RoundInstance {
  const scenario = ROUND5_SCENARIOS[scenarioIndex % ROUND5_SCENARIOS.length]!;
  const words = scenario.message.split(" ").map((w) => w.split(""));

  const decision: Decision = {
    prompt: scenario.prompt,
    options: scenario.options,
    branching: true,
  };

  return {
    operator: { kind: "pigpen-final", words },
    crypto: {
      kind: "pigpen-final",
      note: "Use the Pigpen key below to translate the symbols your Operator sees, then decide together.",
    },
    answer: scenario.message,
    accept: scenario.options.map((o) => normalizeAnswer(o.id)),
    decision,
    branching: true,
  };
}

function simple(
  operator: OperatorPayload,
  crypto: CryptoPayload,
  phrase: string
): RoundInstance {
  const answer = normalizeAnswer(phrase);
  return { operator, crypto, answer, accept: [answer], decision: null, branching: false };
}

export function generateRound(roundIndex: number, finaleScenarioIndex: number): RoundInstance {
  switch (roundIndex) {
    case 0:
      return generateGlyphSubstitution();
    case 1:
      return generateShiftCipher();
    case 2:
      return generateTrapSignal();
    case 3:
      return generateKeyedLayer();
    case 4:
      return generatePigpenFinal(finaleScenarioIndex);
    default:
      throw new Error(`No generator for round ${roundIndex}`);
  }
}
