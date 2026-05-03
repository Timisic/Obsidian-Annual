#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const DEFAULT_EXCLUDES = [".obsidian", "assets", "Assets", "templates", "Templates", "archive", "Archive", "Attachments", "Annual Reviews"];
const DEFAULT_THRESHOLD = 50;
const BASELINE_MESSAGE = "从本次开始记录，下一次运行后将开始计算准确增长。";

main();

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const config = loadConfig(args.config);
  const vault = resolve(required(args.vault ?? config.vault, "--vault is required"));
  const period = resolvePeriod(args, config);
  const outDir = resolve(args.out ?? config.out ?? join(vault, "Annual Reviews", "Writing Growth"));
  const excludes = listValue(args.exclude ?? config.exclude, DEFAULT_EXCLUDES);
  const threshold = Number(args.threshold ?? config.writingDayThreshold ?? DEFAULT_THRESHOLD);
  const history = String(args.history ?? config.history ?? "auto");
  const snapshotFile = resolve(args.snapshotFile ?? config.snapshotFile ?? join(outDir, "writing-growth-snapshots.json"));

  mkdirSync(outDir, { recursive: true });
  const currentSnapshot = scanVaultSnapshot(vault, excludes, todayKey());
  const storedSnapshots = readSnapshotFile(snapshotFile);
  const gitSnapshots = history === "git" || history === "auto" ? readGitSnapshots(vault, excludes, period) : [];
  const snapshots = mergeSnapshots(history === "none" ? [] : [...storedSnapshots, ...gitSnapshots], currentSnapshot);
  writeSnapshotFile(snapshotFile, snapshots);

  const report = buildReport(snapshots, period, threshold);
  const prefix = period.type === "month" ? period.startDate.slice(0, 7) : period.startDate.slice(0, 4);
  const jsonPath = join(outDir, `${prefix}-writing-growth.json`);
  const markdownPath = join(outDir, `${prefix}-writing-growth.md`);
  const growthPath = join(outDir, `${prefix}-word-growth.svg`);
  const monthlyPath = join(outDir, `${prefix}-monthly-word-growth.svg`);
  const heatmapPath = join(outDir, `${prefix}-writing-heatmap.svg`);

  writeFileSync(growthPath, renderDailySvg(report.daily), "utf8");
  writeFileSync(monthlyPath, renderMonthlySvg(report.monthly), "utf8");
  writeFileSync(heatmapPath, renderHeatmapSvg(report.daily), "utf8");
  const markdown = renderMarkdown(report.summary, report.feedback, [growthPath, monthlyPath, heatmapPath].map((path) => relative(vault, path).split("/").join("/")));
  writeFileSync(markdownPath, markdown, "utf8");
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        ...report.summary,
        period,
        daily_added_words: report.daily,
        monthly_added_words: report.monthly,
        feedback: report.feedback,
        markdown_path: markdownPath,
        chart_paths: {
          word_growth: growthPath,
          monthly_word_growth: monthlyPath,
          writing_heatmap: heatmapPath,
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  process.stdout.write(`${jsonPath}\n${markdownPath}\n`);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token) continue;
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
    if (!token.startsWith("--")) continue;
    const key = token.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function printHelp() {
  process.stdout.write(`Usage: node scripts/writing-growth-report.mjs --vault <path> --year 2026 [options]

Options:
  --month YYYY-MM              Generate a monthly report instead of a yearly report.
  --start YYYY-MM-DD --end ... Generate a custom period report.
  --out <path>                 Output directory for JSON, Markdown, SVG, and snapshots.
  --snapshot-file <path>       Snapshot JSON file path.
  --history auto|git|none      Use git history when available, only current snapshot, or auto.
  --threshold <words>          Writing-day threshold. Default: 50.
  --exclude <a,b,c>            Extra/override excluded folders.
  --config <path>              JSON config file.
`);
}

