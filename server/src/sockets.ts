import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@signal-lock/shared";
import { sessionManager, type Session } from "./session.js";
import { GameEngine } from "./engine.js";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const engines = new Map<string, GameEngine>();

function engineFor(io: IO, session: Session): GameEngine {
  let engine = engines.get(session.code);
  if (!engine) {
    engine = new GameEngine(io, session);
    engines.set(session.code, engine);
  }
  return engine;
}

function sessionRoom(code: string): string {
  return `session:${code}`;
}

export function registerSocketHandlers(io: IO): void {
  io.on("connection", (socket: IOSocket) => {
    let currentSession: Session | null = null;

    socket.on("session:create", (cb) => {
      const session = sessionManager.create();
      session.hostSocketId = socket.id;
      currentSession = session;
      socket.join(sessionRoom(session.code));
      cb({ code: session.code });
      engineFor(io, session).broadcastSessionState();
    });

    socket.on("spectator:join", ({ code }, cb) => {
      const session = sessionManager.get(code);
      if (!session) return cb({ ok: false, error: "Session not found" });
      currentSession = session;
      socket.join(sessionRoom(session.code));
      cb({ ok: true });
      engineFor(io, session).broadcastSessionState();
    });

    socket.on("session:join", ({ code, name }, cb) => {
      const session = sessionManager.get(code);
      if (!session) return cb({ ok: false, error: "Session not found" });
      if (!name.trim()) return cb({ ok: false, error: "Name required" });
      currentSession = session;
      const player = session.addPlayer(socket.id, name.trim().slice(0, 24));
      socket.join(sessionRoom(session.code));
      cb({ ok: true, playerId: player.id });
      engineFor(io, session).broadcastSessionState();
    });

    socket.on("team:join", ({ teamName }, cb) => {
      if (!currentSession) return cb({ ok: false, error: "Join a session first" });
      if (!teamName.trim()) return cb({ ok: false, error: "Team name required" });
      const player = currentSession.findPlayerBySocket(socket.id);
      if (!player) return cb({ ok: false, error: "Player not found" });
      const team = currentSession.createOrJoinTeam(player, teamName.trim().slice(0, 24));
      socket.join(`session:${currentSession.code}:team:${team.id}`);
      cb({ ok: true });
      engineFor(io, currentSession).broadcastSessionState();
    });

    socket.on("answer:update", ({ draft }) => {
      if (!currentSession) return;
      const player = currentSession.findPlayerBySocket(socket.id);
      const team = player && currentSession.teamOf(player);
      if (!team) return;
      engineFor(io, currentSession).updateDraft(team, draft);
    });

    socket.on("answer:submit", ({ answer }) => {
      if (!currentSession) return;
      const player = currentSession.findPlayerBySocket(socket.id);
      const team = player && currentSession.teamOf(player);
      if (!team) return;
      engineFor(io, currentSession).submitAnswer(team, socket.id, answer);
    });

    socket.on("host:startGame", () => {
      if (!currentSession || currentSession.hostSocketId !== socket.id) return;
      engineFor(io, currentSession).startGame();
    });

    socket.on("host:nextRound", () => {
      if (!currentSession || currentSession.hostSocketId !== socket.id) return;
      engineFor(io, currentSession).nextRound();
    });

    socket.on("host:endGame", () => {
      if (!currentSession || currentSession.hostSocketId !== socket.id) return;
      engineFor(io, currentSession).endGame();
    });

    socket.on("disconnect", () => {
      // Players are kept in session state so reconnect-by-rejoin (same name/team)
      // is possible during the ~20 min live event; no active cleanup needed here.
    });
  });
}
