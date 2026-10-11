// A pretend LiveSplit server for trying the live stats page without LiveSplit (which runs on Windows).
// It answers the same WebSocket commands as LiveSplit's built-in server, replaying one attempt from a
// split file in real time or faster, then starts it again.
//
//   node packages/web/scripts/mock-livesplit.mjs <splits.lss>[,<more.lss>] [attempt id] [speed]
//
// The attempt defaults to the latest one that finished; speed 30 plays it 30 times faster.
// With several files, `kill -USR2 <pid>` opens the next one, as opening other splits in LiveSplit does.
// NO_SPLITS_PATH=1 answers like released LiveSplit (1.8.37), which can't say which file is open;
// IDLE=1 keeps the timer stopped.
import { readFileSync } from "node:fs";
import { WebSocketServer } from "ws";

const [fileArg, attemptArg, speedArg = "1"] = process.argv.slice(2);
if (!fileArg) {
  console.error("Usage: node mock-livesplit.mjs <splits.lss>[,<more.lss>] [attempt id] [speed]");
  process.exit(1);
}
const files = fileArg.split(",");
let file;
let segments, splitAt, splitTime, attemptCount, completedCount;
const toMs = (s) => {
  const m = /(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(s ?? "");
  return m ? ((+m[1] * 60 + +m[2]) * 60 + +m[3]) * 1000 : null;
};
// LiveSplit sends names as plain text, so undo the file's XML escaping.
const XML_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unescape = (s) =>
  s.replace(/&(?:#x([\da-f]+)|#(\d+)|(\w+));/gi, (m, hex, dec, name) =>
    hex ? String.fromCodePoint(parseInt(hex, 16)) : dec ? String.fromCodePoint(+dec) : (XML_ENTITIES[name] ?? m),
  );
let attempt;
function load(next) {
  file = next;
  const xml = readFileSync(file, "utf8");
  attemptCount = /<AttemptCount>(\d+)<\/AttemptCount>/.exec(xml)?.[1] ?? "0";
  completedCount = String([...xml.matchAll(/<Attempt [^>]*>([\s\S]*?)<\/Attempt>/g)].filter(([, t]) => /<RealTime>/.test(t)).length);
  segments = [...xml.matchAll(/<Segment>([\s\S]*?)<\/Segment>/g)].map(([, body]) => ({
    name: unescape(/<Name>([\s\S]*?)<\/Name>/.exec(body)[1]),
    history: new Map(
      [...body.matchAll(/<Time id="(-?\d+)">([\s\S]*?)<\/Time>/g)].map(([, id, t]) => [id, toMs(/<RealTime>(.*?)<\/RealTime>/.exec(t)?.[1])]),
    ),
  }));
  const last = segments.at(-1);
  attempt = attemptArg || [...last.history.keys()].filter((id) => +id > 0 && last.history.get(id) != null).at(-1);
  // When each split happens, and its split time: null for a skipped split, which LiveSplit reports as "-".
  // The segment after a skip holds the time since the last split, so a skip happens with the split before it.
  splitAt = [];
  splitTime = [];
  let acc = 0;
  for (const s of segments) {
    if (!s.history.has(attempt)) break;
    const time = s.history.get(attempt);
    acc += time ?? 0;
    splitAt.push(acc);
    splitTime.push(time == null ? null : acc);
  }
  started = Date.now();
  console.log(`Pretend LiveSplit has ${file}: attempt ${attempt}, ${splitAt.length} of ${segments.length} splits.`);
}
const speed = Number(speedArg);
const holdMs = 5000;
let started = Date.now();
load(files[0]);
process.on("SIGUSR2", () => load(files[(files.indexOf(file) + 1) % files.length]));

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
  if (reset || process.env.IDLE) return { phase: "NotRunning", index: -1, time: 0 };
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
      getlastsplittime: t.index > 0 && splitTime[t.index - 1] != null ? fmt(splitTime[t.index - 1]) : "-",
      getcurrentsplitname: t.index >= 0 && t.index < segments.length ? segments[t.index].name : "-",
      getattemptcount: attemptCount,
      getcompletedcount: completedCount,
      // Older LiveSplit servers don't know these commands and never answer them: NO_SPLITS_PATH=1 acts like one.
      // The replay is in real time, the clock LiveSplit compares against by default.
      ...(process.env.NO_SPLITS_PATH ? {} : { getsplitspath: file, gettimingmethod: "RealTime" }),
    };
    const answer = answers[String(raw).trim()];
    if (answer != null) ws.send(answer);
  }),
);
console.log(`Pretend LiveSplit at ws://localhost:16834/livesplit, ${speed}x.`);
