// The authoritative "brain" that runs in the Screen page's browser. It owns the
// game logic (round generation, timers, validation, scoring, auto-advance) and
// publishes public state to Firebase RTDB. Answers stay in memory here and are
// never written to the database, so players can't peek to cheat.
import {
  ref,
  set,
  update,
  onValue,
  onChildAdded,
  remove,
} from "firebase/database";
import type { Role, SessionStatus, EndingSummary, LogEntry } from "@signal-lock/shared";
import { db } from "../firebase";
import { ROUND_META, ROUND5_SCENARIOS } from "./pools";
import { generateRound, normalizeAnswer, type RoundInstance } from "./generators";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROUND_COUNT = 5;
const RESULT_DISPLAY_MS = 18000;
const MIN_SCORE = 100;
const BASE_SCORE = 1000;
const ATTEMPT_PENALTY = 100;

export function generateCode(): string {
  return Array.from(
    { length: 4 },
    () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  ).join("");
}

function teamIdFor(teamName: string): string {
  // Stable, RTDB-key-safe id from the team name.
  return (
    "t_" +
    normalizeAnswer(teamName)
      .replace(/[^A-Z0-9]+/g, "_")
      .slice(0, 40) || "t_team"
  );
}

interface RawPlayer {
  name: string;
  teamName: string;
  joinedAt: number;
}

interface BrainTeam {
  id: string;
  name: string;
  solo: boolean;
  memberIds: string[];
  score: number;
  locked: boolean;
  attempts: number;
  lockedAtMs: number | null;
  finalChoice?: string;
  instance: RoundInstance | null;
  answerHistory: string[];
}

export class BrainEngine {
  code: string;
  status: SessionStatus = "lobby";
  roundIndex = -1;
  finaleScenarioIndex = Math.floor(Math.random() * ROUND5_SCENARIOS.length);
  teams = new Map<string, BrainTeam>();
  players = new Map<string, RawPlayer>();
  roundEndsAtMs = 0;
  private roundTimer: ReturnType<typeof setTimeout> | null = null;
  private resultTimer: ReturnType<typeof setTimeout> | null = null;
  private cleanups: (() => void)[] = [];

  constructor(code: string) {
    this.code = code;
  }

  private path(sub: string) {
    return ref(db, `sessions/${this.code}/${sub}`);
  }

  /** Create the session in RTDB and start listening for players + submissions. */
  async create(): Promise<void> {
    await set(this.path("meta"), {
      status: "lobby",
      roundIndex: -1,
      roundCount: ROUND_COUNT,
      createdAt: Date.now(),
    });

    this.cleanups.push(
      onValue(this.path("players"), (snap) => {
        const val = (snap.val() ?? {}) as Record<string, RawPlayer>;
        this.players = new Map(Object.entries(val));
        if (this.status === "lobby") this.rebuildTeams();
      })
    );

    // Submission queue: players push, we process each once and remove it.
    this.cleanups.push(
      onChildAdded(this.path("submissions"), (snap) => {
        const key = snap.key!;
        const val = snap.val() as { teamId: string; answer: string } | null;
        if (val) this.handleSubmission(val.teamId, val.answer);
        remove(this.path(`submissions/${key}`));
      })
    );
  }

