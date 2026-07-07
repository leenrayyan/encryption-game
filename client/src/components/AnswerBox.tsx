import { useEffect, useRef, useState } from "react";
import type { Decision } from "@signal-lock/shared";

export default function AnswerBox({
  locked,
  decision,
  draft,
  feedback,
  chosenId,
  onDraft,
  onSubmit,
}: {
  locked: boolean;
  decision: Decision | null;
  draft: string;
  feedback: { result: "locked" | "rejected"; at: number } | null;
  chosenId?: string | null;
  onDraft: (value: string) => void;
  onSubmit: (answer: string) => void;
}) {
  const [local, setLocal] = useState(draft);
  const [flash, setFlash] = useState<string | null>(null);
  const [pickedLocal, setPickedLocal] = useState<string | null>(null);
  const editingRef = useRef(false);
  const picked = pickedLocal ?? chosenId ?? null;

  useEffect(() => {
    if (!editingRef.current) setLocal(draft);
  }, [draft]);

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

  const branching = !!decision?.branching;

  // Finale: after the message is decoded (locked), present the branching choice.
  if (branching && locked) {
    return (
      <div className="panel stack">
        <p className="accent">TRANSMISSION DECODED ✓</p>
        <h3>{decision!.prompt}</h3>
        <div className="row">
          {decision!.options.map((o) => (
            <button
              key={o.id}
              className={picked === o.id ? "primary" : ""}
              disabled={!!picked}
              onClick={() => {
                setPickedLocal(o.id);
                onSubmit(o.id);
              }}
              style={{ flex: 1, minWidth: 120 }}
            >
              {o.label}
            </button>
          ))}
        </div>
        {picked && <p className="dim">Reply transmitted. Awaiting the fleet…</p>}
      </div>
    );
  }

  // Decode-and-type (rounds 1–4, and the finale before it's decoded).
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
