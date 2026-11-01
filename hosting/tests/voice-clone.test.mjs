import test from 'node:test';
import assert from 'node:assert/strict';
import {cloneNewsVoice} from '../lib/voice-clone.mjs';

function wav(seconds = 2) {
  const sampleRate = 8000, byteRate = sampleRate * 2;
  const audio = Buffer.alloc(44 + byteRate * seconds);
  audio.write('RIFF', 0); audio.writeUInt32LE(audio.length - 8, 4); audio.write('WAVE', 8);
  audio.write('fmt ', 12); audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20);
  audio.writeUInt16LE(1, 22); audio.writeUInt32LE(sampleRate, 24); audio.writeUInt32LE(byteRate, 28);
  audio.writeUInt16LE(2, 32); audio.writeUInt16LE(16, 34); audio.write('data', 36);
  audio.writeUInt32LE(audio.length - 44, 40);
  return audio.toString('base64');
}
const base = {apiKey: 'mock-key', text: 'A brief news headline.', languageCode: 'hi-IN', referenceAudio: wav(), consent: true};

test('clone uses multipart, explicit consent, mapped Odia language and response audio', async () => {
  let calls = 0;
  const result = await cloneNewsVoice({...base, languageCode: 'or-IN', fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.sarvam.ai/voices/clone');
    assert.equal(options.headers['api-subscription-key'], 'mock-key');
    assert.equal(options.headers['Content-Type'], undefined);
    assert.equal(options.body.get('language_code'), 'od-IN');
    assert.equal(options.body.get('text'), base.text);
    assert.equal(options.body.get('output_audio_codec'), 'wav');
    assert.equal(options.body.get('ref_audio').type, 'audio/wav');
    return {ok: true, json: async () => ({audio_b64: wav(1)})};
  }});
  assert.equal(calls, 1);
  assert.equal(result.mimeType, 'audio/wav');
  assert.ok(result.audioBase64);
});

test('input validation rejects consent, text, language and malformed audio without a call', async () => {
  for (const invalid of [{consent:false}, {consent:'true'}, {text:''}, {text:'x'.repeat(1001)}, {languageCode:'xx'}, {referenceAudio:'not base64'}, {referenceAudio:Buffer.from('not wav').toString('base64')}, {referenceAudio:wav(16)}, {referenceAudio:wav(0)}, {referenceAudio:'A'.repeat(14_000_000)}]) {
    await assert.rejects(cloneNewsVoice({...base,...invalid,fetchImpl:()=>assert.fail('No provider calls for invalid input')}), error => error.status === 400);
  }
});

test('missing key fails locally', async () => {
  await assert.rejects(cloneNewsVoice({...base,apiKey:'',fetchImpl:()=>assert.fail()}), error => error.status === 503);
});

test('provider error is sanitized and makes no retries', async () => {
  let calls=0;
  await assert.rejects(cloneNewsVoice({...base,fetchImpl:async()=>{calls++; return {ok:false,status:403,json:()=>{throw Error('secret provider error')}};}}), error => error.status===502 && !error.message.includes('secret'));
  assert.equal(calls,1);
});

test('malformed upstream audio and JSON become sanitized errors', async () => {
  for (const result of [{audio_b64:'broken'}, {audio_b64:null}, {audio_b64:Buffer.from('hello').toString('base64')}]) {
    await assert.rejects(cloneNewsVoice({...base,fetchImpl:async()=>({ok:true,json:async()=>result})}),error=>error.status===502);
  }
  await assert.rejects(cloneNewsVoice({...base,fetchImpl:async()=>({ok:true,json:async()=>{throw Error('private detail')}})}),error=>error.status===502&&!error.message.includes('private'));
});

test('timeout covers fetch and JSON response parsing', async () => {
  for (const fetchImpl of [async()=>new Promise(()=>{}),async()=>({ok:true,json:async()=>new Promise(()=>{})})]) {
    await assert.rejects(cloneNewsVoice({...base,timeoutMs:10,fetchImpl}),error=>error.status===504);
  }
});

test('legacy audio response is accepted', async()=>{
  const result=await cloneNewsVoice({...base,fetchImpl:async()=>({ok:true,json:async()=>({audio:wav()})})});
  assert.equal(result.audioBase64,wav());
});
