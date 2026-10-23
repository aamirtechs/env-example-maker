# Env Example Maker
Live page: https://aamirtechs.github.io/env-example-maker/

Drop a real .env file and get a safe .env.example with every value stripped, plus warnings for secrets and drift. Sellers, operators and developers currently do this by hand, one row or one request at a time, in spreadsheets and paid suites. This tool does the whole batch in the browser for free.

## Features
- Parses .env files with quotes, export prefixes and comments, and preserves comments and ordering in the output.
- Generates a .env.example with values blanked or replaced by type aware placeholders for URLs, ports, emails, numbers and booleans.
- Likely secret highlighting using key name and entropy heuristics, with a never commit checklist.
- Drift diff against an existing .env.example showing keys missing on either side, plus downloads for the example and the drift report.

## How it works
Paste or upload your input, set the options, and run the tool. All processing happens locally in your browser using the shared logic in `src/logic.js`, and you can download the results as files. It runs entirely in the browser.

## Privacy
Runs 100% in your browser. Your files never leave this device, nothing is uploaded,
and there is no tracking.

## Development
Core logic lives in `src/logic.js` and is shared by the page and the tests.
Run the tests with `npm test`.

## License
MIT, Copyright 2026 Amir Hussain.
