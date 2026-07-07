import { useEffect, useState } from "react";
import type { RoundBroadcast, SessionStatus, TeamPublicStatus } from "@signal-lock/shared";
import { getSocket } from "../socket";
import Scoreboard from "../components/Scoreboard";
import Timer from "../components/Timer";

export default function HostPage() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<SessionStatus>("lobby");
  const [teams, setTeams] = useState<TeamPublicStatus[]>([]);
  const [roundCount, setRoundCount] = useState(5);
  const [round, setRound] = useState<RoundBroadcast | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socket.emit("session:create", ({ code }) => setCode(code));

    socket.on("session:state", (s) => {
      setStatus(s.status);
      setTeams(s.teams);
      setRoundCount(s.roundCount);
    });
    socket.on("round:start", (r) => setRound(r));
    socket.on("scoreboard:update", ({ teams }) => setTeams(teams));

    return () => {
      socket.off("session:state");
      socket.off("round:start");
      socket.off("scoreboard:update");
    };
  }, []);

  const socket = getSocket();

  return (
    <div className="container">
      <h1 className="accent">Host Controls</h1>
      {code ? (
        <>
          <p>
            Session code: <span className="accent" style={{ fontSize: "1.4rem" }}>{code}</span>
          </p>
          <div className="row">
            <a href={`/screen?code=${code}`} target="_blank" rel="noreferrer">
              <button>Open Shared Screen ↗</button>
            </a>
          </div>

          <div className="panel" style={{ marginTop: "1.5rem" }}>
            <h3>Status: {status}</h3>
            {round && status === "in_round" && (
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span>Round {round.roundIndex + 1}/{roundCount}: {round.title}</span>
                <Timer endsAtMs={round.endsAtMs} />
              </div>
            )}
          </div>

          <div className="panel" style={{ marginTop: "1.5rem" }}>
            <h3>Ground Stations ({teams.length})</h3>
            <Scoreboard teams={teams} />
          </div>

          <div className="row" style={{ marginTop: "1.5rem" }}>
            {status === "lobby" && (
              <button className="primary" disabled={teams.length === 0} onClick={() => socket.emit("host:startGame")}>
                Start Game
              </button>
            )}
            {status === "round_result" && (
              <button onClick={() => socket.emit("host:nextRound")}>
                Skip the wait →
              </button>
            )}
            {status !== "finished" && status !== "lobby" && (
              <button className="danger" onClick={() => socket.emit("host:endGame")}>End Game</button>
            )}
          </div>

          {status !== "lobby" && status !== "finished" && (
            <p className="dim" style={{ marginTop: "0.8rem" }}>
              The game runs itself — rounds advance automatically when all teams finish or time runs out. You don't need to do anything.
            </p>
          )}
        </>
      ) : (
        <p className="dim">Creating session...</p>
      )}
    </div>
  );
}
