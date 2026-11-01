# Suno demo and accessibility checklist

## 60-second demo narrative

1. 0-10s: "Reading a notice or study paragraph can be hard. Suno turns text you can listen to."
2. 10-20s: Paste or pick one of three sample sentences. Choose source and listening language (default English to Hindi).
3. 20-35s: Press "Create audio". A truthful loading state appears; no fake progress percentage.
4. 35-45s: Original or translated text appears in a readable panel with the correct language attribute.
5. 45-55s: Native audio controls play the WAV; adjust playback speed (0.75x-1.5x). Download `suno-reading.wav`.
6. 55-60s: Clear/reset returns to the empty state. No account, saved history, or autoplay.

## Problem, user, and core flow

- Problem: a reader who struggles with a short notice or unfamiliar language needs to hear it.
- User: student, older adult, or everyday reader with up to 1,000 Unicode characters.
- Flow: enter text -> choose source/listening language -> Generate -> read returned text -> play/download WAV. Translation is skipped when source equals target.
- Same-origin API only: `GET /api/health`, `POST /api/read`.

## Three ordinary public sample sentences (English)

1. "The library will be closed on Friday for maintenance."
2. "Please submit your assignment by 5 PM today."
3. "Reminder: bring your water bottle to the event."

## Verification checklist

| Check | Planned MVP behavior (source) |
| --- | --- |
| Tab moves through editor, chips, selects, buttons, audio controls in order | Semantic labels and keyboard focus styles (PLAN.md UI; T-ui) |
| Visible focus ring on every interactive element | Complete keyboard focus styles (T-ui) |
| Enter/Space activates buttons and chips | Native button elements (T-ui) |
| No autoplay on load or after success | No autoplay (PLAN.md MVP) |
| Native audio controls include 0.75, 1, 1.25, 1.5 playback rates | Playback rate options (T-ui) |
| Empty text shows a text-first validation error | Validation errors 400 `{error}` (PLAN.md) |
| Over 1,000 Unicode code points rejected with precise error | Input and translated TTS text capped at 1,000 (PLAN.md) |
| Same source and target returns original text, `translated:false` | Skip translation for same language (PLAN.md) |
| Partial speech failure keeps translated text visible, no audio, retry allowed | Partial failure 502 `{error,text,translated}` (PLAN.md) |
| Missing credentials show a clear local-setup notice, no browser key prompt | Missing credentials 503; health shows configured boolean (PLAN.md) |
| Upstream errors/timeouts are sanitized, never raw provider responses | Sanitized 502/504 (PLAN.md) |
| Duplicate requests prevented; pending fetch aborted on clear | Single in-flight upstream job (PLAN.md) |
| Stale audio is not reused after a failure | Blob objectURL lifecycle revoked (T-ui) |
| API data rendered via textContent/value, never innerHTML | No innerHTML with API data (T-ui) |
| Generated text has correct `lang` attribute | lang attributes on generated text (T-ui) |
| Status and errors announced without color-only cues | aria-live status, no color-only status (T-ui) |
| "Larger text" and "High contrast" toggles persist preferences only | Appearance toolbar, persisted preference only (T-ui) |
| Minimum 44px touch targets | Minimum touch targets 44px (T-ui) |
| Desktop shows editor/output grid; mobile stacks vertically | Responsive desktop grid, mobile stacked (T-ui) |
| Download saves as `suno-reading.wav` | Download `suno-reading.wav` (T-ui) |
| At 360px width no horizontal scrolling | Responsive website (PLAN.md MVP) |
| Footer states generation needs internet and sends entered text to Sarvam | Footer text (T-ui) |
| Footer states no user history is saved | No persistence of entered text/audio (PLAN.md) |

## Honest limitations

- Prototype/local build only; no deployment or production claim is made.
- Generation requires internet and sends entered text to Sarvam; results are not cached or saved.
- No OCR, image upload, or automatic summarization.
- No accounts, analytics, saved history, or voice cloning.
- No medical or legal interpretation of text.
- If speech fails, translated text remains but no audio is produced; retry is manual.
- No automatic retries or API loops; one request at a time.
- Sample sentences are ordinary English examples, not observed API results.
