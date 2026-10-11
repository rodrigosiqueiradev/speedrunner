import {
  EMPTY_SESSION,
  analyzeRun,
  IDLE_SNAPSHOT,
  hasGameTime,
  liveContext,
  liveStats,
  markLuck,
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
import { useGoals } from "../goals";
import { useLuckMarks } from "../luckMarks";
import { categoryKey } from "../profile";
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

  const luckMarks = useLuckMarks();
  const parsed = useMemo(() => {
    if (!xml) return null;
    try {
      const plain = parseLss(xml, choice ? { timingMethod: method } : {});
      const category = categoryKey(plain);
      const run = markLuck(plain, luckMarks[category] ?? []);
      return { run, category, odds: pbOdds(run), analysis: analyzeRun(run) };
    } catch {
      return { error: true as const };
    }
  }, [xml, method, choice, luckMarks]);
  // The goal is worked into the context apart from the file, so typing one doesn't re-read the file.
  const read = parsed && !("error" in parsed) ? parsed : null;
  const goals = useGoals();
  const goal = read ? (goals[read.category] ?? null) : null;
  const ctx: LiveContext | null = useMemo(
    () => (read ? liveContext(read.run, read.odds, read.analysis, goal) : null),
    [read, goal],
  );
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const [snap, setSnap] = useState<TimerSnapshot>(IDLE_SNAPSHOT);
  const [status, setStatus] = useState<FeedStatus | null>(null);
  const [session, setSession] = useState<LiveSession>(EMPTY_SESSION);
  const last = useRef<TimerSnapshot>(IDLE_SNAPSHOT);

  // A new file or clock means new targets: count the session afresh.
  useEffect(() => setSession(EMPTY_SESSION), [parsed]);

  // LiveSplit is followed by its segment names, not the parsed file, so switching clocks
  // re-reads the file without dropping the connection.
  // LiveSplit reports names as the file has them, subsplit markers included.
  const names = ctx ? JSON.stringify(ctx.run.segments.map((s) => s.rawName)) : null;
  // The demo restarts with a new file or clock, not a new goal.
  const demoRun = config.source === "demo" ? parsed : null;
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
        ? demoRun && ctxRef.current && startDemo(ctxRef.current, config.speed, onUpdate)
        : connectLiveSplit(config.url, JSON.parse(names) as string[], onUpdate);
    return () => feed?.stop();
  }, [names, demoRun, config.source, config.url, config.speed]);

  const stats = useMemo(() => (ctx ? liveStats(ctx, snap, session) : null), [ctx, snap, session]);
  return { ctx, error: !!parsed && "error" in parsed, stats, session, status, timing: { method, fromLiveSplit, choice } };
}
