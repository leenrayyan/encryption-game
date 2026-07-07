import type { TeamPublicStatus } from "@signal-lock/shared";

export default function Scoreboard({ teams }: { teams: TeamPublicStatus[] }) {
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  return (
    <div className="stack">
      {sorted.map((t) => (
        <div className={`scoreboard-row ${t.locked ? "locked" : ""}`} key={t.id}>
          <span>{t.name}{t.solo ? " (solo)" : ""}</span>
          <span>
            {t.score} pts —{" "}
            {t.locked ? "SIGNAL LOCKED ✓" : `${t.attempts} attempt${t.attempts === 1 ? "" : "s"}`}
          </span>
        </div>
      ))}
      {teams.length === 0 && <p className="dim">No teams yet.</p>}
    </div>
  );
}
