# Suno — Every word. Within reach.
A multilingual text-to-speech reader for Sarvam Campus '26 at IIT Bombay. Paste a short notice, study paragraph, or message, choose your listening language, and listen or download a WAV. No account is needed in the reader.

## Current status

Selected from Idea Library #18, Text-to-Speech Content Reader, for a short, complete, broadly useful accessibility flow. This is a local hackathon prototype; population reach and accessibility outcomes have not been measured. See [PLAN.md](PLAN.md), [TASKS.md](TASKS.md), and [demo checklist](docs/DEMO.md).

## Run Suno

Requires Node.js 22+ and a Sarvam API key. No npm dependencies need installing.

Set `SARVAM_API_KEY` privately in your environment, then run `npm start` and open http://127.0.0.1:3000.

Alternatively copy `.env.example` to `.env`, enter the key in a local editor, and run `node --env-file=.env server.mjs`.

For this participant's existing credentials file, run `node scripts/start-local.mjs`, or double-click `Start-Suno.cmd` on Windows. The convenience launcher reads `~/.sarvam/credentials` into the server environment without displaying or copying the key. Optional `PORT` changes the port; `HOST` defaults to loopback. The app itself reads the key from the environment.

## One complete flow

1. Enter up to 1,000 Unicode code points or select a sample.
2. Choose the original and listening languages.
3. Choose **Create audio**. Matching languages skip translation.
4. Read the prepared text, play at your chosen speed, or download the WAV.

The UI offers English, Hindi, Bengali, Gujarati, Kannada, Malayalam, Marathi, Odia, Punjabi, Tamil and Telugu. Only paths recorded in the validation report have been tested live.

Keyboard labels/focus, native audio controls, larger text and high-contrast modes support different reading preferences. This is not a formal accessibility audit. Only appearance preferences are saved locally.

## APIs and privacy

Sarvam `/translate` uses `mayura:v1`; `/text-to-speech` uses `bulbul:v3`, voice `shubh`, 24kHz WAV. Request shapes were checked using Sarvam MCP pricing, snippet and request-validation tools before coding.

Generation needs internet and sends entered text to Sarvam. Suno does not save text/audio history on its server; Sarvam's own data policies apply. Each explicit request can use credits. There are no automatic retries. If speech fails after translation, the prepared text remains readable.

Keys stay server-side. `.env`, audio, logs and worktrees are excluded from Git. Raw provider errors and credentials are not returned to browsers. No OCR, uploads, summaries, cloning, accounts or analytics are included.

## Verify

Run `npm test` and `node --check public/app.js`. Tests use mocked provider responses and do not spend credits. Completed browser/live checks are recorded in `docs/VALIDATION.md`. GitHub publication and deployment require approval. Production hosting additionally needs abuse prevention, rate limiting and further validation.

## Tools and coordination

Codex plans, reviews, tests and commits. OpenCode implements scoped briefs in worktrees; Antigravity implements the interface. Hyde was skipped at the participant's request. Separate GitHub credentials are not shared with workers. Codex asks before external publishing.

Task handoffs are recorded in `docs/`. Use GitHub issues for implementation tasks and pull requests for review.

## Test Sarvam access

Python 3 is required; no packages need installing for this test.

```sh
python scripts/test_sarvam.py
```

Enter your API key at the hidden local prompt. The script sends one chat request to Sarvam and does not save the key. Keep keys out of chat, commits, issues, and screenshots. Live API calls may consume credits.
