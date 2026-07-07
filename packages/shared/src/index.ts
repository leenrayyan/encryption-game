// Shared types between server and client for Signal Lock.

export type Role = "operator" | "cryptographer" | "solo";

export type RoundKind =
  | "glyph-substitution"
  | "shift-cipher"
  | "trap-signal"
  | "keyed-layer"
  | "pigpen-final";

export type SessionStatus = "lobby" | "in_round" | "round_result" | "finished";

export interface PlayerInfo {
  id: string;
  name: string;
  teamId: string;
  role: Role;
}

export interface TeamPublicStatus {
  id: string;
  name: string;
  solo: boolean;
  locked: boolean;
  attempts: number;
  lockedAtMs: number | null;
  score: number;
}

/** One entry in a team's running Decoded Log (shown on every phone). */
export interface LogEntry {
  roundIndex: number;
  title: string;
  answer: string;
}

/** A choice the player makes after decoding (round 3 impostor, round 5 branch). */
export interface DecisionOption {
  id: string;
  label: string;
}
export interface Decision {
  prompt: string;
  options: DecisionOption[];
  /** true = both options are "correct" and just record a branch (round 5). */
  branching: boolean;
}

// ---- Round content payloads ----
// Each round kind has an Operator payload (the raw signal) and a
// Cryptographer payload (the tools to decode it). Solo players receive both.

export interface GlyphSubstitutionOperatorPayload {
  kind: "glyph-substitution";
  /** Sequence of glyph ids grouped into words, e.g. [["g3","g1"],["g9"]] */
  words: string[][];
}
export interface GlyphSubstitutionCryptoPayload {
  kind: "glyph-substitution";
  /** glyph id -> letter, full mapping for the alphabet used in this message */
  legend: Record<string, string>;
}

export interface ShiftCipherOperatorPayload {
  kind: "shift-cipher";
  ciphertext: string; // uppercase letters + spaces
}
export interface ShiftCipherCryptoPayload {
  kind: "shift-cipher";
  /** A clear clue whose answer is the shift amount (1-25) — differs per team */
  dialClueText: string;
}

/** Round 3 — decode three short signals off a grid, then flag the impostor. */
export interface TrapSignalOperatorPayload {
  kind: "trap-signal";
  /** three signals, each a list of grid coordinates like ["B4","A2"] */
  signals: string[][];
}
export interface TrapSignalCryptoPayload {
  kind: "trap-signal";
  rowLabels: string[];
  colLabels: string[];
  grid: string[][];
  /** the rule that identifies the fake, e.g. "genuine orders begin with ORION" */
  briefing: string;
}

export interface KeyedLayerOperatorPayload {
  kind: "keyed-layer";
  ciphertext: string; // Vigenere-style ciphertext
}
export interface KeyedLayerCryptoPayload {
  kind: "keyed-layer";
  /** small math puzzle whose solution spells/derives the keyword */
  puzzleText: string;
  puzzleHint: string;
}

/** Round 5 — Pigpen cipher; letters rendered client-side as pigpen glyphs. */
export interface PigpenFinalOperatorPayload {
  kind: "pigpen-final";
  /** words as letters; the client renders each letter as a pigpen symbol */
  words: string[][];
}
export interface PigpenFinalCryptoPayload {
  kind: "pigpen-final";
  note: string; // guidance; the standard pigpen key chart is drawn client-side
}

export type OperatorPayload =
  | GlyphSubstitutionOperatorPayload
  | ShiftCipherOperatorPayload
  | TrapSignalOperatorPayload
  | KeyedLayerOperatorPayload
  | PigpenFinalOperatorPayload;

export type CryptoPayload =
  | GlyphSubstitutionCryptoPayload
  | ShiftCipherCryptoPayload
  | TrapSignalCryptoPayload
  | KeyedLayerCryptoPayload
  | PigpenFinalCryptoPayload;

export interface RoundBroadcast {
  roundIndex: number; // 0-based
  roundCount: number;
  title: string;
  storyBeat: string;
  timeLimitSec: number;
  endsAtMs: number;
}

/** What a specific team's specific role sees for the current round. */
export interface TeamRoundPayload {
  roundIndex: number;
  operator: OperatorPayload | null; // null if this player's role is cryptographer
  crypto: CryptoPayload | null; // null if this player's role is operator
  isSolo: boolean;
  /** decode-then-decide rounds attach a decision (round 3, round 5) */
  decision: Decision | null;
  /** this team's running log of everything decoded so far */
  log: LogEntry[];
}

/** Ending tally for the shared screen after a branching finale. */
export interface EndingSummary {
  dominantChoiceId: string | null;
  counts: Record<string, number>;
  optionLabels: Record<string, string>;
  headline: string;
  detail: string;
}

// ---- Socket.IO event contracts ----

export interface AckResult {
  ok: boolean;
  error?: string;
  playerId?: string;
}

export interface ClientToServerEvents {
  "session:create": (cb: (res: { code: string }) => void) => void;
  "session:join": (
    payload: { code: string; name: string },
    cb: (res: AckResult) => void
  ) => void;
  /** Screen display joins read-only, no player/team is created for it. */
  "spectator:join": (payload: { code: string }, cb: (res: AckResult) => void) => void;
  "team:join": (payload: { teamName: string }, cb: (res: AckResult) => void) => void;
  "answer:update": (payload: { draft: string }) => void;
  "answer:submit": (payload: { answer: string }) => void;
  "host:startGame": () => void;
  "host:nextRound": () => void;
  "host:endGame": () => void;
}

export interface ServerToClientEvents {
  "session:state": (state: {
    status: SessionStatus;
    code: string;
    teams: TeamPublicStatus[];
    roundIndex: number;
    roundCount: number;
    ending: EndingSummary | null;
  }) => void;
  "round:start": (broadcast: RoundBroadcast) => void;
  "round:payload": (payload: TeamRoundPayload) => void;
  "round:end": (payload: { roundIndex: number; correctAnswer: string }) => void;
  "team:answerUpdate": (payload: { draft: string }) => void;
  "team:locked": (payload: { teamId: string; roundIndex: number }) => void;
  "team:log": (payload: { log: LogEntry[] }) => void;
  "scoreboard:update": (payload: { teams: TeamPublicStatus[] }) => void;
  "error:message": (payload: { message: string }) => void;
}