  /** Group players into teams by name, assign roles, publish teams + assignments. */
  private rebuildTeams(): void {
    const byTeam = new Map<string, { id: string; players: [string, RawPlayer][] }>();
    for (const [pid, p] of this.players) {
      const id = teamIdFor(p.teamName);
      if (!byTeam.has(id)) byTeam.set(id, { id, players: [] });
      byTeam.get(id)!.players.push([pid, p]);
    }

    for (const { id, players } of byTeam.values()) {
      players.sort((a, b) => a[1].joinedAt - b[1].joinedAt);
      const solo = players.length === 1;
      const memberIds = players.map(([pid]) => pid);
      const name = players[0]![1].teamName;

      const existing = this.teams.get(id);
      const team: BrainTeam = existing ?? {
        id,
        name,
        solo,
        memberIds,
        score: 0,
        locked: false,
        attempts: 0,
        lockedAtMs: null,
        instance: null,
        answerHistory: [],
      };
      team.solo = solo;
      team.memberIds = memberIds;
      team.name = name;
      this.teams.set(id, team);

      // Publish public team status.
      update(this.path(`teams/${id}`), {
        id,
        name,
        solo,
        score: team.score,
        locked: team.locked,
        attempts: team.attempts,
        lockedAtMs: team.lockedAtMs,
      });

      // Assign each player a role (first = operator, rest = cryptographer, alone = solo).
      players.forEach(([pid], i) => {
        const role: Role = solo ? "solo" : i === 0 ? "operator" : "cryptographer";
        set(this.path(`assignments/${pid}`), { teamId: id, role });
      });
    }
  }

  startGame(): void {
    if (this.status !== "lobby" || this.teams.size === 0) return;
    this.status = "in_round";
    this.startRound(0);
  }

  private startRound(roundIndex: number): void {
    const meta = ROUND_META[roundIndex];
    if (!meta) return;
    if (this.resultTimer) {
      clearTimeout(this.resultTimer);
      this.resultTimer = null;
    }
    this.roundIndex = roundIndex;
    this.status = "in_round";
    this.roundEndsAtMs = Date.now() + meta.timeLimitSec * 1000;

    for (const team of this.teams.values()) {
      const instance = generateRound(roundIndex, this.finaleScenarioIndex);
      team.instance = instance;
      team.locked = false;
      team.attempts = 0;
      team.lockedAtMs = null;

      set(this.path(`payloads/${team.id}`), {
        roundIndex,
        operator: instance.operator,
        crypto: instance.crypto,
        decision: instance.decision,
        correctAnswer: null,
      });
      update(this.path(`teams/${team.id}`), {
        locked: false,
        attempts: 0,
        lockedAtMs: null,
      });
      remove(this.path(`feedback/${team.id}`));
    }

    set(this.path("meta"), {
      status: "in_round",
      roundIndex,
      roundCount: ROUND_COUNT,
      title: meta.title,
      storyBeat: meta.storyBeat,
      timeLimitSec: meta.timeLimitSec,
      roundEndsAtMs: this.roundEndsAtMs,
      nextStartsAtMs: null,
    });

    if (this.roundTimer) clearTimeout(this.roundTimer);
    this.roundTimer = setTimeout(() => this.endRound(), meta.timeLimitSec * 1000);
  }

  private handleSubmission(teamId: string, answer: string): void {
    if (this.status !== "in_round") return;
    const team = this.teams.get(teamId);
    if (!team || team.locked || !team.instance) return;

    const normalized = normalizeAnswer(answer);
    if (team.instance.accept.includes(normalized)) {
      if (team.instance.branching) team.finalChoice = normalized;
      const elapsedSec = Math.max(
        0,
        Math.floor((Date.now() - (this.roundEndsAtMs - this.currentLimitMs())) / 1000)
      );
      const score = Math.max(
        MIN_SCORE,
        BASE_SCORE - team.attempts * ATTEMPT_PENALTY - elapsedSec * 2
      );
      team.locked = true;
      team.lockedAtMs = Date.now();
      team.score += score;
      update(this.path(`teams/${teamId}`), {
        locked: true,
        lockedAtMs: team.lockedAtMs,
        score: team.score,
      });
      set(this.path(`feedback/${teamId}`), { result: "locked", at: Date.now() });
      if ([...this.teams.values()].every((t) => t.locked)) this.endRound();
    } else {
      team.attempts += 1;
      update(this.path(`teams/${teamId}`), { attempts: team.attempts });
      set(this.path(`feedback/${teamId}`), { result: "rejected", at: Date.now() });
    }
  }

  private endRound(): void {
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }
    if (this.status !== "in_round") return;
    this.status = "round_result";
    const nextStartsAtMs = Date.now() + RESULT_DISPLAY_MS;

