import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import type {
  EndingSummary,
  RoundBroadcast,
  SessionStatus,
  TeamPublicStatus,
} from "@signal-lock/shared";
import { getSocket } from "../socket";
import Scoreboard from "../components/Scoreboard";
import Timer from "../components/Timer";

export default function ScreenPage() {
  const [params] = useSearchParams();
  const urlCode = params.get("code") ?? "";
  const [codeInput, setCodeInput] = useState(urlCode);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");

  const [status, setStatus] = useState<SessionStatus>("lobby");
  const [code, setCode] = useState(urlCode);
  const [teams, setTeams] = useState<TeamPublicStatus[]>([]);
  const [roundCount, setRoundCount] = useState(5);
  const [round, setRound] = useState<RoundBroadcast | null>(null);
  const [ending, setEnding] = useState<EndingSummary | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socket.on("session:state", (s) => {
      setStatus(s.status);
      setCode(s.code);
      setTeams(s.teams);
      setRoundCount(s.roundCount);
      setEnding(s.ending);
    });
    socket.on("round:start", (r) => setRound(r));
    socket.on("scoreboard:update", ({ teams }) => setTeams(teams));
    return () => {
      socket.off("session:state");
      socket.off("round:start");
      socket.off("scoreboard:update");
    };
  }, []);

  function join(codeToJoin: string) {
    getSocket().emit("spectator:join", { code: codeToJoin.toUpperCase() }, (res) => {
      if (res.ok) {
        setJoined(true);
        setError("");
      } else {
        setError(res.error ?? "Could not connect");
      }
    });
  }

  useEffect(() => {
    if (urlCode) join(urlCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!joined) {
    return (
      <div className="container center" style={{ minHeight: "100vh", flexDirection: "column", gap: "1rem" }}>
        <h2>Open Shared Screen</h2>
        <input
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
          placeholder="SESSION CODE"
          style={{ maxWidth: 240, textAlign: "center", fontSize: "1.5rem" }}
        />
        <button className="primary" onClick={() => join(codeInput)}>Connect</button>
        {error && <p className="warn">{error}</p>}
      </div>
    );
  }

  const joinUrl = `${window.location.origin}/play?code=${code}`;

  return (
    <div className="screen-bg">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 className="accent">SIGNAL LOCK</h1>
        <div className="dim">SESSION {code}</div>
      </div>

      {status === "lobby" && (
        <div className="row" style={{ alignItems: "flex-start", gap: "3rem", marginTop: "2rem" }}>
          <div className="stack center" style={{ flex: "0 0 auto" }}>
            <div className="qr-wrap">
              <QRCodeSVG value={joinUrl} size={220} />
            </div>
            <div className="mono-code">{code}</div>
            <p className="dim">Scan or go to {window.location.origin}/play</p>
          </div>
          <div className="panel" style={{ flex: 1 }}>
            <h3>Ground Stations Online ({teams.length})</h3>
            <Scoreboard teams={teams} />
          </div>
        </div>
      )}

      {status === "in_round" && round && (
        <div className="stack" style={{ marginTop: "2rem" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>Round {round.roundIndex + 1} / {round.roundCount}: {round.title}</h2>
            <Timer endsAtMs={round.endsAtMs} />
          </div>
          <p className="dim" style={{ fontSize: "1.2rem" }}>{round.storyBeat}</p>
          <div className="panel">
            <Scoreboard teams={teams} />
          </div>
        </div>
      )}

      {status === "round_result" && (
        <div className="stack" style={{ marginTop: "2rem" }}>
          <h2>Signal Stabilizing...</h2>
          <p className="dim">Ground control is preparing the next transmission.</p>
          <div className="panel">
            <Scoreboard teams={teams} />
          </div>
        </div>
      )}

      {status === "finished" && (
        <div className="stack" style={{ marginTop: "2rem" }}>
          {ending && (
            <div className="panel stack" style={{ borderColor: "var(--accent)" }}>
              <h2 className="accent">{ending.headline}</h2>
              <p style={{ fontSize: "1.2rem" }}>{ending.detail}</p>
              {Object.keys(ending.counts).length > 0 && (
                <p className="dim">
                  The room decided:{" "}
                  {Object.entries(ending.counts)
                    .map(([id, n]) => `${ending.optionLabels[id] ?? id} — ${n}`)
                    .join("   ·   ")}
                </p>
              )}
            </div>
          )}
          <h3 className="dim">Final standings</h3>
          <div className="panel">
            <Scoreboard teams={teams} />
          </div>
        </div>
      )}

      <div className="dim" style={{ marginTop: "2rem" }}>
        {roundCount} rounds total
      </div>
    </div>
  );
}
