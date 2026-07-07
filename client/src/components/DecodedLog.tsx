import type { LogEntry } from "@signal-lock/shared";

export default function DecodedLog({ log }: { log: LogEntry[] }) {
  if (log.length === 0) return null;
  return (
    <details className="panel" style={{ padding: "1rem" }}>
      <summary style={{ cursor: "pointer", fontFamily: "var(--font-display)" }}>
        Decoded Log ({log.length})
      </summary>
      <div className="stack" style={{ marginTop: "0.8rem", gap: "0.5rem" }}>
        {log.map((e) => (
          <div key={e.roundIndex} style={{ fontSize: "0.9rem" }}>
            <span className="dim">{e.roundIndex + 1}. {e.title}: </span>
            <span className="accent">{e.answer}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
