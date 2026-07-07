import { customAlphabet, nanoid } from "nanoid";
import type { Role, SessionStatus, TeamPublicStatus } from "@signal-lock/shared";
import type { RoundInstance } from "./rounds/generators.js";

const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1
const generateCode = customAlphabet(codeAlphabet, 4);

export interface Player {
  id: string;
  socketId: string;
  name: string;
  teamId: string;
  role: Role;
}

export interface Team {
  id: string;
  name: string;
  solo: boolean;
  memberIds: string[];
  score: number;
  answerHistory: string[]; // normalized correct answer per round index, filled at round end
  // per-current-round state
  currentInstance: RoundInstance | null;
  locked: boolean;
  attempts: number;
  lockedAtMs: number | null;
  draft: string;
  /** normalized id of the branch chosen in the finale, if any */
  finalChoice?: string;
}

export class Session {
  code: string;
  status: SessionStatus = "lobby";
  hostSocketId: string | null = null;
  roundIndex = -1;
  roundCount = 5;
  players = new Map<string, Player>();
  teams = new Map<string, Team>();
  roundEndsAtMs = 0;
  roundTimer: NodeJS.Timeout | null = null;
  /** which finale dilemma the whole room faces, chosen once at game start */
  finaleScenarioIndex = 0;

  constructor(code: string) {
    this.code = code;
  }

  publicTeamStatuses(): TeamPublicStatus[] {
    return [...this.teams.values()].map((t) => ({
      id: t.id,
      name: t.name,
      solo: t.solo,
      locked: t.locked,
      attempts: t.attempts,
      lockedAtMs: t.lockedAtMs,
      score: t.score,
    }));
  }

  addPlayer(socketId: string, name: string): Player {
    const player: Player = {
      id: nanoid(10),
      socketId,
      name,
      teamId: "",
      role: "solo",
    };
    this.players.set(player.id, player);
    return player;
  }

  findPlayerBySocket(socketId: string): Player | undefined {
    return [...this.players.values()].find((p) => p.socketId === socketId);
  }

  createOrJoinTeam(player: Player, teamName: string): Team {
    let team = [...this.teams.values()].find(
      (t) => t.name.toLowerCase() === teamName.trim().toLowerCase()
    );
    if (!team) {
      team = {
        id: nanoid(8),
        name: teamName.trim(),
        solo: false,
        memberIds: [],
        score: 0,
        answerHistory: [],
        currentInstance: null,
        locked: false,
        attempts: 0,
        lockedAtMs: null,
        draft: "",
      };
      this.teams.set(team.id, team);
    }

    // Remove player from whatever team they were on before (if any)
    const previousTeam = this.teams.get(player.teamId);
    if (previousTeam && previousTeam.id !== team.id) {
      previousTeam.memberIds = previousTeam.memberIds.filter((id) => id !== player.id);
      this.recomputeRoles(previousTeam);
      if (previousTeam.memberIds.length === 0) this.teams.delete(previousTeam.id);
    }

    if (!team.memberIds.includes(player.id)) team.memberIds.push(player.id);
    player.teamId = team.id;
    this.recomputeRoles(team);
    return team;
  }

  /** First member is always Operator; everyone else is Cryptographer. Lone member is Solo. */
  private recomputeRoles(team: Team): void {
    team.solo = team.memberIds.length <= 1;
    team.memberIds.forEach((id, i) => {
      const p = this.players.get(id);
      if (!p) return;
      p.role = team.solo ? "solo" : i === 0 ? "operator" : "cryptographer";
    });
  }

  teamOf(player: Player): Team | undefined {
    return this.teams.get(player.teamId);
  }
}

export class SessionManager {
  private sessions = new Map<string, Session>();

  create(): Session {
    let code = generateCode();
    while (this.sessions.has(code)) code = generateCode();
    const session = new Session(code);
    this.sessions.set(code, session);
    return session;
  }

  get(code: string): Session | undefined {
    return this.sessions.get(code.toUpperCase());
  }
}

export const sessionManager = new SessionManager();
