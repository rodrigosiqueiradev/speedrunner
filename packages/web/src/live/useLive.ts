import {
  EMPTY_SESSION,
  IDLE_SNAPSHOT,
  liveContext,
  liveStats,
  parseLss,
  pbOdds,
  trackSession,
  type LiveContext,
  type LiveSession,
  type LiveStats,
  type TimerSnapshot,
} from "@speedrunner/core";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LiveConfig } from "./config";
import { connectLiveSplit, startDemo, type FeedStatus } from "./feeds";

export interface LiveView {
  ctx: LiveContext | null;
  error: boolean;
  stats: LiveStats | null;
  session: LiveSession;
  status: FeedStatus | null;
}

/** Reads the split file once, then follows LiveSplit or the demo feed and works out the live stats. */
export function useLive(xml: string | null, config: Pick<LiveConfig, "source" | "url" | "speed">): LiveView {
  const parsed = useMemo(() => {
    if (!xml) return null;
    try {
      const run = parseLss(xml);
      return { ctx: liveContext(run, pbOdds(run)) };
    } catch {
      return { error: true as const };
    }
  }, [xml]);
  const ctx: LiveContext | null = (parsed && "ctx" in parsed ? parsed.ctx : null) ?? null;

  const [snap, setSnap] = useState<TimerSnapshot>(IDLE_SNAPSHOT);
  const [status, setStatus] = useState<FeedStatus | null>(null);
  const [session, setSession] = useState<LiveSession>(EMPTY_SESSION);
  const last = useRef<TimerSnapshot>(IDLE_SNAPSHOT);

  useEffect(() => {
    if (!ctx) return;
    last.current = IDLE_SNAPSHOT;
    setSnap(IDLE_SNAPSHOT);
    setSession(EMPTY_SESSION);
    const onUpdate = (next: TimerSnapshot, st: FeedStatus) => {
      const prev = last.current;
      last.current = next;
      if (prev !== next) setSession((s) => trackSession(s, prev, next, ctx.personalBest));
      setSnap(next);
      setStatus(st);
    };
    const feed =
      config.source === "demo"
        ? startDemo(ctx, config.speed, onUpdate)
        : connectLiveSplit(config.url, ctx.run.segments.map((s) => s.name), onUpdate);
    return () => feed.stop();
  }, [ctx, config.source, config.url, config.speed]);

  const stats = useMemo(() => (ctx ? liveStats(ctx, snap) : null), [ctx, snap]);
  return { ctx, error: !!parsed && !ctx, stats, session, status };
}
