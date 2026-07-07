import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import Scoreboard from "../components/Scoreboard";
import Timer from "../components/Timer";
import { BrainEngine, generateCode } from "../game/brain";
import { subscribeScreen, type ScreenView } from "../game/player";

// One brain per tab, kept across React StrictMode remounts.
let brainSingleton: BrainEngine | null = null;

export default function ScreenPage() {
  const [code, setCode] = useState<string>(() => brainSingleton?.code ?? "");
  const [view, setView] = useState<ScreenView>({ meta: null, teams: [], ending: null });

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (!brainSingleton) {
        const brain = new BrainEngine(generateCode());
        brainSingleton = brain;
        await brain.create();
      }
      if (cancelled) return;
      setCode(brainSingleton.code);
      const unsub = subscribeScreen(brainSingleton.code, setView);
      return unsub;
    }
    let unsub: (() => void) | undefined;
    boot().then((u) => (unsub = u));
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const status = view.meta?.status ?? "lobby";
  const roundCount = view.meta?.roundCount ?? 5;
  const joinUrl = `${window.location.origin}/play?code=${code}`;

  return (
    <div className="container center" style={{ minHeight: "100vh", flexDirection: "column", paddingTop: "2rem" }}>
      {status !== "lobby" && (
        <h1 className="accent" style={{ letterSpacing: "0.18em" }}>FIRST CONTACT</h1>
      )}

      {status === "lobby" && (
        <div className="stack center" style={{ marginTop: "1rem", textAlign: "center" }}>
          <div className="eyebrow">◦ Incoming · Unknown Origin</div>
          <h1 className="hero-title">FIRST<b>CONTACT</b></h1>
          <p className="hero-tag">Something just answered. Decode it before the signal is lost.</p>

          <div className="row center" style={{ gap: "1.5rem", margin: "1rem 0" }}>
            {code && (
              <div className="qr-wrap">
                <QRCodeSVG value={joinUrl} size={200} />
              </div>
            )}
            <div className="stack" style={{ gap: "0.3rem", textAlign: "left" }}>
              <span className="eyebrow">Join at</span>
              <b style={{ fontSize: "1.1rem" }}>{window.location.host}/play</b>
              <span className="eyebrow" style={{ marginTop: "0.6rem" }}>Station code</span>
              <span className="code-badge" style={{ textAlign: "left" }}>{code}</span>
            </div>
          </div>

          <div className="panel" style={{ minWidth: 340 }}>
            <div className="eyebrow" style={{ marginBottom: "0.6rem" }}>Ground Stations · {view.teams.length}</div>
            <Scoreboard teams={view.teams} />
          </div>
          <button
            className="primary"
            disabled={view.teams.length === 0}
            onClick={() => brainSingleton?.startGame()}
            style={{ fontSize: "1.2rem", padding: "0.8em 2.4em", marginTop: "0.5rem" }}
          >
            ▸ Begin Transmission
          </button>
          <p className="dim">Press once — the signal takes over from there.</p>
        </div>
      )}

      {status === "in_round" && view.meta && (
        <div className="stack" style={{ marginTop: "1.5rem", width: "100%", maxWidth: 900 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <h2>Round {(view.meta.roundIndex ?? 0) + 1}/{roundCount}: {view.meta.title}</h2>
            {view.meta.roundEndsAtMs && <Timer endsAtMs={view.meta.roundEndsAtMs} />}
          </div>
          <p className="dim" style={{ fontSize: "1.2rem" }}>{view.meta.storyBeat}</p>
          <div className="panel">
            <Scoreboard teams={view.teams} />
          </div>
        </div>
      )}

      {status === "round_result" && (
        <div className="stack" style={{ marginTop: "2rem", width: "100%", maxWidth: 900 }}>
          <h2>Signal Stabilizing...</h2>
          {view.meta?.nextStartsAtMs ? (
            <div className="row center" style={{ gap: "0.8rem", fontSize: "1.3rem" }}>
              <span className="dim">Next transmission in</span>
              <Timer endsAtMs={view.meta.nextStartsAtMs} />
            </div>
          ) : (
            <p className="dim">Preparing the next transmission.</p>
          )}
          <div className="panel">
            <Scoreboard teams={view.teams} />
          </div>
        </div>
      )}

      {status === "finished" && (
        <div className="stack" style={{ marginTop: "2rem", width: "100%", maxWidth: 900 }}>
          {view.ending && (
            <div className="panel stack" style={{ borderColor: "var(--accent)" }}>
              <h2 className="accent">{view.ending.headline}</h2>
              <p style={{ fontSize: "1.2rem" }}>{view.ending.detail}</p>
              {Object.keys(view.ending.counts).length > 0 && (
                <p className="dim">
                  The room decided:{" "}
                  {Object.entries(view.ending.counts)
                    .map(([id, n]) => `${view.ending!.optionLabels[id] ?? id} — ${n}`)
                    .join("   ·   ")}
                </p>
              )}
            </div>
          )}
          <h3 className="dim">Final standings</h3>
          <div className="panel">
            <Scoreboard teams={view.teams} />
          </div>
        </div>
      )}
    </div>
  );
}
