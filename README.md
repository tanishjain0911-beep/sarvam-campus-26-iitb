# sarvam-campus-26-iitb
Sarvam Campus 2026 at IIT Bombay: build-along project, setup, and development coordination.

## Current status

Development workspace is ready; the project idea and submission requirements are pending.
See [setup status](docs/STATUS.md) and [working agreement](AGENTS.md).

## Tools and coordination

Codex leads implementation and review. OpenCode and Antigravity work in this same Git checkout on assigned tasks. Codex verifies their changes and publishes through the connected GitHub account; separate GitHub credentials are not shared with those tools.

Task handoffs are recorded in `docs/`. Use GitHub issues for implementation tasks and pull requests for review.

## Test Sarvam access

Python 3 is required; no packages need installing for this test.

```sh
python scripts/test_sarvam.py
```

Enter your API key at the hidden local prompt. The script sends one chat request to Sarvam and does not save the key. Keep keys out of chat, commits, issues, and screenshots. Live API calls may consume credits.
