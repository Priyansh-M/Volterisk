import { writeFileSync } from "node:fs";

const N = 15;
const END = 14;

function one() {
  for (let t = 0; t < 20000; t++) {
    const seen = new Set(["0,0"]);
    const path = [[0, 0]];
    let r = 0;
    let c = 0;
    while (path.length < 90) {
      if (r === END && c === END) return path;
      const opts = [];
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= N || nc >= N) continue;
        if (seen.has(`${nr},${nc}`)) continue;
        opts.push([nr, nc]);
      }
      if (!opts.length) break;
      const open = opts.filter(([nr, nc]) => {
        for (let i = 0; i < path.length - 1; i++) {
          const [pr, pc] = path[i];
          if (Math.abs(pr - nr) + Math.abs(pc - nc) === 1) return false;
        }
        return true;
      });
      if (!open.length) break;
      open.sort(
        (a, b) =>
          Math.abs(END - a[0]) + Math.abs(END - a[1]) - (Math.abs(END - b[0]) + Math.abs(END - b[1])),
      );
      const choice =
        Math.random() < 0.4
          ? open[Math.floor(Math.random() * open.length)]
          : open[Math.floor(Math.random() * Math.min(2, open.length))];
      path.push(choice);
      seen.add(`${choice[0]},${choice[1]}`);
      r = choice[0];
      c = choice[1];
    }
  }
  throw new Error("failed to build a path");
}

const paths = [];
const keys = new Set();
while (paths.length < 100) {
  const p = one();
  const k = p.map((x) => x[0] * 15 + x[1]).join(".");
  if (keys.has(k)) continue;
  keys.add(k);
  paths.push(p);
}

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Rob the Vault</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: #12100e;
      color: #e6e0d6;
      font-family: "Segoe UI", sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px 12px 40px;
    }
    h1 { margin: 0 0 6px; font-size: 22px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 650; }
    p.hint { margin: 0 0 16px; color: #9a9286; font-size: 14px; text-align: center; max-width: 520px; }
    .board {
      display: grid;
      grid-template-columns: repeat(15, 1fr);
      gap: 3px;
      width: min(92vw, 640px);
      aspect-ratio: 1;
      background: #0c0b09;
      padding: 8px;
      border: 1px solid #2a261f;
    }
    button.cell {
      appearance: none;
      border: 1px solid #2c2822;
      background: #1c1916;
      padding: 0;
      cursor: pointer;
      position: relative;
    }
    button.cell:disabled { cursor: default; }
    button.cell.on { background: #2f8f45; border-color: #3dae58; }
    button.cell.start { outline: 1px solid #c6a15a; outline-offset: -2px; }
    button.cell.end { outline: 1px solid #d7d2c8; outline-offset: -2px; }
    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(8, 7, 6, 0.78);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .card {
      display: flex;
      align-items: center;
      gap: 16px;
      background: #1a1714;
      border: 1px solid #3a342c;
      padding: 22px 22px;
      max-width: 420px;
      width: 100%;
    }
    .card h2 { margin: 0 0 8px; font-size: 20px; }
    .card p { margin: 0; color: #b7afa3; font-size: 14px; line-height: 1.45; }
    .card button {
      margin-top: 14px;
      background: #c6a15a;
      color: #1a140c;
      border: 0;
      padding: 8px 14px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      cursor: pointer;
    }
    .hidden { display: none; }
  </style>
</head>
<body>
  <h1>Rob the Vault</h1>
  <p class="hint">Walk the leaked route, one step at a time to reach the prize.</p>
  <div class="board" id="board"></div>
  <div class="overlay hidden" id="caught">
    <div class="card">
      <svg id="cop" width="72" height="84" viewBox="0 0 72 84" aria-hidden="true">
        <ellipse cx="36" cy="28" rx="16" ry="15" fill="#f3e6d0"/>
        <path d="M20 22c2-12 30-12 32 0v6H20z" fill="#1d3557"/>
        <rect x="22" y="16" width="28" height="6" rx="1" fill="#1d3557"/>
        <circle cx="30" cy="28" r="2" fill="#1a140c"/>
        <circle cx="42" cy="28" r="2" fill="#1a140c"/>
        <path d="M32 34c2 2 6 2 8 0" stroke="#1a140c" stroke-width="1.4" fill="none"/>
        <path d="M16 46h40l-4 28H20z" fill="#1d3557"/>
        <rect x="30" y="50" width="12" height="16" rx="1" fill="#c6a15a"/>
        <circle cx="36" cy="58" r="2" fill="#1a140c"/>
        <rect x="12" y="48" width="8" height="18" rx="3" fill="#24507a"/>
        <rect x="52" y="48" width="8" height="18" rx="3" fill="#24507a"/>
      </svg>
      <div>
        <h2 id="fail-title">The police caught you</h2>
        <p id="fail-body">That tile was off the route.</p>
        <button type="button" id="again">Another route</button>
      </div>
    </div>
  </div>
  <script>
    const PATHS = ${JSON.stringify(paths)};
    const board = document.getElementById("board");
    const caught = document.getElementById("caught");
    const failTitle = document.getElementById("fail-title");
    const failBody = document.getElementById("fail-body");
    const cop = document.getElementById("cop");
    let path = [];
    let step = 0;
    let locked = true;

    function cellAt(r, c) {
      return board.querySelector('[data-k="' + r + "," + c + '"]');
    }

    function paintPath(on) {
      for (const [r, c] of path) {
        const el = cellAt(r, c);
        el.classList.toggle("on", on);
      }
    }

    function deal() {
      caught.classList.add("hidden");
      path = PATHS[Math.floor(Math.random() * PATHS.length)];
      step = 0;
      locked = true;
      for (const btn of board.children) {
        btn.classList.remove("on", "start", "end");
        btn.disabled = true;
      }
      cellAt(0, 0).classList.add("start");
      cellAt(14, 14).classList.add("end");
      paintPath(true);
      window.setTimeout(() => {
        paintPath(false);
        cellAt(0, 0).classList.add("on", "start");
        cellAt(14, 14).classList.add("end");
        step = 1;
        locked = false;
        for (const btn of board.children) btn.disabled = false;
      }, 2000);
    }

    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cell";
        btn.dataset.k = r + "," + c;
        btn.addEventListener("click", () => {
          if (locked) return;
          const [cr, cc] = path[step - 1];
          const adjacent = Math.abs(cr - r) + Math.abs(cc - c) === 1;
          const [nr, nc] = path[step];
          if (adjacent && r === nr && c === nc) {
            btn.classList.add("on");
            step += 1;
            if (step >= path.length) {
              locked = true;
              for (const b of board.children) b.disabled = true;
            }
            return;
          }
          locked = true;
          for (const b of board.children) b.disabled = true;
          if (!adjacent) {
            cop.classList.add("hidden");
            failTitle.textContent = "Disqualified";
            failBody.textContent = "You can only walk one tile at a time.";
          } else {
            cop.classList.remove("hidden");
            failTitle.textContent = "The police caught you";
            failBody.textContent = "That tile was off the route.";
          }
          caught.classList.remove("hidden");
        });
        board.appendChild(btn);
      }
    }

    document.getElementById("again").addEventListener("click", deal);
    deal();
  </script>
</body>
</html>
`;

writeFileSync(new URL("./index.html", import.meta.url), html);
console.log("wrote", paths.length);
