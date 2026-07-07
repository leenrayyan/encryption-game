import { useEffect, useState } from "react";

export default function Timer({ endsAtMs }: { endsAtMs: number }) {
  const [remainingMs, setRemainingMs] = useState(endsAtMs - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemainingMs(endsAtMs - Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAtMs]);

  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  const low = total <= 30;

  return (
    <div className={`timer ${low ? "low" : ""}`}>
      {mm}:{ss.toString().padStart(2, "0")}
    </div>
  );
}
