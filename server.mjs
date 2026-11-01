import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getNews } from "./lib/news.mjs";
import { cloneNewsVoice } from "./lib/voice-clone.mjs";
import {
  translateText,
  synthesizeSpeech,
  isValidLanguage,
  codePointLength
} from "./lib/sarvam.mjs";

const MAX_BODY_BYTES = 16 * 1024;
const MAX_TEXT_CODE_POINTS = 1000;

const STATIC_FILES = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/app.js", "app.js"],
  ["/styles.css", "styles.css"],
  ["/news.js", "news.js"],
  ["/news.css", "news.css"],
  ["/voice-recorder.js", "voice-recorder.js"]
]);

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8"
};

function securityHeaders() {
  return {
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(self), geolocation=()"
  };
}

function sendJson(res, status, body, noStore = true) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    ...securityHeaders()
  };
  if (noStore) headers["Cache-Control"] = "no-store";
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

function sendText(res, status, body, contentType) {
  const headers = {
    "Content-Type": contentType,
    ...securityHeaders()
  };
  res.writeHead(status, headers);
  res.end(body);
}

function isAllowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers.host;
  if (!host) return false;
  return origin === `http://${host}` || origin === `https://${host}`;
}

function isJsonContentType(value) {
  if (typeof value !== "string") return false;
  const mediaType = value.split(";")[0].trim().toLowerCase();
  return mediaType === "application/json";
}

function errorStatusFor(err, defaultStatus = 502) {
  if (err && err.name === "AbortError") return 504;
  return defaultStatus;
}

async function readBody(req, limit = MAX_BODY_BYTES) {
  const chunks = [];
  let total = 0;
  let tooLarge = false;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limit) {
      tooLarge = true;
      break;
    }
    chunks.push(chunk);
  }
  if (tooLarge) return { tooLarge: true, raw: null };
  return { tooLarge: false, raw: Buffer.concat(chunks).toString("utf8") };
}

