import type { CryptoPayload, OperatorPayload } from "@signal-lock/shared";
import { PigpenGlyph, PigpenKey } from "./Pigpen";

function OperatorView({ payload }: { payload: OperatorPayload }) {
  switch (payload.kind) {
    case "pigpen":
      return (
        <div className="panel stack">
          <h3>Incoming Signal</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "center" }}>
            {payload.words.map((word, wi) => (
              <span key={wi} style={{ display: "inline-flex", gap: "0.2rem", marginRight: "0.6rem" }}>
                {word.map((letter, li) => (
                  <PigpenGlyph key={li} letter={letter} size={38} />
                ))}
              </span>
            ))}
          </div>
        </div>
      );
    case "shift-cipher":
      return (
        <div className="panel stack">
          <h3>Incoming Signal</h3>
          <div className="cipher-text">{payload.ciphertext}</div>
        </div>
      );
    case "trap-signal":
      return (
        <div className="panel stack">
          <h3>Three Incoming Orders</h3>
          {payload.signals.map((coords, si) => (
            <div key={si}>
              <span className="dim">Signal {si + 1}:</span>{" "}
              <span className="cipher-text" style={{ fontSize: "1.1rem", letterSpacing: "0.06em" }}>
                {coords.map((c) => (c === "/" ? " / " : c + " ")).join("")}
              </span>
            </div>
          ))}
        </div>
      );
    case "keyed-layer":
      return (
        <div className="panel stack">
          <h3>Incoming Signal</h3>
          <div className="cipher-text">{payload.ciphertext}</div>
        </div>
      );
    case "playfair":
      return (
        <div className="panel stack">
          <h3>The Last Transmission</h3>
          <div className="cipher-text" style={{ fontSize: "1.5rem", wordSpacing: "0.5em" }}>
            {payload.pairs.join(" ")}
          </div>
          <p className="dim">The signal arrives in letter pairs.</p>
        </div>
      );
  }
}

function CryptoView({ payload }: { payload: CryptoPayload }) {
  switch (payload.kind) {
    case "pigpen":
      return (
        <div className="panel stack">
          <h3>Pigpen Key</h3>
          <p className="dim">{payload.note}</p>
          <PigpenKey />
        </div>
      );
    case "shift-cipher":
      return (
        <div className="panel stack">
          <h3>Frequency Dial</h3>
          <p>{payload.dialClueText}</p>
          <p className="dim">Tell your Operator the shift number so they can roll the signal back.</p>
        </div>
      );
    case "trap-signal":
      return (
        <div className="panel stack">
          <h3>Cipher Grid</h3>
          <table className="grid-table">
            <thead>
              <tr>
                <th></th>
                {payload.colLabels.map((c) => <th key={c}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {payload.grid.map((row, ri) => (
                <tr key={ri}>
                  <th>{payload.rowLabels[ri]}</th>
                  {row.map((letter, ci) => <td key={ci}>{letter}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="panel" style={{ background: "var(--bg-panel-2)", borderColor: "var(--accent-warn)" }}>
            <span className="warn">⚠ Authentication briefing: </span>
            {payload.briefing}
          </div>
        </div>
      );
    case "keyed-layer":
      return (
        <div className="panel stack">
          <h3>Console Puzzle</h3>
          <p className="cipher-text" style={{ fontSize: "1.1rem" }}>{payload.puzzleText}</p>
          <p className="dim">{payload.puzzleHint}</p>
          <p className="dim">Give your Operator the keyword. Repeat it under the ciphertext letters and subtract.</p>
        </div>
      );
    case "playfair":
      return (
        <div className="panel stack">
          <h3>Playfair Key Square</h3>
          <table className="grid-table">
            <tbody>
              {payload.square.map((row, ri) => (
                <tr key={ri}>
                  {row.map((letter, ci) => (
                    <td key={ci}>{letter === "I" ? "I/J" : letter}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="panel" style={{ background: "var(--bg-panel-2)", borderColor: "var(--accent-2)" }}>
            <span className="accent">Decode rules: </span>
            {payload.note}
          </div>
        </div>
      );
  }
}

export default function RoundRenderer({
  operator,
  crypto,
  isSolo,
}: {
  operator: OperatorPayload | null;
  crypto: CryptoPayload | null;
  isSolo: boolean;
}) {
  return (
    <div className="stack">
      {isSolo && (
        <p className="warn">You're flying solo — you can see both sides of the transmission.</p>
      )}
      {operator && <OperatorView payload={operator} />}
      {crypto && <CryptoView payload={crypto} />}
    </div>
  );
}
