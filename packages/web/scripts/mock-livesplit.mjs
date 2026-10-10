// A pretend LiveSplit server for trying the live stats page without LiveSplit (which runs on Windows).
// It answers the same WebSocket commands as LiveSplit's built-in server, replaying one attempt from a
// split file in real time or faster, then starts it again.
//
//   node packages/web/scripts/mock-livesplit.mjs <splits.lss> [attempt id] [speed]
//
// The attempt defaults to the latest one that finished; speed 30 plays it 30 times faster.
import { readFileSync } from "node:fs";
import { WebSocketServer } from "ws";

const [file, attemptArg, speedArg = "1"] = process.argv.slice(2);
if (!file) {
  console.error("Usage: node mock-livesplit.mjs <splits.lss> [attempt id] [speed]");
  process.exit(1);
}
const xml = readFileSync(file, "utf8");
const toMs = (s) => {
  const m = /(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(s ?? "");
  return m ? ((+m[1] * 60 + +m[2]) * 60 + +m[3]) * 1000 : null;
};
const segments = [...xml.matchAll(/<Segment>([\s\S]*?)<\/Segment>/g)].map(([, body]) => ({
  name: /<Name>([\s\S]*?)<\/Name>/.exec(body)[1],
  history: new Map(
    [...body.matchAll(/<Time id="(-?\d+)">([\s\S]*?)<\/Time>/g)].map(([, id, t]) => [id, toMs(/<RealTime>(.*?)<\/RealTime>/.exec(t)?.[1])]),
  ),
}));
const last = segments.at(-1);
const attempt = attemptArg || [...last.history.keys()].filter((id) => +id > 0 && last.history.get(id) != null).at(-1);
const splitAt = [];
let acc = 0;
for (const s of segments) {
  if (!s.history.has(attempt)) break;
  acc += s.history.get(attempt) ?? 0;
  splitAt.push(acc);
}
const speed = Number(speedArg);
const holdMs = 5000;
let started = Date.now();

const fmt = (ms) => {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = ((ms % 60_000) / 1000).toFixed(7).padStart(10, "0");
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${s}`;
};
const timer = () => {
  const length = splitAt.at(-1) ?? 0;
  let t = (Date.now() - started) * speed;
  if (t > length + holdMs * speed) {
    started = Date.now();
    t = 0;
  }
  let index = 0;
  while (index < splitAt.length && splitAt[index] <= t) index++;
  const finished = index === segments.length;
  const reset = !finished && index === splitAt.length && t >= length;
  if (reset) return { phase: "NotRunning", index: -1, time: 0 };
  return { phase: finished ? "Ended" : "Running", index, time: finished ? length : t };
};

const server = new WebSocketServer({ port: 16834, path: "/livesplit" });
server.on("connection", (ws) =>
  ws.on("message", (raw) => {
    const t = timer();
    const answers = {
      getcurrenttimerphase: t.phase,
      getsplitindex: String(t.index),
      getcurrenttime: fmt(t.time),
      getlastsplittime: t.index > 0 ? fmt(splitAt[t.index - 1]) : "-",
      getcurrentsplitname: t.index >= 0 && t.index < segments.length ? segments[t.index].name : "-",
      // Older LiveSplit servers don't know this command and never answer it: NO_SPLITS_PATH=1 acts like one.
      ...(process.env.NO_SPLITS_PATH ? {} : { getsplitspath: file }),
    };
    const answer = answers[String(raw).trim()];
    if (answer != null) ws.send(answer);
  }),
);
console.log(`Pretend LiveSplit at ws://localhost:16834/livesplit: attempt ${attempt}, ${splitAt.length} of ${segments.length} splits, ${speed}x.`);
