import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../server.mjs";

const WAV_BASE64 = "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

async function startServer(options) {
  const server = createServer(options);
  await new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", (err) => (err ? reject(err) : resolve()));
  });
  const { port } = server.address();
  return {
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    }
  };
}

test("health reports configured state", async () => {
  const { base, close } = await startServer({ apiKey: "test-key", fetchImpl: async () => jsonResponse(200, {}) });
  try {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, configured: true });
  } finally {
    await close();
  }
});

test("same language skips translation", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return jsonResponse(200, { audios: [WAV_BASE64] });
  };
  const { base, close } = await startServer({ apiKey: "test-key", fetchImpl });
  try {
    const res = await fetch(`${base}/api/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Hello", sourceLanguage: "en-IN", targetLanguage: "en-IN" })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.text, "Hello");
    assert.equal(data.translated, false);
    assert.equal(data.audioBase64, WAV_BASE64);
    assert.equal(data.mimeType, "audio/wav");
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.includes("/text-to-speech"));
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.text, "Hello");
    assert.equal(body.target_language_code, "en-IN");
    assert.equal(body.speaker, "shubh");
    assert.equal(body.model, "bulbul:v3");
    assert.equal(body.speech_sample_rate, 24000);
    assert.equal(body.enable_preprocessing, true);
    assert.equal(body.pace, undefined);
  } finally {
    await close();
  }
});

test("translation and tts payload correctness", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.includes("/translate")) return jsonResponse(200, { translated_text: "नमस्ते" });
    return jsonResponse(200, { audios: [WAV_BASE64] });
  };
  const { base, close } = await startServer({ apiKey: "test-key", fetchImpl });
  try {
    const res = await fetch(`${base}/api/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Hello", sourceLanguage: "en-IN", targetLanguage: "hi-IN" })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.text, "नमस्ते");
    assert.equal(data.translated, true);

    assert.equal(calls.length, 2);
    const translateBody = JSON.parse(calls[0].init.body);
    assert.equal(translateBody.input, "Hello");
    assert.equal(translateBody.source_language_code, "en-IN");
    assert.equal(translateBody.target_language_code, "hi-IN");
    assert.equal(translateBody.model, "mayura:v1");
    assert.equal(translateBody.mode, "formal");
    assert.equal(translateBody.numerals_format, "international");
    assert.equal(calls[0].init.headers["api-subscription-key"], "test-key");

    const ttsBody = JSON.parse(calls[1].init.body);
    assert.equal(ttsBody.text, "नमस्ते");
    assert.equal(ttsBody.target_language_code, "hi-IN");
    assert.equal(ttsBody.speaker, "shubh");
    assert.equal(ttsBody.model, "bulbul:v3");
    assert.equal(ttsBody.speech_sample_rate, 24000);
    assert.equal(ttsBody.enable_preprocessing, true);
  } finally {
    await close();
  }
});

test("input validation and length cap", async () => {
  const fetchImpl = async () => jsonResponse(200, { audios: [WAV_BASE64] });
  const { base, close } = await startServer({ apiKey: "test-key", fetchImpl });
  try {
    const post = (body) =>
      fetch(`${base}/api/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

    let res = await post({ text: "   ", sourceLanguage: "en-IN", targetLanguage: "en-IN" });
    assert.equal(res.status, 400);

    res = await post({ text: "Hello", sourceLanguage: "xx-XX", targetLanguage: "en-IN" });
    assert.equal(res.status, 400);

    res = await post({ text: "Hello", sourceLanguage: "en-IN", targetLanguage: "xx-XX" });
    assert.equal(res.status, 400);

    const longText = "a".repeat(1001);
    res = await post({ text: longText, sourceLanguage: "en-IN", targetLanguage: "en-IN" });
    assert.equal(res.status, 400);

    res = await post({ text: 5, sourceLanguage: "en-IN", targetLanguage: "en-IN" });
    assert.equal(res.status, 400);
  } finally {
    await close();
  }
});

test("missing key returns 503", async () => {
  const { base, close } = await startServer({ apiKey: "", fetchImpl: async () => jsonResponse(200, { audios: [WAV_BASE64] }) });
  try {
    const res = await fetch(`${base}/api/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Hello", sourceLanguage: "en-IN", targetLanguage: "en-IN" })
    });
    assert.equal(res.status, 503);
  } finally {
    await close();
  }
});

