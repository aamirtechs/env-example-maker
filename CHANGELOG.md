# Changelog

## 1.0.0 - 2026-10-23

- Parses .env files with quotes, export prefixes and comments, and preserves comments and ordering in the output.
- Generates a .env.example with values blanked or replaced by type aware placeholders for URLs, ports, emails, numbers and booleans.
- Likely secret highlighting using key name and entropy heuristics, with a never commit checklist.
- Drift diff against an existing .env.example showing keys missing on either side, plus downloads for the example and the drift report.
