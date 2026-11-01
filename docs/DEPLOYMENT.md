# Public website and deployment

**Live website:** https://suno-news-mirror-iitb.sacredjam128.chatgpt.site/

**GitHub source:** https://github.com/tanishjain0911-beep/sarvam-campus-26-iitb

**Hosting source and build instructions:** [hosting/README.md](../hosting/README.md)

## Current publication

- Access: **public**. Anyone with the website link can visit without signing in.
- Hosting: Sites / Cloudflare Workers, retaining the supplied Vinext build integration.
- Current hosted source revision: `474db5509512977d5ed88245036c3dd2ad2854cc` in the Site source repository (version 5).
- Runtime secret: `SARVAM_API_KEY` is configured in the hosting secret store. It is not in GitHub or the browser bundle.
- `hosting/` includes the complete tracked hosting source, build scripts, lockfile, manifest, interface assets and adapter tests. The root project remains a dependency-free Node application for local use.

## News refresh fix

The original deployment used `redirect: 'error'` for RSS requests, which Cloudflare Workers rejects immediately. The current version uses `manual` and rejects non-success responses without following redirects. A regression test covers Worker-compatible options and redirect rejection.

The fix was deployed successfully and the public browser page then loaded five Technology headlines with original links and publication times. This verifies the live server path used by mobile and desktop clients; a physical phone was not operated by the agent.

## Build and maintain

Follow [hosting/README.md](../hosting/README.md) to install the locked dependencies and build. Hosted Worker code is under `hosting/suno/`; the local Node API is at the repository root.

After editing hosted `public/` assets, regenerate the embedded copy from the `hosting/` directory:

```bash
node --input-type=module -e "import fs from 'node:fs'; const assets={}; for(const file of ['index.html','app.js','styles.css','news.js','news.css','voice-recorder.js']) assets[file]=fs.readFileSync('public/'+file,'utf8'); fs.writeFileSync('suno/assets.mjs','export default '+JSON.stringify(assets)+';');"
```

Keep the root and hosted shared modules consistent. For future publication use the existing Site identity and the Sites source/build workflow, then save and deploy that exact built source version. GitHub pushes alone do not redeploy the website.

## Verification and limits

- Root `npm test`: **96 tests pass** (58 local-app tests plus 38 hosting/shared-module tests).
- Production build passed; hosting confirmed version 5 deployment succeeded.
- Public news loading was verified in the browser after the fix.
- A full hosted speech/voice-recreation flow has not been verified. The previously reported own-voice playback/flow issue remains open.
- Production hardening still needs rate limiting, abuse prevention and broader language/device checks.

## Focused briefing (version 4)

The public interface now ranks up to five stories and highlights the lead. Ranking uses recent publication, publisher placement, public-interest headline signals and cross-publisher coverage, with similar-headline grouping and links to additional reporting. This automated heuristic does not guarantee the objectively most important or complete news selection. Details are shown in the app under **How are stories selected?**.

The public ranked edition and layout were browser-checked after deployment. A 390px preview had no horizontal overflow.

## City edition (version 5)

In India headlines, choose **Your city** to keep three national stories and add up to two recent city stories. Available city feeds: Mumbai, Pune, Delhi, Bengaluru, Chennai, Hyderabad, Kolkata, Lucknow and Chandigarh. National-only remains the default. Missing local coverage falls back to national stories, with an explicit message. City choices are saved on the device; no GPS is requested.

Automated verification: 96 tests pass (58 local application tests and 38 hosting/shared-module tests), including city cache isolation, fallback, recency, duplicate handling and invalid input rejection. The production build passed and hosted version 5 deployed successfully.
