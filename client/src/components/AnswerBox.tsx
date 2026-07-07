import { useEffect, useRef, useState } from "react";
import type { Decision } from "@signal-lock/shared";
import { getSocket } from "../socket";

export default function AnswerBox({
  locked,
  decision,
}: {
  locked: boolean;
  decision: Decision | null;
}) {
  const [draft, setDraft] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const lastSentRef = useRef("");

  useEffect(() => {
    const socket = getSocket();
    const onTeamUpdate = ({ draft: incoming }: { draft: string }) => {
      if (incoming === lastSentRef.current) return;
      setDraft(incoming);
    };
    const onError = ({ message }: { message: string }) => {
      setFlash(message);
      setTimeout(() => setFlash(null), 2000);
    };
    socket.on("team:answerUpdate", onTeamUpdate);
    socket.on("error:message", onError);
    return () => {
      socket.off("team:answerUpdate", onTeamUpdate);
      socket.off("error:message", onError);
    };
  }, []);

  function handleChange(value: string) {
    setDraft(value);
    lastSentRef.current = value;
    getSocket().emit("answer:update", { draft: value });
  }

  function submitText() {
    if (!draft.trim()) return;
    getSocket().emit("answer:submit", { answer: draft });
  }

  function submitChoice(id: string) {
    setPicked(id);
    getSocket().emit("answer:submit", { answer: id });
  }

  // ---- Decision round (round 3 impostor, round 5 branch) ----
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
              onClick={() => submitChoice(o.id)}
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

  // ---- Standard decode-and-type round ----
  return (
    <div className="panel stack">
      <h3>Decoded Message</h3>
      <input
        value={draft}
        disabled={locked}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Type your team's answer..."
        onKeyDown={(e) => e.key === "Enter" && submitText()}
      />
      {flash && <p className="warn">{flash}</p>}
      {locked ? (
        <p className="accent">SIGNAL LOCKED ✓</p>
      ) : (
        <button className="primary" onClick={submitText}>Submit</button>
      )}
    </div>
  );
}
