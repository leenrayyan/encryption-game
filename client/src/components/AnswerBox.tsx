import { useEffect, useRef, useState } from "react";
import type { Decision } from "@signal-lock/shared";

export default function AnswerBox({
  locked,
  decision,
  draft,
  feedback,
  onDraft,
  onSubmit,
}: {
  locked: boolean;
  decision: Decision | null;
  draft: string;
  feedback: { result: "locked" | "rejected"; at: number } | null;
  onDraft: (value: string) => void;
  onSubmit: (answer: string) => void;
}) {
  const [local, setLocal] = useState(draft);
  const [flash, setFlash] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const editingRef = useRef(false);

  // Keep in sync with a teammate's typing unless we're actively editing.
  useEffect(() => {
    if (!editingRef.current) setLocal(draft);
  }, [draft]);

  // Show a flash when the brain rejects a submission.
  useEffect(() => {
    if (feedback?.result === "rejected") {
      setFlash("Signal rejected — try again.");
      const t = setTimeout(() => setFlash(null), 2000);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  function handleChange(value: string) {
    editingRef.current = true;
    setLocal(value);
    onDraft(value);
  }

  if (decision) {
    return (
      <div className="panel stack">
        <h3>{decision.branching ? "Your Decision" : "Flag the Impostor"}</h3>
        <p>{decision.prompt}</p>
        <div className="row">
          {decision.options.map((o) => (
            <button
              key={o.id}
              className={picked === o.id ? "primary" : ""}
              disabled={locked}
              onClick={() => {
                setPicked(o.id);
                onSubmit(o.id);
              }}
              style={{ flex: 1, minWidth: 120 }}
            >
              {o.label}
            </button>
          ))}
        </div>
        {flash && <p className="warn">{flash}</p>}
        {locked && <p className="accent">SIGNAL LOCKED ✓</p>}
      </div>
    );
  }

  return (
    <div className="panel stack">
      <h3>Decoded Message</h3>
      <input
        value={local}
        disabled={locked}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => (editingRef.current = false)}
        placeholder="Type your team's answer..."
        onKeyDown={(e) => e.key === "Enter" && local.trim() && onSubmit(local)}
      />
      {flash && <p className="warn">{flash}</p>}
      {locked ? (
        <p className="accent">SIGNAL LOCKED ✓</p>
      ) : (
        <button className="primary" onClick={() => local.trim() && onSubmit(local)}>
          Submit
        </button>
      )}
    </div>
  );
}