function loadConfig(path) {
  if (!path) return {};
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

function required(value, message) {
  if (!value) {
    throw new Error(message);
  }
  return value;
}

function listValue(value, fallback) {
  if (!value) return fallback;
  if (Array.isArray(value)) return value;
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolvePeriod(args, config) {
  if (args.month ?? config.month) {
    const month = String(args.month ?? config.month);
    const [yearPart, monthPart] = month.split("-");
    const endDay = new Date(Number(yearPart), Number(monthPart), 0).getDate();
    return { type: "month", startDate: `${month}-01`, endDate: `${month}-${String(endDay).padStart(2, "0")}` };
  }
  if ((args.start ?? config.startDate) && (args.end ?? config.endDate)) {
    return { type: "custom", startDate: String(args.start ?? config.startDate), endDate: String(args.end ?? config.endDate) };
  }
  const year = Number(args.year ?? config.year ?? new Date().getFullYear());
  return { type: "year", startDate: `${year}-01-01`, endDate: `${year}-12-31` };
}

function scanVaultSnapshot(vault, excludes, date) {
  const files = {};
  for (const path of walkMarkdown(vault, vault, excludes)) {
    files[path] = { words: countWords(readFileSync(join(vault, path), "utf8")) };
  }
  return { date, files };
}

function walkMarkdown(root, dir, excludes) {
  const paths = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const rel = relative(root, fullPath).split("/").join("/");
    if (isExcluded(rel, excludes)) continue;
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      paths.push(...walkMarkdown(root, fullPath, excludes));
    } else if (stats.isFile() && rel.endsWith(".md")) {
      paths.push(rel);
    }
  }
  return paths.sort();
}

function isExcluded(path, excludes) {
  const normalized = path.replace(/^\/+/, "");
  return excludes.some((folder) => normalized === folder || normalized.startsWith(`${folder.replace(/^\/+|\/+$/g, "")}/`));
}

function readGitSnapshots(vault, excludes, period) {
  try {
    execFileSync("git", ["-C", vault, "rev-parse", "--show-toplevel"], { stdio: "ignore" });
  } catch {
    return [];
  }

  const log = execFileSync("git", ["-C", vault, "log", "--reverse", "--date=short", "--format=%H%x09%cs", "--", "*.md"], { encoding: "utf8" }).trim();
  if (!log) return [];
  const byDate = new Map();
  for (const line of log.split(/\r?\n/)) {
    const [hash, date] = line.split("\t");
    if (date <= period.endDate) byDate.set(date, hash);
  }
  const baseline = [...byDate.entries()].filter(([date]) => date < period.startDate).pop();
  const selected = [...byDate.entries()].filter(([date]) => date >= period.startDate && date <= period.endDate);
  if (baseline) selected.unshift(baseline);

  return selected.map(([date, hash]) => gitSnapshot(vault, excludes, date, hash));
}

function gitSnapshot(vault, excludes, date, hash) {
  const files = {};
  const names = execFileSync("git", ["-C", vault, "ls-tree", "-r", "--name-only", hash, "--", "*.md"], { encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((path) => !isExcluded(path, excludes));
  for (const path of names) {
    try {
      const content = execFileSync("git", ["-C", vault, "show", `${hash}:${path}`], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
      files[path] = { words: countWords(content) };
    } catch {
      // Ignore files that existed in ls-tree but cannot be read due to path encoding.
    }
  }
  return { date, files };
}

function readSnapshotFile(path) {
  if (!existsSync(path)) return [];
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  return Array.isArray(parsed) ? parsed : parsed.snapshots ?? [];
}

function writeSnapshotFile(path, snapshots) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ snapshots }, null, 2), "utf8");
}

function mergeSnapshots(snapshots, currentSnapshot) {
  const byDate = new Map();
  for (const snapshot of [...snapshots, currentSnapshot]) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(snapshot.date)) byDate.set(snapshot.date, normalizeSnapshot(snapshot));
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function normalizeSnapshot(snapshot) {
  return {
    date: snapshot.date,
    files: Object.fromEntries(Object.entries(snapshot.files ?? {}).map(([path, value]) => [path, { words: typeof value === "number" ? value : Number(value.words) || 0 }])),
  };
}

