"use strict";
// Env Example Maker: core logic (pure functions, no DOM).

function shannonEntropy(str) {
  const s = String(str || "");
  if (!s.length) { return 0; }
  const counts = {};
  for (let i = 0; i < s.length; i++) { counts[s[i]] = (counts[s[i]] || 0) + 1; }
  let entropy = 0;
  Object.keys(counts).forEach(function (ch) {
    const p = counts[ch] / s.length;
    entropy -= p * Math.log2(p);
  });
  return Math.round(entropy * 100) / 100;
}

function parseEnvLine(line, index) {
  const raw = String(line);
  const trimmed = raw.trim();
  if (!trimmed) { return { type: "blank", raw: raw, index: index }; }
  if (trimmed.charAt(0) === "#") { return { type: "comment", raw: raw, comment: trimmed, index: index }; }
  let rest = trimmed;
  let exportPrefix = false;
  if (rest.indexOf("export ") === 0) { exportPrefix = true; rest = rest.slice(7).trim(); }
  const eq = rest.indexOf("=");
  if (eq === -1) { return { type: "invalid", raw: raw, index: index, warning: "Line has no = sign and was kept as is." }; }
  const key = rest.slice(0, eq).trim();
  let value = rest.slice(eq + 1);
  let quote = null;
  let inlineComment = "";
  const leadTrim = value.replace(/^\s+/, "");
  if (leadTrim.charAt(0) === '"' || leadTrim.charAt(0) === "'") {
    quote = leadTrim.charAt(0);
    const close = leadTrim.indexOf(quote, 1);
    if (close !== -1) {
      value = leadTrim.slice(1, close);
      const tail = leadTrim.slice(close + 1).trim();
      if (tail.charAt(0) === "#") { inlineComment = tail; }
    } else { value = leadTrim.slice(1); }
  } else {
    const hashIdx = value.indexOf(" #");
    if (hashIdx !== -1) { inlineComment = value.slice(hashIdx + 1).trim(); value = value.slice(0, hashIdx); }
    value = value.trim();
  }
  return { type: "entry", raw: raw, index: index, key: key, value: value, quote: quote, exportPrefix: exportPrefix, inlineComment: inlineComment };
}

function parseEnv(text) {
  const lines = String(text || "").split(/\r?\n/);
  const entries = lines.map(function (line, i) { return parseEnvLine(line, i); });
  const pairs = entries.filter(function (e) { return e.type === "entry"; });
  return { lines: entries, entries: pairs };
}

var SECRET_KEY_PATTERN = /(secret|password|passwd|token|api[-_]?key|apikey|auth|credential|private|session|cookie|signing|encryption)/i;

