"use client";
import { useEffect, useRef, useState } from "react";
export function TrialTimer({
  expiresAt,
  onExpire,
  trial = true,
}: {
  expiresAt: string;
  onExpire: () => Promise<void>;
  trial?: boolean;
}) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000)),
  );
  const stop = useRef(onExpire);
  stop.current = onExpire;
  useEffect(() => {
    let ended = false;
    const update = () => {
      const seconds = Math.max(
        0,
        Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000),
      );
      setRemaining(seconds);
      if (!seconds && !ended) {
        ended = true;
        void stop.current();
      }
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);
  return (
    <div className="notice" role="status">
      {trial ? "Shapre demo trial" : "Live session"} · {remaining}s remaining.
      Raw camera preview stays available after the session.
    </div>
  );
}
