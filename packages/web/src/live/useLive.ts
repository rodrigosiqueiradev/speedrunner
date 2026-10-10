import {
  EMPTY_SESSION,
  IDLE_SNAPSHOT,
  hasGameTime,
  liveContext,
  liveStats,
  parseLss,
  pbOdds,
  trackSession,
  type LiveContext,
  type LiveSession,
  type LiveStats,
  type TimerSnapshot,
  type TimingMethod,
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
  /** The clock the stats compare with, and whether that's what LiveSplit said it uses. */
  timing: { method: TimingMethod; fromLiveSplit: boolean; choice: boolean };
}

/**
 * Reads the split file, then follows LiveSplit or the demo feed and works out the live stats. The
 * file is read with the clock LiveSplit compares against when its server says, since that's the
 * clock its times come in; otherwise with the one chosen on the live page.
 */
export function useLive(xml: string | null, config: Pick<LiveConfig, "source" | "url" | "speed" | "timing">): LiveView {
  const [reported, setReported] = useState<TimingMethod | null>(null);
  const choice = useMemo(() => (xml ? hasGameTime(xml) : false), [xml]);
  const fromLiveSplit = config.source === "livesplit" && reported != null;
  const wanted = fromLiveSplit ? reported : config.timing;
  // A file without game times can only be read in real time.
  const method: TimingMethod = choice ? wanted : "RealTime";

  const parsed = useMemo(() => {
    if (!xml) return null;
    try {
      const run = parseLss(xml, choice ? { timingMethod: method } : {});
      return { ctx: liveContext(run, pbOdds(run)) };
    } catch {
      return { error: true as const };
    }
  }, [xml, method, choice]);
  const ctx: LiveContext | null = (parsed && "ctx" in parsed ? parsed.ctx : null) ?? null;
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const [snap, setSnap] = useState<TimerSnapshot>(IDLE_SNAPSHOT);
  const [status, setStatus] = useState<FeedStatus | null>(null);
  const [session, setSession] = useState<LiveSession>(EMPTY_SESSION);
  const last = useRef<TimerSnapshot>(IDLE_SNAPSHOT);

  // A new file or clock means new targets: count the session afresh.
  useEffect(() => setSession(EMPTY_SESSION), [ctx]);

  // LiveSplit is followed by its segment names, not the parsed file, so switching clocks
  // re-reads the file without dropping the connection.
  // LiveSplit reports names as the file has them, subsplit markers included.
  const names = ctx ? JSON.stringify(ctx.run.segments.map((s) => s.rawName)) : null;
  const demoCtx = config.source === "demo" ? ctx : null;
  useEffect(() => {
    if (names == null) return;
    last.current = IDLE_SNAPSHOT;
    setSnap(IDLE_SNAPSHOT);
    setSession(EMPTY_SESSION);
    if (config.source !== "livesplit") setReported(null);
    const onUpdate = (next: TimerSnapshot, st: FeedStatus) => {
      const prev = last.current;
      last.current = next;
      const target = ctxRef.current?.personalBest ?? null;
      if (prev !== next) setSession((s) => trackSession(s, prev, next, target));
      setSnap(next);
      setStatus(st);
      if (st.kind === "connected") setReported(st.timingMethod);
    };
    const feed =
      config.source === "demo"
        ? demoCtx && startDemo(demoCtx, config.speed, onUpdate)
        : connectLiveSplit(config.url, JSON.parse(names) as string[], onUpdate);
    return () => feed?.stop();
  }, [names, demoCtx, config.source, config.url, config.speed]);

  const stats = useMemo(() => (ctx ? liveStats(ctx, snap, session) : null), [ctx, snap, session]);
  return { ctx, error: !!parsed && !ctx, stats, session, status, timing: { method, fromLiveSplit, choice } };
}