test("provider unauthorized is sanitized", async () => {
  const fetchImpl = async (url) => {
    if (url.includes("/translate")) return jsonResponse(401, { message: "secret token invalid" });
    return jsonResponse(200, { audios: [WAV_BASE64] });
  };
  const { base, close } = await startServer({ apiKey: "test-key", fetchImpl });
  try {
    const res = await fetch(`${base}/api/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Hello", sourceLanguage: "en-IN", targetLanguage: "hi-IN" })
    });
    assert.equal(res.status, 502);
    const data = await res.json();
    const serialized = JSON.stringify(data);
    assert.ok(!serialized.includes("secret"));
    assert.ok(!serialized.includes("token"));
  } finally {
    await close();
  }
});

test("partial translated text on tts failure", async () => {
  const fetchImpl = async (url) => {
    if (url.includes("/translate")) return jsonResponse(200, { translated_text: "नमस्ते" });
    return jsonResponse(500, { message: "tts failed" });
  };
  const { base, close } = await startServer({ apiKey: "test-key", fetchImpl });
  try {
    const res = await fetch(`${base}/api/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Hello", sourceLanguage: "en-IN", targetLanguage: "hi-IN" })
    });
    assert.equal(res.status, 502);
    const data = await res.json();
    assert.equal(data.text, "नमस्ते");
    assert.equal(data.translated, true);
    assert.ok(typeof data.error === "string" && data.error.length > 0);
    assert.equal(data.audioBase64, undefined);
  } finally {
    await close();
  }
});

test("malformed upstream returns 502", async () => {
  const fetchImpl = async (url) => {
    if (url.includes("/translate")) {
      return {
        ok: true,
        status: 200,
        async json() {
          throw new Error("bad json");
        },
        async text() {
          return "bad";
        }
      };
    }
    return jsonResponse(200, { audios: [WAV_BASE64] });
  };
  const { base, close } = await startServer({ apiKey: "test-key", fetchImpl });
  try {
    const res = await fetch(`${base}/api/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Hello", sourceLanguage: "en-IN", targetLanguage: "hi-IN" })
    });
    assert.equal(res.status, 502);
  } finally {
    await close();
  }
});

test("static path traversal and secrets blocked", async () => {
  const fetchImpl = async () => jsonResponse(200, { audios: [WAV_BASE64] });
  const { base, close } = await startServer({ apiKey: "test-key", fetchImpl });
  try {
    for (const p of ["/.env", "/../.env", "/server.mjs", "/package.json", "/lib/sarvam.mjs", "/.git/config"]) {
      const res = await fetch(`${base}${p}`);
      assert.notEqual(res.status, 200, p);
    }
  } finally {
    await close();
  }
});

test("wrong origin rejected", async () => {
  const fetchImpl = async () => jsonResponse(200, { audios: [WAV_BASE64] });
  const { base, close } = await startServer({ apiKey: "test-key", fetchImpl });
  try {
    const res = await fetch(`${base}/api/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://evil.example" },
      body: JSON.stringify({ text: "Hello", sourceLanguage: "en-IN", targetLanguage: "en-IN" })
    });
    assert.equal(res.status, 400);
  } finally {
    await close();
  }
});