function valueType(entry) {
  const v = String(entry.value || "");
  const key = String(entry.key || "");
  if (/^https?:\/\//i.test(v)) { return "url"; }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { return "email"; }
  if (/port/i.test(key) && /^\d+$/.test(v)) { return "port"; }
  if (/^(true|false)$/i.test(v)) { return "boolean"; }
  if (/^-?\d+$/.test(v)) { return "integer"; }
  if (/^-?\d*\.\d+$/.test(v)) { return "number"; }
  if (/^\{.*\}$/.test(v) || /^\[.*\]$/.test(v)) { return "json"; }
  if (v === "") { return "empty"; }
  return "string";
}

function isLikelySecret(entry) {
  const keyHit = SECRET_KEY_PATTERN.test(String(entry.key || ""));
  const v = String(entry.value || "");
  const entropy = shannonEntropy(v);
  const entropyHit = v.length >= 16 && entropy >= 3.8 && !/^https?:\/\//i.test(v) && v.indexOf(" ") === -1;
  return { secret: keyHit || entropyHit, byKeyName: keyHit, byEntropy: entropyHit && !keyHit, entropy: entropy };
}

function placeholderFor(entry) {
  if (isLikelySecret(entry).secret) { return ""; }
  switch (valueType(entry)) {
    case "url": return "https://example.com";
    case "email": return "user@example.com";
    case "port": return "3000";
    case "boolean": return String(entry.value).toLowerCase();
    case "integer": return "0";
    case "number": return "0.0";
    case "json": return "{}";
    case "empty": return "";
    default: return "";
  }
}

function generateExample(text) {
  const parsed = parseEnv(text);
  const out = parsed.lines.map(function (line) {
    if (line.type === "comment" || line.type === "blank") { return line.raw; }
    if (line.type === "invalid") { return line.raw; }
    const prefix = line.exportPrefix ? "export " : "";
    let rendered = prefix + line.key + "=" + placeholderFor(line);
    if (line.inlineComment) { rendered += " " + line.inlineComment; }
    return rendered;
  });
  // Drop a trailing blank produced by a final newline.
  while (out.length && out[out.length - 1] === "") { out.pop(); }
  return out.join("\n") + "\n";
}

function analyzeEnv(text) {
  const parsed = parseEnv(text);
  const warnings = [];
  const secrets = [];
  parsed.entries.forEach(function (e) {
    const check = isLikelySecret(e);
    if (check.secret) {
      secrets.push({ key: e.key, reason: check.byKeyName ? "key name" : "high entropy value" });
    }
    if (e.value && !check.secret && valueType(e) === "string" && e.value.length >= 24) {
      warnings.push({ key: e.key, message: "Long plain value on a non-obvious key. Check it is safe to share." });
    }
  });
  parsed.lines.forEach(function (l) {
    if (l.type === "invalid") { warnings.push({ key: "", message: l.warning + " (line " + (l.index + 1) + ")" }); }
  });
  const seen = {};
  parsed.entries.forEach(function (e) {
    if (seen[e.key]) { warnings.push({ key: e.key, message: "Duplicate key in the file." }); }
    seen[e.key] = true;
  });
  return { entries: parsed.entries, secrets: secrets, warnings: warnings };
}

function driftDiff(envText, exampleText) {
  const env = parseEnv(envText);
  const ex = parseEnv(exampleText || "");
  const envKeys = env.entries.map(function (e) { return e.key; });
  const exKeys = ex.entries.map(function (e) { return e.key; });
  const missingInExample = envKeys.filter(function (k) { return exKeys.indexOf(k) === -1; });
  const extraInExample = exKeys.filter(function (k) { return envKeys.indexOf(k) === -1; });
  const inBoth = envKeys.filter(function (k) { return exKeys.indexOf(k) !== -1; });
  return { missingInExample: missingInExample, extraInExample: extraInExample, inBoth: inBoth, envCount: envKeys.length, exampleCount: exKeys.length };
}

function buildDriftReport(diff) {
  const lines = ["Drift report", "Keys in .env: " + diff.envCount, "Keys in .env.example: " + diff.exampleCount, ""];
  lines.push("Missing from .env.example (" + diff.missingInExample.length + "):");
  diff.missingInExample.forEach(function (k) { lines.push("- " + k); });
  lines.push("");
  lines.push("Only in .env.example, not in .env (" + diff.extraInExample.length + "):");
  diff.extraInExample.forEach(function (k) { lines.push("- " + k); });
  return lines.join("\n") + "\n";
}

var NEVER_COMMIT_CHECKLIST = [
  "Never commit a real .env file. Commit only the generated .env.example.",
  "Check .env is listed in .gitignore before the first commit.",
  "Rotate any secret that was ever pasted into a ticket, chat or public repo.",
  "Keep production secrets in a secret manager, not in files on laptops.",
  "Review the likely secret warnings above before sharing the example file."
];

const api = { shannonEntropy, parseEnvLine, parseEnv, SECRET_KEY_PATTERN, valueType, isLikelySecret, placeholderFor, generateExample, analyzeEnv, driftDiff, buildDriftReport, NEVER_COMMIT_CHECKLIST };
if (typeof module !== "undefined" && module.exports) { module.exports = api; }
if (typeof window !== "undefined") { window.EnvExampleMaker = api; }
