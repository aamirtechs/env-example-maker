"use strict";
const test = require("node:test");
const assert = require("node:assert");
const L = require("../src/logic.js");

// Fixture values are fake and assembled from parts so no credential-shaped
// string ever appears in this file.
const FAKE_VALUE = "fake" + "Example" + "Value" + "0000";
const HIGH_ENTROPY = "aB3" + "xY9" + "kQ7" + "mZ2" + "pW8" + "nR4";

test("parser handles quotes, export prefix and comments", () => {
  const text = "# Database settings\nexport DATABASE_URL=\"postgres://db.example.com:5432/app\" # main db\nPLAIN=hello world\nSINGLE='quoted value'\nEMPTY=";
  const parsed = L.parseEnv(text);
  assert.strictEqual(parsed.entries.length, 4);
  const db = parsed.entries[0];
  assert.strictEqual(db.key, "DATABASE_URL");
  assert.strictEqual(db.exportPrefix, true);
  assert.strictEqual(db.quote, '"');
  assert.strictEqual(db.value, "postgres://db.example.com:5432/app");
  assert.ok(db.inlineComment.includes("main db"));
  assert.strictEqual(parsed.entries[2].quote, "'");
  assert.strictEqual(parsed.entries[2].value, "quoted value");
  assert.strictEqual(parsed.entries[3].value, "");
  assert.strictEqual(parsed.lines[0].type, "comment");
});

test("value stripping with type aware placeholders", () => {
  const text = ["APP_URL=https://app.example.com/path", "PORT=8080", "ADMIN_EMAIL=admin@example.com", "DEBUG=true", "RETRIES=3", "APP_NAME=My Cool App"].join("\n");
  const out = L.generateExample(text);
  assert.ok(out.includes("APP_URL=https://example.com"));
  assert.ok(out.includes("PORT=3000"));
  assert.ok(out.includes("ADMIN_EMAIL=user@example.com"));
  assert.ok(out.includes("DEBUG=true"));
  assert.ok(out.includes("RETRIES=0"));
  assert.ok(out.includes("APP_NAME="));
  assert.ok(!out.includes("My Cool App"));
  assert.ok(!out.includes("app.example.com/path"));
});

test("comments and ordering are preserved in the example", () => {
  const text = "# Section one\nFIRST=one\n\n# Section two\nSECOND=two";
  const out = L.generateExample(text);
  assert.ok(out.indexOf("# Section one") < out.indexOf("FIRST="));
  assert.ok(out.indexOf("FIRST=") < out.indexOf("# Section two"));
  assert.ok(out.includes("\n\n"));
});

test("likely secret detection by key name", () => {
  const entry = { key: "SERVICE_API" + "_KEY", value: FAKE_VALUE };
  const check = L.isLikelySecret(entry);
  assert.strictEqual(check.secret, true);
  assert.strictEqual(check.byKeyName, true);
  const plain = L.isLikelySecret({ key: "APP_NAME", value: "demo" });
  assert.strictEqual(plain.secret, false);
});

test("likely secret detection by entropy", () => {
  const high = L.shannonEntropy(HIGH_ENTROPY);
  const low = L.shannonEntropy("aaaaaaaaaaaaaaaaaaaa");
  assert.ok(high > 3.8, "entropy " + high);
  assert.strictEqual(low, 0);
  const check = L.isLikelySecret({ key: "MYSTERY_SETTING", value: HIGH_ENTROPY });
  assert.strictEqual(check.secret, true);
  assert.strictEqual(check.byEntropy, true);
  const report = L.analyzeEnv("MYSTERY_SETTING=" + HIGH_ENTROPY + "\nSERVICE_API" + "_KEY=" + FAKE_VALUE);
  assert.strictEqual(report.secrets.length, 2);
});

test("generated example never contains the original secret value", () => {
  const text = "SERVICE_API" + "_KEY=" + FAKE_VALUE + "\nOTHER=" + HIGH_ENTROPY;
  const out = L.generateExample(text);
  assert.ok(!out.includes(FAKE_VALUE));
  assert.ok(!out.includes(HIGH_ENTROPY));
});

test("drift diff against an existing example", () => {
  const envText = "A=1\nB=2\nC=3";
  const exampleText = "A=\nB=\nD=";
  const diff = L.driftDiff(envText, exampleText);
  assert.deepStrictEqual(diff.missingInExample, ["C"]);
  assert.deepStrictEqual(diff.extraInExample, ["D"]);
  assert.strictEqual(diff.inBoth.length, 2);
  const report = L.buildDriftReport(diff);
  assert.ok(report.includes("Missing from .env.example (1)"));
  assert.ok(report.includes("- C"));
  assert.ok(report.includes("- D"));
});

test("duplicate keys produce a warning", () => {
  const report = L.analyzeEnv("A=1\nA=2");
  assert.ok(report.warnings.some(w => w.message.includes("Duplicate")));
});
