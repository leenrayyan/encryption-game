// Player-side (phone) and read-only Screen helpers over Firebase RTDB.
// These never touch answers — they read published game state and push
// submissions to the brain.
import {
  ref,
  set,
  get,
  push,
  onValue,
  serverTimestamp,
} from "firebase/database";
import type {
  CryptoPayload,
  Decision,
  EndingSummary,
  LogEntry,
  OperatorPayload,
  Role,
  SessionStatus,
  TeamPublicStatus,
} from "@signal-lock/shared";
import { db } from "../firebase";

function base(code: string, sub: string) {
  return ref(db, `sessions/${code}/${sub}`);
}

export async function sessionExists(code: string): Promise<boolean> {
  const snap = await get(base(code, "meta"));
  return snap.exists();
}

/** A phone joins: writes itself under players/, returns its playerId. */
export async function joinSession(
  code: string,
  name: string,
  teamName: string
): Promise<string> {
  const playerRef = push(base(code, "players"));
  await set(playerRef, { name, teamName, joinedAt: serverTimestamp() });
  return playerRef.key!;
}

export function submitAnswer(code: string, teamId: string, answer: string): void {
  set(push(base(code, "submissions")), { teamId, answer, at: serverTimestamp() });
}

export function updateDraft(code: string, teamId: string, draft: string): void {
  set(base(code, `drafts/${teamId}`), draft);
}

interface MetaShape {
  status: SessionStatus;
  roundIndex: number;
  roundCount: number;
  title?: string;
  storyBeat?: string;
  timeLimitSec?: number;
  roundEndsAtMs?: number;
  nextStartsAtMs?: number | null;
}

function teamsToArray(val: Record<string, TeamPublicStatus> | null): TeamPublicStatus[] {
  return val ? Object.values(val) : [];
}

export interface ScreenView {
  meta: MetaShape | null;
  teams: TeamPublicStatus[];
  ending: EndingSummary | null;
}

/** Screen/display subscription (read-only view of meta + scoreboard + ending). */
export function subscribeScreen(code: string, cb: (v: ScreenView) => void): () => void {
  const view: ScreenView = { meta: null, teams: [], ending: null };
  const emit = () => cb({ ...view });
  const unsubs = [
    onValue(base(code, "meta"), (s) => {
      view.meta = s.val();
      emit();
    }),
    onValue(base(code, "teams"), (s) => {
      view.teams = teamsToArray(s.val());
      emit();
    }),
    onValue(base(code, "ending"), (s) => {
      view.ending = s.val();
      emit();
    }),
  ];
  return () => unsubs.forEach((u) => u());
}

export interface PlayerView {
  meta: MetaShape | null;
  role: Role | null;
  teamId: string | null;
  operator: OperatorPayload | null;
  crypto: CryptoPayload | null;
  decision: Decision | null;
  correctAnswer: string | null;
  teams: TeamPublicStatus[];
  log: LogEntry[];
  draft: string;
  feedback: { result: "locked" | "rejected"; at: number } | null;
  choice: { id: string } | null;
  ending: EndingSummary | null;
}

/** Full phone subscription. Attaches team-scoped listeners once a role is assigned. */
export function subscribePlayer(
  code: string,
  playerId: string,
  cb: (v: PlayerView) => void
): () => void {
  const view: PlayerView = {
    meta: null,
    role: null,
    teamId: null,
    operator: null,
    crypto: null,
    decision: null,
    correctAnswer: null,
    teams: [],
    log: [],
    draft: "",
    feedback: null,
    choice: null,
    ending: null,
  };
  const emit = () => cb({ ...view });
  const unsubs: (() => void)[] = [];
  let teamScoped = false;

  unsubs.push(
    onValue(base(code, "meta"), (s) => {
      view.meta = s.val();
      emit();
    }),
    onValue(base(code, "teams"), (s) => {
      view.teams = teamsToArray(s.val());
      emit();
    }),
    onValue(base(code, "ending"), (s) => {
      view.ending = s.val();
      emit();
    }),
    onValue(base(code, `assignments/${playerId}`), (s) => {
      const a = s.val() as { teamId: string; role: Role } | null;
      if (!a) return;
      view.role = a.role;
      view.teamId = a.teamId;
      emit();
      if (!teamScoped) {
        teamScoped = true;
        attachTeamListeners(code, a.teamId, view, emit, unsubs);
      }
    })
  );

  return () => unsubs.forEach((u) => u());
}

function attachTeamListeners(
  code: string,
  teamId: string,
  view: PlayerView,
  emit: () => void,
  unsubs: (() => void)[]
) {
  unsubs.push(
    onValue(base(code, `payloads/${teamId}`), (s) => {
      const p = s.val() as {
        operator: OperatorPayload | null;
        crypto: CryptoPayload | null;
        decision: Decision | null;
        correctAnswer: string | null;
      } | null;
      view.operator = p?.operator ?? null;
      view.crypto = p?.crypto ?? null;
      view.decision = p?.decision ?? null;
      view.correctAnswer = p?.correctAnswer ?? null;
      emit();
    }),
    onValue(base(code, `log/${teamId}`), (s) => {
      view.log = (s.val() as LogEntry[] | null) ?? [];
      emit();
    }),
    onValue(base(code, `feedback/${teamId}`), (s) => {
      view.feedback = s.val();
      emit();
    }),
    onValue(base(code, `choice/${teamId}`), (s) => {
      view.choice = s.val();
      emit();
    }),
    onValue(base(code, `drafts/${teamId}`), (s) => {
      view.draft = (s.val() as string | null) ?? "";
      emit();
    })
  );
}
