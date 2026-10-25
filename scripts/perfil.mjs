// Genera las imágenes del perfil de GitHub: el banner y el panel de estadísticas,
// cada una en versión clara y oscura. La ejecuta cada día .github/workflows/perfil.yml.
//
//   node scripts/perfil.mjs          → datos reales (necesita GITHUB_TOKEN)
//   node scripts/perfil.mjs --mock   → datos de ejemplo, para probar el diseño

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const USER = process.env.PERFIL_USER || "salmeronvictor486-lang";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "assets");
const MOCK = process.argv.includes("--mock");

// ---------- Colores (los de victorsalmeron.dev + la escala azul para datos) ----------
const THEMES = {
  light: {
    bg: "#eeebe4", card: "#f6f4ef", line: "#d9d5cb", ink: "#121211", ink2: "#3d3c38",
    accent: "#2f3dff", bar: "#2a78d6", track: "#e2ded5",
    // contribuciones: 0, y de menos a más (escala azul 200 → 650)
    levels: ["#e2ded5", "#9ec5f4", "#5598e7", "#256abf", "#104281"],
  },
  dark: {
    bg: "#121211", card: "#1a1a19", line: "#2e2d2a", ink: "#eeebe4", ink2: "#b9b6ad",
    accent: "#7d85ff", bar: "#3987e5", track: "#2a2a27",
    // en oscuro, lo poco se funde con el fondo y lo mucho brilla (650 → 200)
    levels: ["#2a2a27", "#104281", "#256abf", "#5598e7", "#9ec5f4"],
  },
};

// ---------- Tipografías incrustadas (las de la web; licencia SIL OFL 1.1) ----------
const font = (file) => readFileSync(join(ROOT, "assets/fonts", file)).toString("base64");
const FONTS = `
    @font-face { font-family: "Inter Tight"; font-weight: 100 900; src: url(data:font/woff2;base64,${font("inter-tight-var.woff2")}) format("woff2"); }
    @font-face { font-family: "JetBrains Mono"; font-weight: 500; src: url(data:font/woff2;base64,${font("jetbrains-mono-500.woff2")}) format("woff2"); }
    @font-face { font-family: "Instrument Serif"; font-style: italic; src: url(data:font/woff2;base64,${font("instrument-serif-italic.woff2")}) format("woff2"); }`;

const SANS = `"Inter Tight", "Segoe UI", Helvetica, Arial, sans-serif`;
const MONO = `"JetBrains Mono", Consolas, "Courier New", monospace`;
const SERIF = `"Instrument Serif", Georgia, serif`;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (n) => new Intl.NumberFormat("es-ES").format(n);

function svg(width, height, t, body, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}">
  <title>${esc(title)}</title>
  <style>${FONTS}
    .sans { font-family: ${SANS}; }
    .mono { font-family: ${MONO}; font-weight: 500; letter-spacing: .02em; text-transform: uppercase; }
    .serif { font-family: ${SERIF}; font-style: italic; }
  </style>
  <rect width="${width}" height="${height}" rx="14" fill="${t.bg}"/>