test("payload cap enforced", async () => {
  const fetchImpl = async () => jsonResponse(200, { audios: [WAV_BASE64] });
  const { base, close } = await startServer({ apiKey: "test-key", fetchImpl });
  try {
    const big = "a".repeat(20000);
    const res = await fetch(`${base}/api/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: big
    });
    assert.equal(res.status, 400);
  } finally {
    await close();
  }
});

test("content type rejects application/jsonp", async () => {
  const fetchImpl = async () => jsonResponse(200, { audios: [WAV_BASE64] });
  const { base, close } = await startServer({ apiKey: "test-key", fetchImpl });
  try {
    const res = await fetch(`${base}/api/read`, {
      method: "POST",
      headers: { "Content-Type": "application/jsonp" },
      body: JSON.stringify({ text: "Hello", sourceLanguage: "en-IN", targetLanguage: "en-IN" })
    });
    assert.equal(res.status, 400);
  } finally {
    await close();
  }
});

test("malformed audio base64 returns 502", async () => {
  const fetchImpl = async () => jsonResponse(200, { audios: ["!!!!"] });
  const { base, close } = await startServer({ apiKey: "test-key", fetchImpl });
  try {
    const res = await fetch(`${base}/api/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Hello", sourceLanguage: "en-IN", targetLanguage: "en-IN" })
    });
    assert.equal(res.status, 502);
  } finally {
    await close();
  }
});

test("empty or missing audio field returns 502", async () => {
  for (const body of [{ audios: [""] }, { audios: [] }, {}]) {
    const fetchImpl = async () => jsonResponse(200, body);
    const { base, close } = await startServer({ apiKey: "test-key", fetchImpl });
    try {
      const res = await fetch(`${base}/api/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello", sourceLanguage: "en-IN", targetLanguage: "en-IN" })
      });
      assert.equal(res.status, 502);
    } finally {
      await close();
    }
  }
});

test("wrong audio header returns 502", async () => {
  const fetchImpl = async () => jsonResponse(200, { audios: ["aGVsbG8="] });
  const { base, close } = await startServer({ apiKey: "test-key", fetchImpl });
  try {
    const res = await fetch(`${base}/api/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Hello", sourceLanguage: "en-IN", targetLanguage: "en-IN" })
    });
    assert.equal(res.status, 502);
  } finally {
    await close();
  }
});

test("translation fetch timeout returns 504", async () => {
  const fetchImpl = async (url) => {
    if (url.includes("/translate")) return new Promise(() => {});
    return jsonResponse(200, { audios: [WAV_BASE64] });
  };
  const { base, close } = await startServer({ apiKey: "test-key", fetchImpl, requestTimeoutMs: 20 });
  try {
    const res = await fetch(`${base}/api/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Hello", sourceLanguage: "en-IN", targetLanguage: "hi-IN" })
    });
    assert.equal(res.status, 504);
  } finally {
    await close();
  }
});

test("translation json timeout returns 504", async () => {
  const fetchImpl = async (url) => {
    if (url.includes("/translate")) {
      return { ok: true, status: 200, async json() { return new Promise(() => {}); } };
    }
    return jsonResponse(200, { audios: [WAV_BASE64] });
  };
  const { base, close } = await startServer({ apiKey: "test-key", fetchImpl, requestTimeoutMs: 20 });
  try {
    const res = await fetch(`${base}/api/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Hello", sourceLanguage: "en-IN", targetLanguage: "hi-IN" })
    });
    assert.equal(res.status, 504);
  } finally {
    await close();
  }
});

test("tts fetch timeout returns 502", async () => {
  const fetchImpl = async () => new Promise(() => {});
  const { base, close } = await startServer({ apiKey: "test-key", fetchImpl, requestTimeoutMs: 20 });
  try {
    const res = await fetch(`${base}/api/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Hello", sourceLanguage: "en-IN", targetLanguage: "en-IN" })
    });
    assert.equal(res.status, 502);
  } finally {
    await close();
  }
});

test("tts json timeout returns 502", async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, async json() { return new Promise(() => {}); } });
  const { base, close } = await startServer({ apiKey: "test-key", fetchImpl, requestTimeoutMs: 20 });
  try {
    const res = await fetch(`${base}/api/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Hello", sourceLanguage: "en-IN", targetLanguage: "en-IN" })
    });
    assert.equal(res.status, 502);
  } finally {
    await close();
  }
});
