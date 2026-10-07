import { analyzeRun, parseLss, type Run, type TimingMethod } from "@speedrunner/core";
import { useMemo, useState } from "react";
import { AdviceList } from "./components/AdviceList";
import { FilePicker } from "./components/FilePicker";
import { HowItWorks } from "./components/HowItWorks";
import { revealExplanation } from "./components/InfoTip";
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

  const ok = result && "analysis" in result && result.analysis ? result : null;

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Speedrunner</h1>
          {!ok && <p className="tagline">See where your run loses time and how fast you could realistically be.</p>}
        </div>
        {ok && (
          <a
            className="header-link"
            href="#how-it-works"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            How it's calculated
          </a>
        )}
      </header>

      <FilePicker onLoad={load} onError={setError} fileName={loaded?.fileName} />

      {error && <p className="error" role="alert">{error}</p>}
      {result && "error" in result && (
        <p className="error" role="alert">
          Couldn't read that file: {result.error}
        </p>
      )}

      {ok && (
        <main className="results">
          <div className="run-title">
            <h2>
              {ok.analysis.game || "Unknown game"} <span className="muted">· {ok.analysis.category}</span>
            </h2>
            {ok.hasGameTime && <TimingToggle value={ok.run.timingMethod} onChange={setTiming} />}
          </div>

          <Summary analysis={ok.analysis} />

          <section className="card">
            <div className="card-head">
              <h3>What to practise first</h3>
              <p className="section-note">Segments ranked by how much time the advice is worth.</p>
            </div>
            <AdviceList advice={ok.analysis.advice} />
          </section>

          <section className="card">
            <div className="card-head">
              <h3>Where the time is</h3>
              <p className="section-note">
                How much each segment could give back against your PB. The strong part is what a good attempt would
                save; the full bar goes down to your gold.
              </p>
            </div>
            <SavingsChart segments={ok.analysis.segments} />
          </section>

          <section className="card">
            <div className="card-head">
              <h3>All segments</h3>
              <p className="section-note">
                Tap <span className="inline-q">?</span> on any column to see how it's worked out. Stats use only{" "}
                <a
                  href="#how-clean-time"
                  onClick={(e) => {
                    e.preventDefault();
                    revealExplanation("clean-time");
                  }}
                >
                  clean segment times
                </a>
                .
              </p>
            </div>
            <SegmentTable segments={ok.analysis.segments} />
          </section>

          <HowItWorks analysis={ok.analysis} />
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