${body}
</svg>
`;
}

// ---------- Banner ----------
function banner(t) {
  const W = 880, H = 270;
  const body = `
  <text x="40" y="44" class="mono" font-size="12" fill="${t.ink2}">Terrassa, Barcelona</text>
  <text x="${W - 40}" y="44" class="mono" font-size="12" fill="${t.accent}" text-anchor="end">victorsalmeron.dev</text>
  <text x="34" y="150" class="sans" font-size="96" font-weight="700" letter-spacing="-4.8" fill="${t.ink}">Víctor Salmerón<tspan fill="${t.accent}">.</tspan></text>
  <text x="40" y="206" class="sans" font-size="24" font-weight="450" letter-spacing="-.4" fill="${t.ink}">Técnico informático que <tspan class="serif" font-size="27">aprende haciendo</tspan>.</text>
  <text x="40" y="238" class="sans" font-size="24" font-weight="450" letter-spacing="-.4" fill="${t.ink2}">Soporte IT, sistemas y, cada día un poco más, desarrollo.</text>`;
  return svg(W, H, t, body, "Víctor Salmerón. Técnico informático que aprende haciendo. Soporte IT, sistemas y, cada día un poco más, desarrollo.");
}

// ---------- Datos ----------
async function fetchData() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("Falta GITHUB_TOKEN");
  const query = `query($login: String!) {
    user(login: $login) {
      createdAt
      followers { totalCount }
      repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
        totalCount
        nodes { stargazerCount languages(first: 10, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name } } } }
      }
      contributionsCollection {
        totalCommitContributions
        restrictedContributionsCount
        contributionCalendar { totalContributions weeks { contributionDays { date contributionCount contributionLevel } } }
      }
    }
  }`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "perfil-dashboard" },
    body: JSON.stringify({ query, variables: { login: USER } }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error("GitHub GraphQL: " + JSON.stringify(json.errors || json));
  return json.data.user;
}

function mockData() {
  const LEVELS = ["NONE", "FIRST_QUARTILE", "SECOND_QUARTILE", "THIRD_QUARTILE", "FOURTH_QUARTILE"];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const end = new Date(Date.UTC(2026, 9, 25));
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 364 - end.getUTCDay());
  const weeks = []; let total = 0;
  for (let d = new Date(start), week = []; d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const recent = (end - d) / 864e5 < 30;
    const c = rnd() < (recent ? 0.75 : 0.12) ? Math.ceil(rnd() * (recent ? 9 : 4)) : 0;
    total += c;
    week.push({ date: d.toISOString().slice(0, 10), contributionCount: c, contributionLevel: LEVELS[c === 0 ? 0 : Math.min(4, Math.ceil(c / 2.5))] });
    if (d.getUTCDay() === 6 || +d === +end) { weeks.push({ contributionDays: week }); week = []; }
  }
  const lang = (name, size) => ({ size, node: { name } });
  return {
    createdAt: "2025-09-30T10:00:00Z",
    followers: { totalCount: 3 },
    repositories: { totalCount: 4, nodes: [
      { stargazerCount: 1, languages: { edges: [lang("Rust", 420000), lang("TypeScript", 260000), lang("CSS", 60000), lang("HTML", 20000)] } },
      { stargazerCount: 1, languages: { edges: [lang("TypeScript", 180000), lang("JavaScript", 30000)] } },
      { stargazerCount: 0, languages: { edges: [lang("C", 90000), lang("JavaScript", 70000)] } },
      { stargazerCount: 0, languages: { edges: [lang("HTML", 22000), lang("CSS", 18000), lang("JavaScript", 16000)] } },
    ] },
    contributionsCollection: { totalCommitContributions: Math.round(total * 0.8), restrictedContributionsCount: 0,
      contributionCalendar: { totalContributions: total, weeks } },
  };
}

function summarize(u) {
  const cal = u.contributionsCollection.contributionCalendar;
  const days = cal.weeks.flatMap((w) => w.contributionDays);
  // Racha actual: días seguidos con contribuciones hasta hoy (si hoy aún no hay, cuenta desde ayer)
  let i = days.length - 1;
  if (i >= 0 && days[i].contributionCount === 0) i--;
  let current = 0;
  for (; i >= 0 && days[i].contributionCount > 0; i--) current++;
  let best = 0, run = 0;
  for (const d of days) { run = d.contributionCount > 0 ? run + 1 : 0; best = Math.max(best, run); }

  const sizes = new Map();
  for (const r of u.repositories.nodes) for (const e of r.languages.edges) sizes.set(e.node.name, (sizes.get(e.node.name) || 0) + e.size);
  const totalSize = [...sizes.values()].reduce((a, b) => a + b, 0) || 1;
  let langs = [...sizes.entries()].sort((a, b) => b[1] - a[1]).map(([name, size]) => ({ name, pct: (size / totalSize) * 100 }));
  if (langs.length > 5) langs = [...langs.slice(0, 4), { name: "Otros", pct: langs.slice(4).reduce((a, l) => a + l.pct, 0) }];

  return {
    weeks: cal.weeks,
    total: cal.totalContributions,
    commits: u.contributionsCollection.totalCommitContributions,
    current, best, langs,
    repos: u.repositories.totalCount,
    stars: u.repositories.nodes.reduce((a, r) => a + r.stargazerCount, 0),
    followers: u.followers.totalCount,
    since: new Date(u.createdAt).getUTCFullYear(),
  };
}

// ---------- Panel ----------
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const LEVEL_INDEX = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

function dashboard(t, s, updated) {
  const W = 880, PAD = 40;
  const parts = [];
  const text = (x, y, str, cls, size, fill, extra = "") =>
    parts.push(`  <text x="${x}" y="${y}" class="${cls}" font-size="${size}" fill="${fill}" ${extra}>${esc(str)}</text>`);

  // Cabecera
  text(PAD, 44, "Actividad en GitHub", "mono", 12, t.ink2);
  text(W - PAD, 44, `Actualizado: ${updated}`, "mono", 12, t.ink2, 'text-anchor="end"');

  // Cifras
  const tiles = [
    [fmt(s.total), "contribuciones", "último año"],
    [fmt(s.commits), "commits", "último año"],
    [fmt(s.current), s.current === 1 ? "día" : "días", "racha actual"],
    [fmt(s.best), s.best === 1 ? "día" : "días", "mejor racha"],
  ];
  const gap = 14, tw = (W - PAD * 2 - gap * 3) / 4, ty = 64, th = 104;
  tiles.forEach(([value, label, kicker], k) => {
    const x = PAD + k * (tw + gap);
    parts.push(`  <rect x="${x}" y="${ty}" width="${tw}" height="${th}" rx="10" fill="${t.card}" stroke="${t.line}"/>`);
    text(x + 18, ty + 28, kicker, "mono", 11, t.ink2);
    text(x + 18, ty + 74, value, "sans", 40, k === 0 ? t.accent : t.ink, 'font-weight="700" letter-spacing="-1.6"');
    text(x + 18, ty + 94, label, "sans", 14, t.ink2);
  });

  // Mapa de contribuciones
  const gy = 212, cell = 11, step = 14, gx = PAD + 30;
  text(PAD, gy - 14, "Contribuciones · últimos 12 meses", "mono", 11, t.ink2);
  let lastMonth = -1;
  s.weeks.forEach((w, wi) => {
    const first = w.contributionDays[0];
    const m = new Date(first.date + "T00:00:00Z").getUTCMonth();
    if (m !== lastMonth && wi < s.weeks.length - 2) {
      if (lastMonth !== -1 || new Date(first.date + "T00:00:00Z").getUTCDate() <= 7) text(gx + wi * step, gy + 14, MONTHS[m], "sans", 11, t.ink2);
      lastMonth = m;
    }
    w.contributionDays.forEach((d) => {
      const dow = new Date(d.date + "T00:00:00Z").getUTCDay();
      const fill = t.levels[LEVEL_INDEX[d.contributionLevel] ?? 0];
      parts.push(`  <rect x="${gx + wi * step}" y="${gy + 24 + dow * step}" width="${cell}" height="${cell}" rx="2" fill="${fill}"/>`);
    });
  });
  [["lun", 1], ["mié", 3], ["vie", 5]].forEach(([d, r]) => text(PAD, gy + 24 + r * step + 9.5, d, "sans", 11, t.ink2));
  const ly = gy + 24 + 7 * step + 12;
  const lx = W - PAD - 5 * step - 34;
  text(lx - 8, ly + 9.5, "menos", "sans", 11, t.ink2, 'text-anchor="end"');
  t.levels.forEach((c, k) => parts.push(`  <rect x="${lx + k * step}" y="${ly}" width="${cell}" height="${cell}" rx="2" fill="${c}"/>`));
  text(lx + 5 * step + 5, ly + 9.5, "más", "sans", 11, t.ink2);

  // Lenguajes
  const sy = ly + 52;
  text(PAD, sy, "Lenguajes · repos públicos", "mono", 11, t.ink2);
  const nameW = 110, barW = 300, rowH = 26;
  s.langs.forEach((l, k) => {
    const y = sy + 22 + k * rowH;
    text(PAD, y + 10, l.name, "sans", 14, t.ink);
    parts.push(`  <rect x="${PAD + nameW}" y="${y}" width="${barW}" height="12" rx="4" fill="${t.track}"/>`);
    parts.push(`  <rect x="${PAD + nameW}" y="${y}" width="${Math.max(4, (barW * l.pct) / 100).toFixed(1)}" height="12" rx="4" fill="${t.bar}"/>`);
    text(PAD + nameW + barW + 12, y + 10, `${l.pct < 1 ? "<1" : Math.round(l.pct)} %`, "sans", 13, t.ink2);
  });

  // En números
  const nx = 560;
  text(nx, sy, "En números", "mono", 11, t.ink2);
  [["Repos públicos", fmt(s.repos)], ["Estrellas", fmt(s.stars)], ["Seguidores", fmt(s.followers)], ["En GitHub desde", String(s.since)]].forEach(([k, v], i) => {
    const y = sy + 32 + i * rowH;
    text(nx, y, k, "sans", 14, t.ink2);
    text(W - PAD, y, v, "sans", 14, t.ink, 'text-anchor="end" font-weight="600"');
    if (i < 3) parts.push(`  <line x1="${nx}" y1="${y + 9}" x2="${W - PAD}" y2="${y + 9}" stroke="${t.line}"/>`);
  });

  const H = sy + 22 + Math.max(s.langs.length, 4) * rowH + 24;
  return svg(W, H, t, parts.join("\n"),
    `Actividad en GitHub: ${s.total} contribuciones y ${s.commits} commits en el último año; racha actual de ${s.current} ${s.current === 1 ? "día" : "días"} y mejor racha de ${s.best} ${s.best === 1 ? "día" : "días"}.`);
}

// ---------- Salida ----------
const data = summarize(MOCK ? mockData() : await fetchData());
const updated = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Madrid" }).format(new Date());
mkdirSync(OUT, { recursive: true });
for (const [name, t] of Object.entries(THEMES)) {
  writeFileSync(join(OUT, `banner-${name}.svg`), banner(t));
  writeFileSync(join(OUT, `dashboard-${name}.svg`), dashboard(t, data, updated));
}
console.log("Imágenes generadas:", { contribuciones: data.total, commits: data.commits, racha: data.current, mejor: data.best, lenguajes: data.langs.map((l) => l.name).join(", ") });
