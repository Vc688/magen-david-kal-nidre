"use client";

import { useEffect, useState } from "react";

type Parts = { days: number; hours: number; minutes: number; seconds: number };

function remaining(deadlineMs: number, now: number): Parts | null {
  const diff = deadlineMs - now;
  if (diff <= 0) return null;
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Live countdown to the drawing. Renders placeholders until mounted so server
 * and client markup match, then ticks every second and fires `onExpire` once.
 */
export default function Countdown({
  deadlineIso,
  onExpire
}: {
  deadlineIso: string;
  onExpire?: () => void;
}) {
  const deadlineMs = new Date(deadlineIso).getTime();
  const [parts, setParts] = useState<Parts | null | undefined>(undefined);

  useEffect(() => {
    let expired = false;
    const tick = () => {
      const next = remaining(deadlineMs, Date.now());
      setParts(next);
      if (!next && !expired) {
        expired = true;
        onExpire?.();
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [deadlineMs, onExpire]);

  const units: [keyof Parts, string][] = [
    ["days", "Days"],
    ["hours", "Hours"],
    ["minutes", "Min"],
    ["seconds", "Sec"]
  ];

  return (
    <div className="countdown" role="timer" aria-live="off">
      {units.map(([key, label], index) => (
        <div className="countdown-unit" key={key}>
          <strong>{parts ? pad(parts[key]) : parts === null ? "00" : "--"}</strong>
          <span>{label}</span>
          {index < units.length - 1 ? <em aria-hidden="true">:</em> : null}
        </div>
      ))}
    </div>
  );
}
