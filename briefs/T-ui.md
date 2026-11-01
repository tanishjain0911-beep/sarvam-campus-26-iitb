# Suno accessible reader interface
## Goal
Build a beautiful usable reader website frontend matching PLAN.md.
## Context
Read PLAN.md and AGENTS.md. You own the frontend only; backend is built independently. Use file tools only. Do not run terminals, shell commands, network tools, or read credentials. Manager runs tests.
## Files you may touch
- public/index.html
- public/styles.css
- public/app.js
## Requirements
Vanilla HTML/CSS/JS, no external libraries, images, fonts, CDN, inline scripts, dependencies. A refined calm warm-ivory interface with dark ink, muted forest green, accessible contrast, editorial typography from local/system fonts. Suno wordmark, small eyebrow 'A LITTLE LESS READING. A LITTLE MORE UNDERSTANDING.', large heading 'Every word. Within reach.', concise description. Primary card is a roomy text editor (labelled, 1000 codepoint count), three sample chips ('A daily notice','A study note','An everyday message'), source and listening language selects, clearly labelled primary 'Create audio' button, clear/reset. Source default en-IN, listening default hi-IN. A prominent output card with empty illustration made using CSS/HTML only, clear text/status, then text panel and native audio controls and WAV download after success. State loading/progress (truthful, no simulated %), error announced by aria-live; text remains visible on partial TTS failure. No autoplay. playback speed options 0.75,1,1.25,1.5 on audio. Success and error must not hide text. Prevent duplicate requests; abort pending fetch on clear or if needed; never reuse stale audio after failure. User inputs use textContent/value only, never innerHTML with API data. Blob objectURL lifecycle revoke old/reset. Use backend contract exactly. GET /api/health for config status; if not configured show a clear local-setup notice without soliciting a browser key. Accessible appearance toolbar 'Larger text' toggle and 'High contrast' toggle, persisted preference only (not user's text). Complete keyboard focus styles, semantic labels, lang attributes on generated text, no color-only status. Minimum touch targets44px. Responsive desktop grid editor/output, mobile stacked. Buttons and labels easy for nontechnical readers. Footer concise 'Made for listening. Powered by Sarvam AI.' Explain generation needs internet and sends entered text to Sarvam, but no user history is saved. Preserve original text. Source/output languages all 11 codes from PLAN.md, native names plus English. Useful no login UX. No technical implementation details on landing copy.
## Interfaces
POST /api/read JSON {text,sourceLanguage,targetLanguage}. Success {text,translated,audioBase64,mimeType:'audio/wav'}. On 502 may include text,translated alongside error; render text, no audio. Other errors {error}. Do not show fabricated success if backend not ready. Fetch only same-origin API. Download suno-reading.wav.
## Done when
Create the three files, self-review for accessible states and API contract, report files and caveats. Manager runs node --check public/app.js and browser QA.
## Out of scope
No server edits, planning edits, packages, shell commands, network tools, credentials, Git operations, build/deployment. No OCR, accounts, tracking, synthesized fake audio, or summarization.
