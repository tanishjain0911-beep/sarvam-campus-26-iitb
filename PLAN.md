# Suno - text you can listen to

## Problem and selection
Chosen from Idea Library #18, Text-to-Speech Content Reader. A person who struggles to read a notice or unfamiliar language should be able to hear it without creating an account. This is a practical, broad accessibility use case with fewer dependencies than schemes, medicine, or document verification.

## One user, one problem, one complete flow
User: a student, older adult, or everyday reader with a short notice or study paragraph.
Input: paste up to 1,000 Unicode characters, select the source language and listening language.
Result: original or translated text, playable speech, and a WAV download. Translation is skipped for the same language.

## MVP scope
- Responsive, keyboard-accessible website; readable type, large targets, high-contrast mode, text-size toggle, visible labels, status announcements, text-first errors.
- Source and output selection for en-IN, hi-IN, bn-IN, gu-IN, kn-IN, ml-IN, mr-IN, or-IN, pa-IN, ta-IN, te-IN.
- Three editable public sample snippets, character counter, explicit Generate button, clear/reset, native audio controls and playback rate; no autoplay.
- Translated text stays available if speech fails. API errors never become fake audio or simulated success.
- No login, no persistence of entered text/audio, no analytics, no upload/OCR, no summaries, no voice cloning, no medical or legal interpretation.

## Architecture and interface
Dependency-free Node.js 22+ HTTP server, vanilla HTML/CSS/JS frontend. No npm installation required. Host binds 127.0.0.1 by default; PORT is configurable. Secrets stay server-side.

GET /api/health -> {ok:true,configured:boolean}; never return a key.
POST /api/read accepts JSON {text:string,sourceLanguage:string,targetLanguage:string}.
Success -> {text:string,translated:boolean,audioBase64:string,mimeType:"audio/wav"}.
Partial speech failure -> HTTP 502 {error:string,text:string,translated:boolean}; frontend renders returned text with an error and allows retry.
Validation errors -> HTTP 400 {error:string}. Missing credentials -> HTTP 503. Upstream errors/timeouts -> sanitized 502/504, never raw provider responses. Single in-flight upstream job per browser; no automatic retries or API loops.
Body limit 16KB; accept application/json only. Limit input and translated TTS text to 1,000 Unicode code points. Return precise error for translated text exceeding the limit. Serve only explicit public files, never .env, .git, credentials, briefs, or source code. Reject cross-origin browser POSTs; use JSON body/CORS policy and do not expose credentials.

## Sarvam integration verified with MCP builder tools
Both APIs bill by character; exact rates depend on the account. Checked pricing, snippets, and request validation before coding.
POST https://api.sarvam.ai/translate with api-subscription-key header and JSON {input,source_language_code,target_language_code,model:"mayura:v1",mode:"formal",numerals_format:"international"}. Read translated_text. Formal mode was selected after the first live test returned code-mixed output in modern-colloquial mode.
POST https://api.sarvam.ai/text-to-speech with same header and JSON {text,target_language_code,speaker:"shubh",model:"bulbul:v3",speech_sample_rate:24000,enable_preprocessing:true}. Read audios[0] base64 WAV. Both request shapes passed sarvam_code_validate_request. Do not guess alternatives. App reads SARVAM_API_KEY only; a local manager launcher may load ~/.sarvam/credentials privately into that environment.

## Execution and roadmap
1. Coding agents ready: OpenCode free model tested, Antigravity High tested; Sarvam MCP initialized with 38 tools. Hyde was explicitly skipped.
2. Shape idea and map APIs: complete above.
3. Define website MVP: complete above.
4. Build: backend and UI independently; review, mocked API tests, browser tests, then one approved tiny live translation+speech request. Do not repeat paid calls without a reason and approval.
5. Save: local Git commits and README. Ask user before GitHub push.
Bonus: deployment and second-device check require user approval and a host for the secret-bearing backend. No unsupported production claims.

## Time-box priorities
First pass: core flow and error handling. Next: keyboard/mobile verification and live provider check. Then: concise demo/readme and reviewable local commit. UI niceties must not delay the functional flow.