    for (const team of this.teams.values()) {
      const instance = team.instance;
      if (!instance) continue;
      team.answerHistory[this.roundIndex] = decisionLogText(instance, team.finalChoice);
      update(this.path(`payloads/${team.id}`), { correctAnswer: instance.answer });
      set(this.path(`log/${team.id}`), this.logFor(team));
    }

    update(this.path("meta"), { status: "round_result", nextStartsAtMs });

    if (this.resultTimer) clearTimeout(this.resultTimer);
    this.resultTimer = setTimeout(() => this.advance(), RESULT_DISPLAY_MS);
  }

  /** Auto-advance to the next round or finish. Also the optional manual skip. */
  advance(): void {
    if (this.resultTimer) {
      clearTimeout(this.resultTimer);
      this.resultTimer = null;
    }
    if (this.status !== "round_result") return;
    const next = this.roundIndex + 1;
    if (next >= ROUND_COUNT) {
      this.status = "finished";
      set(this.path("ending"), this.computeEnding());
      update(this.path("meta"), { status: "finished", nextStartsAtMs: null });
      return;
    }
    this.startRound(next);
  }

  endGame(): void {
    if (this.roundTimer) clearTimeout(this.roundTimer);
    if (this.resultTimer) clearTimeout(this.resultTimer);
    this.status = "finished";
    set(this.path("ending"), this.computeEnding());
    update(this.path("meta"), { status: "finished", nextStartsAtMs: null });
  }

  private logFor(team: BrainTeam): LogEntry[] {
    const entries: LogEntry[] = [];
    team.answerHistory.forEach((answer, roundIndex) => {
      if (!answer) return;
      entries.push({
        roundIndex,
        title: ROUND_META[roundIndex]?.title ?? `Round ${roundIndex + 1}`,
        answer,
      });
    });
    return entries;
  }

  private computeEnding(): EndingSummary {
    const scenario = ROUND5_SCENARIOS[this.finaleScenarioIndex]!;
    const optionLabels: Record<string, string> = {};
    for (const o of scenario.options) optionLabels[normalizeAnswer(o.id)] = o.label;

    const counts: Record<string, number> = {};
    for (const team of this.teams.values()) {
      if (!team.finalChoice) continue;
      counts[team.finalChoice] = (counts[team.finalChoice] ?? 0) + 1;
    }
    let dominantChoiceId: string | null = null;
    let best = -1;
    for (const [id, n] of Object.entries(counts)) {
      if (n > best) {
        best = n;
        dominantChoiceId = id;
      }
    }
    const rawId = scenario.options.find(
      (o) => normalizeAnswer(o.id) === dominantChoiceId
    )?.id;
    const ending = rawId ? scenario.endings[rawId] : undefined;

    return {
      dominantChoiceId,
      counts,
      optionLabels,
      headline: ending?.headline ?? "TRANSMISSION ENDS",
      detail:
        ending?.detail ??
        "No station reached a decision in time. The signal fades into static, its meaning lost.",
    };
  }

  private currentLimitMs(): number {
    return (ROUND_META[this.roundIndex]?.timeLimitSec ?? 0) * 1000;
  }

  destroy(): void {
    if (this.roundTimer) clearTimeout(this.roundTimer);
    if (this.resultTimer) clearTimeout(this.resultTimer);
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
  }
}

/** Short human-readable log entry for the Decoded Log. */
function decisionLogText(instance: RoundInstance, finalChoice: string | undefined): string {
  if (!instance.decision) return instance.answer;
  if (instance.branching) {
    const chosen = instance.decision.options.find(
      (o) => normalizeAnswer(o.id) === finalChoice
    );
    return chosen ? `${instance.answer} — you chose ${chosen.label}` : instance.answer;
  }
  const opt = instance.decision.options.find((o) => o.id === instance.answer);
  return `Impostor: ${opt?.label ?? instance.answer}`;
}
