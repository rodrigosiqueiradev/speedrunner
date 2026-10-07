import { analyzeRun, parseLss, type Run, type TimingMethod } from "@speedrunner/core";
import { useMemo, useState } from "react";
import { AdviceList } from "./components/AdviceList";
import { FilePicker } from "./components/FilePicker";
import { SavingsChart } from "./components/SavingsChart";
import { SegmentTable } from "./components/SegmentTable";
import { Summary } from "./components/Summary";

interface Loaded {
  fileName: string;
  xml: string;
}

export function App() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [timing, setTiming] = useState<TimingMethod | null>(null);
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    if (!loaded) return null;
    try {
      const run = parseLss(loaded.xml, timing ? { timingMethod: timing } : {});
      return { run, analysis: analyzeRun(run), hasGameTime: hasGameTime(loaded.xml) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [loaded, timing]);

  const load = (fileName: string, xml: string) => {
    setError(null);
    setTiming(null);
    setLoaded({ fileName, xml });
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Speedrunner</h1>
        <p className="tagline">Find where your run loses time and how fast you could realistically be.</p>
      </header>

      <FilePicker onLoad={load} onError={setError} fileName={loaded?.fileName} />

      {error && <p className="error" role="alert">{error}</p>}
      {result && "error" in result && (
        <p className="error" role="alert">
          Couldn't read that file: {result.error}
        </p>
      )}

      {result && "analysis" in result && result.analysis && (
        <main className="results">
          <div className="run-title">
            <h2>
              {result.analysis.game || "Unknown game"} <span className="muted">· {result.analysis.category}</span>
            </h2>
            {result.hasGameTime && (
              <TimingToggle value={result.run.timingMethod} onChange={setTiming} />
            )}
          </div>
          <Summary analysis={result.analysis} />
          <section>
            <h3>Where the time is</h3>
            <p className="section-note">
              Time each segment could give back compared with your PB. "Good-day save" is what a good attempt
              (your 25th percentile of recent attempts) would save; the full bar goes all the way down to your gold.
            </p>
            <SavingsChart segments={result.analysis.segments} />
          </section>
          <section>
            <h3>What to practise</h3>
            <AdviceList advice={result.analysis.advice} />
          </section>
          <section>
            <h3>All segments</h3>
            <SegmentTable segments={result.analysis.segments} />
          </section>
        </main>
      )}

      <footer className="footer muted">Your splits never leave your browser.</footer>
    </div>
  );
}

function TimingToggle({ value, onChange }: { value: Run["timingMethod"]; onChange: (t: TimingMethod) => void }) {
  return (
    <div className="toggle" role="group" aria-label="Timing method">
      {(["RealTime", "GameTime"] as const).map((m) => (
        <button key={m} aria-pressed={value === m} onClick={() => onChange(m)}>
          {m === "RealTime" ? "Real time" : "Game time"}
        </button>
      ))}
    </div>
  );
}

function hasGameTime(xml: string): boolean {
  return /<GameTime>\s*[\d-]/.test(xml);
}