function buildReport(snapshots, period, threshold) {
  const normalized = snapshots
    .filter((snapshot) => snapshot.date <= period.endDate)
    .map((snapshot) => ({
      date: snapshot.date,
      files: Object.fromEntries(Object.entries(snapshot.files).map(([path, value]) => [path, typeof value === "number" ? value : value.words])),
    }));
  const byDate = new Map(normalized.map((snapshot) => [snapshot.date, snapshot]));
  const inPeriod = normalized.filter((snapshot) => snapshot.date >= period.startDate && snapshot.date <= period.endDate);
  let previous = [...normalized].reverse().find((snapshot) => snapshot.date < period.startDate) ?? inPeriod[0];
  let cumulativeWords = 0;
  const daily = enumerateDates(period.startDate, period.endDate).map((date) => {
    const snapshot = byDate.get(date);
    let addedWords = 0;
    let mainFiles = [];
    if (snapshot && previous && snapshot !== previous) {
      const growth = fileGrowth(previous, snapshot);
      addedWords = growth.reduce((sum, file) => sum + file.addedWords, 0);
      mainFiles = growth.slice(0, 3).map((file) => file.path);
      previous = snapshot;
    }
    cumulativeWords += addedWords;
    return { date, addedWords, cumulativeWords, mainFiles };
  });
  const monthly = monthlyGrowth(daily);
  const topDays = daily
    .filter((day) => day.addedWords > 0)
    .sort((a, b) => b.addedWords - a.addedWords || a.date.localeCompare(b.date))
    .slice(0, 5)
    .map((day) => ({ date: day.date, added_words: day.addedWords, main_files: day.mainFiles }));
  const baselineOnly = normalized.length <= 1 || (inPeriod.length <= 1 && !normalized.some((snapshot) => snapshot.date < period.startDate));
  const summary = {
    total_added_words: daily.reduce((sum, day) => sum + day.addedWords, 0),
    writing_days: daily.filter((day) => day.addedWords >= threshold).length,
    longest_streak: longestStreak(daily, threshold),
    current_streak: currentStreak(daily, threshold),
    peak_month: monthly.filter((month) => month.addedWords > 0).sort((a, b) => b.addedWords - a.addedWords || a.month.localeCompare(b.month))[0]?.month ?? null,
    top_days: topDays,
    baseline_only: baselineOnly,
    ...(baselineOnly ? { baseline_message: BASELINE_MESSAGE } : {}),
  };
  return { daily, monthly, summary, feedback: feedback(summary, daily.length) };
}

function fileGrowth(previous, current) {
  return [...new Set([...Object.keys(previous.files), ...Object.keys(current.files)])]
    .map((path) => ({ path, addedWords: Math.max(0, (current.files[path] ?? 0) - (previous.files[path] ?? 0)) }))
    .filter((file) => file.addedWords > 0)
    .sort((a, b) => b.addedWords - a.addedWords || a.path.localeCompare(b.path));
}

function monthlyGrowth(daily) {
  const buckets = new Map();
  for (const day of daily) {
    const month = day.date.slice(0, 7);
    const bucket = buckets.get(month) ?? { month, addedWords: 0, cumulativeWords: 0 };
    bucket.addedWords += day.addedWords;
    buckets.set(month, bucket);
  }
  let cumulative = 0;
  return [...buckets.values()].map((month) => {
    cumulative += month.addedWords;
    return { ...month, cumulativeWords: cumulative };
  });
}

