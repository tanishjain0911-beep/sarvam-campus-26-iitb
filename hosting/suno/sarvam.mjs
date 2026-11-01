export const LANGUAGE_CODES = [
  "en-IN",
  "hi-IN",
  "bn-IN",
  "gu-IN",
  "kn-IN",
  "ml-IN",
  "mr-IN",
  "or-IN",
  "pa-IN",
  "ta-IN",
  "te-IN"
];

export function isValidLanguage(code) {
  return typeof code === "string" && LANGUAGE_CODES.includes(code);
}

export function codePointLength(value) {
  if (typeof value !== "string") return 0;
  return [...value].length;
}

function timeoutError(label) {
  const error = new Error(`${label} request timed out.`);
  error.name = "AbortError";
  return error;
}

const BASE64_RE = /^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/;

export async function translateText({ fetchImpl, apiKey, text, sourceLanguage, targetLanguage, timeoutMs = 30000 }) {
  const controller = new AbortController();
  const label = "Translation service";
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(timeoutError(label));
    }, timeoutMs);
  });

  const operationPromise = (async () => {
    try {
      const response = await fetchImpl("https://api.sarvam.ai/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": apiKey
        },
        body: JSON.stringify({
          input: text,
          source_language_code: sourceLanguage,
          target_language_code: targetLanguage,
          model: "mayura:v1",
          mode: "formal",
          numerals_format: "international"
        }),
        signal: controller.signal
      });
      if (!response || typeof response.ok !== "boolean") {
        throw new Error("invalid_response");
      }
      if (!response.ok) {
        const error = new Error("http_error");
        error.upstreamStatus = response.status;
        throw error;
      }
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("invalid_json");
      }
      if (!data || typeof data.translated_text !== "string" || data.translated_text.trim() === "") {
        throw new Error("missing_field");
      }
      return { ok: true, value: data.translated_text };
    } catch (error) {
      return { ok: false, error };
    }
  })();

  try {
    const result = await Promise.race([operationPromise, timeoutPromise]);
    if (!result || !result.ok) {
      throw (result && result.error) || new Error("invalid_response");
    }
    return result.value;
  } catch (error) {
    if (error && error.name === "AbortError") throw timeoutError(label);
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function synthesizeSpeech({ fetchImpl, apiKey, text, targetLanguage, timeoutMs = 30000 }) {
  const controller = new AbortController();
  const label = "Speech service";
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(timeoutError(label));
    }, timeoutMs);
  });

  const operationPromise = (async () => {
    try {
      const response = await fetchImpl("https://api.sarvam.ai/text-to-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": apiKey
        },
        body: JSON.stringify({
          text,
          target_language_code: targetLanguage,
          speaker: "shubh",
          model: "bulbul:v3",
          speech_sample_rate: 24000,
          enable_preprocessing: true
        }),
        signal: controller.signal
      });
      if (!response || typeof response.ok !== "boolean") {
        throw new Error("invalid_response");
      }
      if (!response.ok) {
        const error = new Error("http_error");
        error.upstreamStatus = response.status;
        throw error;
      }
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("invalid_json");
      }
      if (!data || !Array.isArray(data.audios) || typeof data.audios[0] !== "string" || data.audios[0].trim() === "") {
        throw new Error("missing_field");
      }
      const audio = data.audios[0].trim();
      if (!BASE64_RE.test(audio)) {
        throw new Error("invalid_audio");
      }
      const decoded = Buffer.from(audio, "base64");
      if (
        decoded.length < 44 ||
        decoded.toString("ascii", 0, 4) !== "RIFF" ||
        decoded.toString("ascii", 8, 12) !== "WAVE"
      ) {
        throw new Error("invalid_audio");
      }
      return { ok: true, value: audio };
    } catch (error) {
      return { ok: false, error };
    }
  })();

  try {
    const result = await Promise.race([operationPromise, timeoutPromise]);
    if (!result || !result.ok) {
      throw (result && result.error) || new Error("invalid_response");
    }
    return result.value;
  } catch (error) {
    if (error && error.name === "AbortError") throw timeoutError(label);
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
