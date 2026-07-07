import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type {
  LogEntry,
  RoundBroadcast,
  SessionStatus,
  TeamPublicStatus,
  TeamRoundPayload,
} from "@signal-lock/shared";
import { getSocket } from "../socket";
import RoundRenderer from "../components/RoundRenderer";
import AnswerBox from "../components/AnswerBox";
import Timer from "../components/Timer";
import Scoreboard from "../components/Scoreboard";
import DecodedLog from "../components/DecodedLog";

type Step = "code" | "team" | "waiting";

export default function JoinPage() {
  const [params] = useSearchParams();
  const socket = getSocket();

  const [step, setStep] = useState<Step>("code");
  const [code, setCode] = useState(params.get("code") ?? "");
  const [name, setName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState("");

  const [status, setStatus] = useState<SessionStatus>("lobby");
  const [teams, setTeams] = useState<TeamPublicStatus[]>([]);
  const [round, setRound] = useState<RoundBroadcast | null>(null);
  const [payload, setPayload] = useState<TeamRoundPayload | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  useEffect(() => {
    socket.on("session:state", (s) => {
      setStatus(s.status);
      setTeams(s.teams);
    });
    socket.on("round:start", (r) => {
      setRound(r);
      setCorrectAnswer(null);
    });
    socket.on("round:payload", (p) => {
      setPayload(p);
      setLog(p.log);
    });
    socket.on("round:end", (e) => setCorrectAnswer(e.correctAnswer));
    socket.on("team:log", ({ log }) => setLog(log));
    socket.on("scoreboard:update", ({ teams }) => setTeams(teams));
    return () => {
      socket.off("session:state");
      socket.off("round:start");
      socket.off("round:payload");
      socket.off("round:end");
      socket.off("team:log");
      socket.off("scoreboard:update");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function joinSession() {
    if (!code.trim() || !name.trim()) return;
    socket.emit("session:join", { code: code.trim().toUpperCase(), name: name.trim() }, (res) => {
      if (res.ok) {
        setError("");
        setStep("team");
      } else {
        setError(res.error ?? "Something went wrong");
      }
    });
  }

  function joinTeam() {
    if (!teamName.trim()) return;
    socket.emit("team:join", { teamName: teamName.trim() }, (res) => {
      if (res.ok) {
        setError("");
        setStep("waiting");
      } else {
        setError(res.error ?? "Something went wrong");
      }
    });
  }

  const myTeam = teams.find((t) => t.name.toLowerCase() === teamName.trim().toLowerCase());

  if (step === "code") {
    return (
      <div className="container stack" style={{ paddingTop: "3rem" }}>
        <h1 className="accent">Join Signal Lock</h1>
        <input placeholder="SESSION CODE" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="primary" onClick={joinSession}>Join</button>
        {error && <p className="warn">{error}</p>}
      </div>
    );
  }

  if (step === "team") {
    return (
      <div className="container stack" style={{ paddingTop: "3rem" }}>
        <h1 className="accent">Choose Your Ground Station</h1>
        <p className="dim">Enter the same team name as your teammates to join them. First one in becomes Operator, others become Cryptographer. Alone? That's fine — you'll just do both jobs.</p>
        <input placeholder="Team name" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
        <button className="primary" onClick={joinTeam}>Join Team</button>
        {error && <p className="warn">{error}</p>}
      </div>
    );
  }

  const role = !payload ? null : payload.isSolo ? "solo" : payload.operator ? "operator" : "cryptographer";

  // step === "waiting" (covers lobby, in_round, round_result, finished)
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

      {status === "in_round" && round && payload && (
        <>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>Round {round.roundIndex + 1}/{round.roundCount}: {round.title}</span>
            <Timer endsAtMs={round.endsAtMs} />
          </div>
          <p className="dim">{round.storyBeat}</p>
          <RoundRenderer operator={payload.operator} crypto={payload.crypto} isSolo={payload.isSolo} />
          <AnswerBox locked={!!myTeam?.locked} decision={payload.decision} />
          <DecodedLog log={log} />
        </>
      )}

      {status === "round_result" && (
        <div className="panel stack">
          <h3>Transmission Closed</h3>
          {correctAnswer && (
            <p>
              Correct decode: <span className="accent">{correctAnswer}</span>
            </p>
          )}
          <p className="dim">Waiting for ground control to open the next channel...</p>
          <DecodedLog log={log} />
        </div>
      )}

      {status === "finished" && (
        <div className="panel stack">
          <h3 className="accent">Contact Established</h3>
          <Scoreboard teams={teams} />
        </div>
      )}
    </div>
  );
}