function longestStreak(daily, threshold) {
  let best = 0;
  let current = 0;
  for (const day of daily) {
    current = day.addedWords >= threshold ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return best;
}

function currentStreak(daily, threshold) {
  let streak = 0;
  for (let index = daily.length - 1; index >= 0; index -= 1) {
    if (daily[index].addedWords < threshold) break;
    streak += 1;
  }
  return streak;
}

function feedback(summary, days) {
  if (summary.baseline_only) {
    return { strength: "已建立当前字数基线。", risk: "历史增长不足，暂时无法判断节奏稳定性。", suggestion: "保持定期运行，积累至少两次快照后再观察趋势。" };
  }
  const ratio = days > 0 ? summary.writing_days / days : 0;
  const topShare = summary.total_added_words > 0 ? summary.top_days.reduce((sum, day) => sum + day.added_words, 0) / summary.total_added_words : 0;
  return {
    strength: ratio >= 0.45 || summary.longest_streak >= 14 ? `本期写作天数较多，最长连续写作达到 ${summary.longest_streak} 天，说明记录习惯较稳定。` : `本期已经形成 ${summary.writing_days} 个写作日，最长连续写作 ${summary.longest_streak} 天。`,
    risk: topShare >= 0.45 ? "新增字数主要集中在少数几天，说明写作节奏仍有波动。" : "整体没有明显依赖少数高产日，但仍需要关注低产间隔。",
    suggestion: summary.current_streak > 0 ? "下期优先延续当前连续写作节奏，减少长时间中断。" : "下期优先保持每周稳定写作，而不是追求单日高产。",
  };
}

function renderMarkdown(summary, reportFeedback, chartPaths) {
  return [
    "## 写作增长",
    "",
    summary.baseline_only ? summary.baseline_message : `本期新增字数 ${summary.total_added_words.toLocaleString("en-US")}，写作天数 ${summary.writing_days} 天，最长连续写作 ${summary.longest_streak} 天。`,
    "",
    ...chartPaths.map((path) => `![[${path}]]`),
    "",
    "### 反馈信号",
    "",
    `- 做得好的地方：${reportFeedback.strength}`,
    `- 需要关注的地方：${reportFeedback.risk}`,
    `- 下期建议：${reportFeedback.suggestion}`,
    "",
  ].join("\n");
}

function renderDailySvg(daily) {
  const points = daily.map((day, index) => `${index * 8},${220 - Math.min(200, day.cumulativeWords / Math.max(1, daily.at(-1)?.cumulativeWords ?? 1) * 200)}`).join(" ");
  return `<svg class="writing-growth-chart writing-growth-cumulative" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.max(300, daily.length * 8)} 240" width="100%" height="auto"><title>每日累计新增字数</title><polyline points="${points}" fill="none" stroke="#2f6f73" stroke-width="3"/></svg>\n`;
}

function renderMonthlySvg(monthly) {
  const max = Math.max(1, ...monthly.map((month) => month.addedWords));
  const bars = monthly.map((month, index) => `<rect x="${20 + index * 36}" y="${220 - (month.addedWords / max) * 190}" width="24" height="${(month.addedWords / max) * 190}" rx="3" fill="#b95e43"><title>${month.month}: ${month.addedWords}</title></rect>`).join("");
  return `<svg class="writing-growth-chart writing-growth-monthly" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.max(300, monthly.length * 36 + 40)} 240" width="100%" height="auto"><title>月度新增字数</title>${bars}</svg>\n`;
}

function renderHeatmapSvg(daily) {
  const max = Math.max(1, ...daily.map((day) => day.addedWords));
  const startWeekday = daily[0] ? new Date(`${daily[0].date}T00:00:00`).getDay() : 0;
  const cells = daily.map((day, index) => {
    const week = Math.floor((index + startWeekday) / 7);
    const weekday = new Date(`${day.date}T00:00:00`).getDay();
    return `<rect x="${34 + week * 13}" y="${20 + weekday * 13}" width="10" height="10" rx="2" fill="${heatColor(day.addedWords, max)}"><title>${day.date}: ${day.addedWords}</title></rect>`;
  }).join("");
  return `<svg class="writing-growth-chart writing-growth-heatmap" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.max(300, Math.ceil((daily.length + startWeekday) / 7) * 13 + 60)} 130" width="100%" height="auto"><title>写作热力图</title>${cells}</svg>\n`;
}

function countWords(markdown) {
  const text = markdown
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/u, " ")
    .replace(/```[\s\S]*?```/gu, " ")
    .replace(/~~~[\s\S]*?~~~/gu, " ")
    .replace(/`[^`\n]*`/gu, " ")
    .replace(/<!--[\s\S]*?-->/gu, " ")
    .replace(/!\[\[[^\]]+\]\]/gu, " ")
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/gu, "$2 $1")
    .replace(/!\[[^\]]*\]\([^)]+\)/gu, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, "$1")
    .replace(/[*_~=#>|()[\]{}-]/gu, " ");
  let words = 0;
  const rest = text.replace(/[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu, (match) => {
    if ([...match].some((char) => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(char))) return match;
    words += 1;
    return " ";
  });
  for (const char of rest) {
    if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(char)) words += 1;
  }
  return words;
}

function enumerateDates(start, end) {
  const dates = [];
  for (let current = new Date(`${start}T00:00:00`); current <= new Date(`${end}T00:00:00`); current.setDate(current.getDate() + 1)) {
    dates.push(todayKey(current));
  }
  return dates;
}

function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function heatColor(words, max) {
  if (words <= 0) return "#ebedf0";
  const colors = ["#b7e4c7", "#74c69d", "#2d6a4f", "#1b4332"];
  return colors[Math.min(colors.length - 1, Math.ceil((words / max) * colors.length) - 1)];
}
