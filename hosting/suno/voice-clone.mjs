// Beta: speaker similarity, accent and emotional delivery are not guaranteed.
import { isValidLanguage } from './sarvam.mjs';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export class VoiceCloneError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'VoiceCloneError';
    this.status = status;
  }
}

function decodeWav(value, status = 400) {
  if (typeof value !== 'string' || !value || value.length > Math.ceil(MAX_AUDIO_BYTES / 3) * 4 || !BASE64.test(value)) {
    throw new VoiceCloneError('Provide a valid WAV recording smaller than 10 MB.', status);
  }
  const audio = Buffer.from(value, 'base64');
  if (audio.length > MAX_AUDIO_BYTES || audio.length < 44 || audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE') {
    throw new VoiceCloneError('The recording must be a valid WAV file.', status);
  }
  return audio;
}

function referenceDuration(audio) {
  let byteRate = 0;
  let dataBytes = 0;
  let validFormat = false;
  for (let offset = 12; offset + 8 <= audio.length;) {
    const type = audio.toString('ascii', offset, offset + 4);
    const size = audio.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + size > audio.length) throw new VoiceCloneError('The WAV recording is incomplete.');
    if (type === 'fmt ' && size >= 16) {
      const format = audio.readUInt16LE(start);
      const channels = audio.readUInt16LE(start + 2);
      const sampleRate = audio.readUInt32LE(start + 4);
      byteRate = audio.readUInt32LE(start + 8);
      const blockAlign = audio.readUInt16LE(start + 12);
      const bits = audio.readUInt16LE(start + 14);
      validFormat = [1, 3].includes(format) && [1, 2].includes(channels) && sampleRate > 0 && bits > 0 && blockAlign === channels * bits / 8 && byteRate === sampleRate * blockAlign;
    }
    if (type === 'data') dataBytes += size;
    offset = start + size + (size % 2);
  }
  if (!validFormat || !byteRate || !dataBytes) throw new VoiceCloneError('Use an uncompressed PCM or float WAV recording with a readable duration.');
  return dataBytes / byteRate;
}

export async function cloneNewsVoice({apiKey, fetchImpl = fetch, text, languageCode, referenceAudio, consent, timeoutMs = 30000} = {}) {
  if (consent !== true) throw new VoiceCloneError('Confirm that this is your voice and consent to Sarvam processing it.');
  if (typeof text !== 'string' || !text.trim() || [...text.trim()].length > 1000) throw new VoiceCloneError('Text must contain 1 to 1,000 characters.');
  if (!isValidLanguage(languageCode) && languageCode !== 'od-IN') throw new VoiceCloneError('Choose a supported language.');
  const recording = decodeWav(referenceAudio);
  const duration = referenceDuration(recording);
  if (duration < 1 || duration > 15) throw new VoiceCloneError('Use a single-speaker WAV recording between 1 and 15 seconds; 10–15 seconds is recommended.');
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new VoiceCloneError('Voice cloning is not configured.', 503);

  const form = new FormData();
  form.append('ref_audio', new Blob([recording], {type: 'audio/wav'}), 'reference.wav');
  form.append('text', text.trim());
  form.append('language_code', languageCode === 'or-IN' ? 'od-IN' : languageCode);
  form.append('output_audio_codec', 'wav');
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new VoiceCloneError('Voice cloning timed out. Standard narration is still available.', 504));
    }, timeoutMs);
  });
  try {
    const operation = (async () => {
      const response = await fetchImpl('https://api.sarvam.ai/voices/clone', {
        method: 'POST', headers: {'api-subscription-key': apiKey}, body: form, signal: controller.signal
      });
      if (!response?.ok) throw new VoiceCloneError('Voice cloning is unavailable. Standard narration is still available.', 502);
      const result = await response.json();
      const audioBase64 = result?.audio_b64 || result?.audio;
      decodeWav(audioBase64, 502);
      return {audioBase64, mimeType: 'audio/wav'};
    })();
    return await Promise.race([operation, timeout]);
  } catch (error) {
    if (error instanceof VoiceCloneError) throw error;
    throw new VoiceCloneError('Voice cloning could not be completed. Standard narration is still available.', 502);
  } finally {
    clearTimeout(timer);
  }
}