async function handleRequest(req, res, config) {
  const { apiKey, fetchImpl, publicDir, requestTimeoutMs } = config;
  const url = new URL(req.url || "/", "http://localhost");
  const pathname = url.pathname;

  // Static allowlist
  if (req.method === "GET" && STATIC_FILES.has(pathname)) {
    const fileName = STATIC_FILES.get(pathname);
    const resolvedBase = path.resolve(publicDir);
    const resolvedFile = path.resolve(resolvedBase, fileName);
    if (!resolvedFile.startsWith(resolvedBase + path.sep) && resolvedFile !== resolvedBase) {
      sendJson(res, 404, { error: "Not found." });
      return;
    }
    fs.readFile(resolvedFile, (err, data) => {
      if (err) {
        sendJson(res, 404, { error: "Not found." });
        return;
      }
      const ext = path.extname(fileName).toLowerCase();
      sendText(res, 200, data, CONTENT_TYPES[ext] || "application/octet-stream");
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, { ok: true, configured: Boolean(apiKey) });
    return;
  }

  if (req.method === "GET" && pathname === "/api/news") {
    try {
      sendJson(res, 200, await getNews({topic: url.searchParams.get('topic') || 'world', fetchImpl}));
    } catch (error) {
      const status = error.code === 'BAD_TOPIC' ? 400 : error.code === 'NEWS_TIMEOUT' ? 504 : 502;
      sendJson(res, status, {error: status === 400 ? 'Choose a supported topic.' : 'News could not be refreshed. Please try again later.'});
    }
    return;
  }

  if (pathname === '/api/news-voice') {
    if (req.method !== 'POST') { sendJson(res, 405, {error:'Method not allowed.'}); return; }
    if (!isAllowedOrigin(req) || !isJsonContentType(req.headers['content-type'])) {
      sendJson(res, 400, {error:'A same-origin JSON request is required.'}); return;
    }
    const body = await readBody(req, 14 * 1024 * 1024);
    if (body.tooLarge) { sendJson(res, 400, {error:'Reference audio is too large.'}); return; }
    let data;
    try { data = JSON.parse(body.raw); } catch { sendJson(res, 400, {error:'Invalid JSON.'}); return; }
    if (!data || typeof data !== 'object' || Array.isArray(data)) { sendJson(res, 400, {error:'Invalid request.'}); return; }
    try {
      const result = await cloneNewsVoice({apiKey,fetchImpl,text:data.text,languageCode:data.languageCode,referenceAudio:data.referenceAudio,consent:data.consent,timeoutMs:requestTimeoutMs});
      sendJson(res, 200, result);
    } catch(error) {
      const status = [400,503,504].includes(error.status) ? error.status : 502;
      sendJson(res, status, {error: status === 400 ? error.message : status === 503 ? 'Voice service is not configured.' : 'The beta voice service could not create audio. Standard narration is still available.'});
    }
    return;
  }

  if (pathname === "/api/read") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }

    if (!isAllowedOrigin(req)) {
      sendJson(res, 400, { error: "Cross-origin request rejected." });
      return;
    }

    if (!isJsonContentType(req.headers["content-type"])) {
      sendJson(res, 400, { error: "Content-Type must be application/json." });
      return;
    }

    const { tooLarge, raw } = await readBody(req);
    if (tooLarge) {
      sendJson(res, 400, { error: "Request body exceeds 16KB limit." });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw || "");
    } catch {
      sendJson(res, 400, { error: "Invalid JSON body." });
      return;
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      sendJson(res, 400, { error: "Invalid request body." });
      return;
    }

    const { text, sourceLanguage, targetLanguage } = parsed;
    if (typeof text !== "string") {
      sendJson(res, 400, { error: "text must be a string." });
      return;
    }
    const trimmed = text.trim();
    if (codePointLength(trimmed) < 1 || codePointLength(trimmed) > MAX_TEXT_CODE_POINTS) {
      sendJson(res, 400, { error: "text must be 1 to 1000 Unicode code points." });
      return;
    }
    if (!isValidLanguage(sourceLanguage) || !isValidLanguage(targetLanguage)) {
      sendJson(res, 400, { error: "Invalid language code." });
      return;
    }

    if (!apiKey) {
      sendJson(res, 503, { error: "Service not configured." });
      return;
    }

    const sameLanguage = sourceLanguage === targetLanguage;
    let finalText = trimmed;
    let translated = false;

    if (!sameLanguage) {
      try {
        finalText = await translateText({
          fetchImpl,
          apiKey,
          text: trimmed,
          sourceLanguage,
          targetLanguage,
          timeoutMs: requestTimeoutMs
        });
        translated = true;
      } catch (err) {
        const status = errorStatusFor(err, 502);
        const message =
          err && err.name === "AbortError"
            ? "Translation service request timed out."
            : err && err.message === "missing_field"
            ? "Translation service returned an invalid response."
            : err && err.message === "invalid_json"
            ? "Translation service returned an invalid response."
            : err && err.message === "invalid_response"
            ? "Translation service returned an invalid response."
            : "Translation service request failed.";
        sendJson(res, status, { error: message });
        return;
      }

      if (codePointLength(finalText) < 1 || codePointLength(finalText) > MAX_TEXT_CODE_POINTS) {
        sendJson(res, 400, { error: "Translated text exceeds 1000 Unicode code points." });
        return;
      }
      finalText = finalText.trim();
      if (codePointLength(finalText) < 1) {
        sendJson(res, 400, { error: "Translated text is empty." });
        return;
      }
    }

    // TTS
    try {
      const audio = await synthesizeSpeech({
        fetchImpl,
        apiKey,
        text: finalText,
        targetLanguage,
        timeoutMs: requestTimeoutMs
      });
      sendJson(res, 200, {
        text: finalText,
        translated,
        audioBase64: audio,
        mimeType: "audio/wav"
      });
      return;
    } catch (err) {
      const message =
        err && err.name === "AbortError"
          ? "Speech service request timed out."
          : err && (err.message === "missing_field" || err.message === "invalid_json" || err.message === "invalid_response" || err.message === "invalid_audio")
          ? "Speech service returned an invalid response."
          : "Speech service request failed.";
      sendJson(res, 502, {
        error: message,
        text: finalText,
        translated
      });
      return;
    }
  }

  // Other routes
  if (req.method === "GET" || req.method === "POST" || req.method === "HEAD") {
    sendJson(res, 404, { error: "Not found." });
    return;
  }
  sendJson(res, 405, { error: "Method not allowed." });
}

export function createServer({ apiKey, fetchImpl, publicDir, requestTimeoutMs } = {}) {
  const resolvedApiKey = apiKey === undefined ? process.env.SARVAM_API_KEY || "" : apiKey;
  const resolvedFetch = fetchImpl || fetch;
  const resolvedPublicDir =
    publicDir ||
    path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
  const resolvedTimeout = typeof requestTimeoutMs === "number" ? requestTimeoutMs : 30000;

  const config = {
    apiKey: resolvedApiKey,
    fetchImpl: resolvedFetch,
    publicDir: resolvedPublicDir,
    requestTimeoutMs: resolvedTimeout
  };

  const server = http.createServer((req, res) => {
    Promise.resolve(handleRequest(req, res, config)).catch(() => {
      if (!res.headersSent) {
        sendJson(res, 500, { error: "Internal server error." });
      }
    });
  });
  return server;
}

const __filename = fileURLToPath(import.meta.url);

function main() {
  const server = createServer({
    apiKey: process.env.SARVAM_API_KEY || "",
    publicDir: path.join(path.dirname(__filename), "public"),
    requestTimeoutMs: 30000
  });
  const host = process.env.HOST || "127.0.0.1";
  const port = Number(process.env.PORT) || 3000;
  server.listen(port, host, () => {
    console.log(`Suno listening on http://${host}:${port}`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  main();
}

export default createServer;
