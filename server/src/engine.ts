import type { Server } from "socket.io";
import type {
  ClientToServerEvents,
  EndingSummary,
  LogEntry,
  ServerToClientEvents,
  TeamRoundPayload,
} from "@signal-lock/shared";
import { ROUND_META, ROUND5_SCENARIOS } from "./rounds/pools.js";
import { generateRound, normalizeAnswer } from "./rounds/generators.js";
import type { Session, Team } from "./session.js";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;

const MIN_SCORE = 100;
const BASE_SCORE = 1000;
const ATTEMPT_PENALTY = 100;

export class GameEngine {
  constructor(private io: IO, private session: Session) {}

  private sessionRoom(): string {
    return `session:${this.session.code}`;
  }

  private teamRoom(teamId: string): string {
    return `session:${this.session.code}:team:${teamId}`;
  }

  private logFor(team: Team): LogEntry[] {
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

  broadcastSessionState(): void {
    this.io.to(this.sessionRoom()).emit("session:state", {
      status: this.session.status,
      code: this.session.code,
      teams: this.session.publicTeamStatuses(),
      roundIndex: this.session.roundIndex,
      roundCount: this.session.roundCount,
      ending: this.session.status === "finished" ? this.computeEnding() : null,
    });
  }

  broadcastScoreboard(): void {
    this.io.to(this.sessionRoom()).emit("scoreboard:update", {
      teams: this.session.publicTeamStatuses(),
    });
  }

  startGame(): void {
    if (this.session.status !== "lobby") return;
    if (this.session.teams.size === 0) return;
    this.session.status = "in_round";
    this.session.finaleScenarioIndex = Math.floor(Math.random() * ROUND5_SCENARIOS.length);
    this.startRound(0);
  }

  startRound(roundIndex: number): void {
    const meta = ROUND_META[roundIndex];
    if (!meta) return;
    this.session.roundIndex = roundIndex;
    this.session.status = "in_round";

    for (const team of this.session.teams.values()) {
      const instance = generateRound(roundIndex, this.session.finaleScenarioIndex);
      team.currentInstance = instance;
      team.locked = false;
      team.attempts = 0;
      team.lockedAtMs = null;
      team.draft = "";

      const log = this.logFor(team);
      for (const memberId of team.memberIds) {
        const player = this.session.players.get(memberId);
        if (!player) continue;
        const isSolo = team.solo;
        const payload: TeamRoundPayload = {
          roundIndex,
          operator: isSolo || player.role === "operator" ? instance.operator : null,
          crypto: isSolo || player.role === "cryptographer" ? instance.crypto : null,
          isSolo,
          decision: instance.decision,
          log,
        };
        this.io.to(player.socketId).emit("round:payload", payload);
      }
    }

    const endsAtMs = Date.now() + meta.timeLimitSec * 1000;
    this.session.roundEndsAtMs = endsAtMs;

    this.io.to(this.sessionRoom()).emit("round:start", {
      roundIndex,
      roundCount: this.session.roundCount,
      title: meta.title,
      storyBeat: meta.storyBeat,
      timeLimitSec: meta.timeLimitSec,
      endsAtMs,
    });

    this.broadcastSessionState();

    if (this.session.roundTimer) clearTimeout(this.session.roundTimer);
    this.session.roundTimer = setTimeout(() => this.endRound(), meta.timeLimitSec * 1000);
  }

  private allTeamsLocked(): boolean {
    if (this.session.teams.size === 0) return false;
    return [...this.session.teams.values()].every((t) => t.locked);
  }

  endRound(): void {
    if (this.session.roundTimer) {
      clearTimeout(this.session.roundTimer);
      this.session.roundTimer = null;
    }
    if (this.session.status !== "in_round") return;
    this.session.status = "round_result";
    const roundIndex = this.session.roundIndex;

    for (const team of this.session.teams.values()) {
      const instance = team.currentInstance;
      if (!instance) continue;
      // Record what this transmission actually decoded to (for the Decoded Log),
      // regardless of whether the team solved it in time.
      team.answerHistory[roundIndex] = decisionLogText(instance, team.finalChoice);
      this.io.to(this.teamRoom(team.id)).emit("round:end", {
        roundIndex,
        correctAnswer: instance.answer,
      });
      this.io.to(this.teamRoom(team.id)).emit("team:log", { log: this.logFor(team) });
    }

    this.broadcastSessionState();
  }

  nextRound(): void {
    if (this.session.status !== "round_result") return;
    const next = this.session.roundIndex + 1;
    if (next >= this.session.roundCount) {
      this.session.status = "finished";
      this.broadcastSessionState();
      return;
    }
    this.startRound(next);
  }

  endGame(): void {
    if (this.session.roundTimer) clearTimeout(this.session.roundTimer);
    this.session.status = "finished";
    this.broadcastSessionState();
  }

  updateDraft(team: Team, draft: string): void {
    team.draft = draft;
    this.io.to(this.teamRoom(team.id)).emit("team:answerUpdate", { draft });
  }

  submitAnswer(team: Team, submittedSocketId: string, answer: string): void {
    if (this.session.status !== "in_round" || team.locked) return;
    const instance = team.currentInstance;
    if (!instance) return;

    const normalized = normalizeAnswer(answer);
    if (instance.accept.includes(normalized)) {
      // Branching finale: record which choice this team made.
      if (instance.branching) team.finalChoice = normalized;

      const elapsedMs = Date.now() - (this.session.roundEndsAtMs - this.currentTimeLimitMs());
      const elapsedSec = Math.max(0, Math.floor(elapsedMs / 1000));
      const score = Math.max(
        MIN_SCORE,
        BASE_SCORE - team.attempts * ATTEMPT_PENALTY - elapsedSec * 2
      );
      team.locked = true;
      team.lockedAtMs = Date.now();
      team.score += score;
      this.io
        .to(this.teamRoom(team.id))
        .emit("team:locked", { teamId: team.id, roundIndex: this.session.roundIndex });
      this.broadcastScoreboard();
      if (this.allTeamsLocked()) this.endRound();
    } else {
      team.attempts += 1;
      this.io.to(submittedSocketId).emit("error:message", { message: "Signal rejected — try again." });
    }
  }

  /** Tally which branch the room chose in the finale, for the ending screen. */
  private computeEnding(): EndingSummary {
    const scenario = ROUND5_SCENARIOS[this.session.finaleScenarioIndex]!;
    const optionLabels: Record<string, string> = {};
    for (const o of scenario.options) optionLabels[normalizeAnswer(o.id)] = o.label;

    const counts: Record<string, number> = {};
    for (const team of this.session.teams.values()) {
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

    // Map the winning normalized id back to the scenario's ending copy.
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

  private currentTimeLimitMs(): number {
    const meta = ROUND_META[this.session.roundIndex];
    return (meta?.timeLimitSec ?? 0) * 1000;
  }
}

/** Short human-readable log entry for the Decoded Log. */
function decisionLogText(
  instance: {
    answer: string;
    branching: boolean;
    decision: import("@signal-lock/shared").Decision | null;
  },
  finalChoice: string | undefined
): string {
  if (!instance.decision) return instance.answer;
  if (instance.branching) {
    // answer holds the decoded plaintext message; append the branch they took.
    const chosen = instance.decision.options.find(
      (o) => normalizeAnswer(o.id) === finalChoice
    );
    return chosen ? `${instance.answer} — you chose ${chosen.label}` : instance.answer;
  }
  const opt = instance.decision.options.find((o) => o.id === instance.answer);
  return `Impostor: ${opt?.label ?? instance.answer}`;
}
