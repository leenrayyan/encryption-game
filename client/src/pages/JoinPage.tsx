import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import RoundRenderer from "../components/RoundRenderer";
import AnswerBox from "../components/AnswerBox";
import Timer from "../components/Timer";
import Scoreboard from "../components/Scoreboard";
import DecodedLog from "../components/DecodedLog";
import {
  joinSession,
  sessionExists,
  submitAnswer,
  subscribePlayer,
  updateDraft,
  type PlayerView,
} from "../game/player";

type Step = "code" | "team" | "waiting";

const empty: PlayerView = {
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

export default function JoinPage() {
  const [params] = useSearchParams();

  const [step, setStep] = useState<Step>("code");
  const [code, setCode] = useState((params.get("code") ?? "").toUpperCase());
  const [name, setName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [playerId, setPlayerId] = useState<string | null>(null);
  const [view, setView] = useState<PlayerView>(empty);

  useEffect(() => {
    if (!playerId || !code) return;
    const unsub = subscribePlayer(code, playerId, setView);
    return unsub;
  }, [playerId, code]);

  async function goToTeam() {
    setError("");
    if (!code.trim() || !name.trim()) return;
    setBusy(true);
    try {
      const exists = await sessionExists(code.trim().toUpperCase());
      if (!exists) {
        setError("No session with that code.");
        return;
      }
      setCode(code.trim().toUpperCase());
      setStep("team");
    } finally {
      setBusy(false);
    }
  }

  async function joinTeam() {
    setError("");
    if (!teamName.trim()) return;
    setBusy(true);
    try {
      const id = await joinSession(code, name.trim(), teamName.trim());
      setPlayerId(id);
      setStep("waiting");
    } finally {
      setBusy(false);
    }
  }

  if (step === "code") {
    return (
      <div className="container center" style={{ minHeight: "100vh", flexDirection: "column", gap: "1rem" }}>
        <h1 className="accent">Join First Contact</h1>
        <input placeholder="SESSION CODE" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        {error && <p className="warn">{error}</p>}
        <button className="primary" disabled={busy} onClick={goToTeam}>Join</button>
      </div>
    );
  }

  if (step === "team") {
    return (
      <div className="container center" style={{ minHeight: "100vh", flexDirection: "column", gap: "1rem" }}>
        <h2 className="accent">Choose Your Ground Station</h2>
        <p className="dim">Enter the same team name as your teammates to join them. First one in becomes Operator, the next Cryptographer. Alone? You'll fly Solo.</p>
        <input placeholder="Team name" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
        {error && <p className="warn">{error}</p>}
        <button className="primary" disabled={busy} onClick={joinTeam}>Join Team</button>
      </div>
    );
  }

  const status = view.meta?.status ?? "lobby";
  const roundCount = view.meta?.roundCount ?? 5;
  const myTeam = view.teams.find((t) => t.id === view.teamId);
  const role = view.role;

  return (
    <div className="container stack" style={{ paddingTop: "1.5rem" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 className="accent">{teamName}</h2>
        {role && <span className={`role-badge ${role}`}>{role.toUpperCase()}</span>}
      </div>

      {status === "lobby" && (
        <div className="panel center" style={{ minHeight: 200 }}>
          <p className="dim">Waiting for the mission to begin...</p>
        </div>
      )}

      {status === "in_round" && view.meta && (view.operator || view.crypto) && (
        <>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>Round {(view.meta.roundIndex ?? 0) + 1}/{roundCount}: {view.meta.title}</span>
            {view.meta.roundEndsAtMs && <Timer endsAtMs={view.meta.roundEndsAtMs} />}
          </div>
          <p className="dim">{view.meta.storyBeat}</p>
          <RoundRenderer operator={view.operator} crypto={view.crypto} isSolo={role === "solo"} />
          <AnswerBox
            key={view.meta.roundIndex}
            locked={!!myTeam?.locked}
            decision={view.decision}
            draft={view.draft}
            feedback={view.feedback}
            chosenId={view.choice?.id ?? null}
            onDraft={(v) => view.teamId && updateDraft(code, view.teamId, v)}
            onSubmit={(a) => view.teamId && submitAnswer(code, view.teamId, a)}
          />
          <DecodedLog log={view.log} />
        </>
      )}

      {status === "round_result" && (
        <div className="panel stack">
          <h3>Transmission Closed</h3>
          {view.correctAnswer && (
            <p>Correct decode: <span className="accent">{view.correctAnswer}</span></p>
          )}
          {view.meta?.nextStartsAtMs && (
            <div className="row" style={{ alignItems: "center", gap: "0.6rem" }}>
              <span className="dim">Next transmission in</span>
              <Timer endsAtMs={view.meta.nextStartsAtMs} />
            </div>
          )}
          <DecodedLog log={view.log} />
        </div>
      )}

      {status === "finished" && (
        <div className="panel stack">
          <h3 className="accent">Contact Established</h3>
          <Scoreboard teams={view.teams} />
        </div>
      )}
    </div>
  );
}
