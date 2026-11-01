import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.mjs';

async function serve(t, options = {}) {
  const server = createServer({ apiKey: '', fetchImpl: async () => { throw new Error('Unexpected upstream call'); }, ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

function referenceWav() {
  const audio = Buffer.alloc(44 + 32000);
  audio.write('RIFF', 0); audio.writeUInt32LE(audio.length - 8, 4); audio.write('WAVE', 8);
  audio.write('fmt ', 12); audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20);
  audio.writeUInt16LE(1, 22); audio.writeUInt32LE(16000, 24); audio.writeUInt32LE(32000, 28);
  audio.writeUInt16LE(2, 32); audio.writeUInt16LE(16, 34); audio.write('data', 36); audio.writeUInt32LE(32000, 40);
  return audio.toString('base64');
}

const input = () => ({text: 'A short public headline.', languageCode: 'en-IN', referenceAudio: referenceWav(), consent: true});
const post = (base, data, headers = {}) => fetch(`${base}/api/news-voice`, {
  method: 'POST', headers: {'content-type':'application/json', ...headers}, body: JSON.stringify(data)
});

test('news route returns sourced headlines and timestamps from injected RSS', async t => {
  let upstreamCalls = 0;
  const base = await serve(t, {fetchImpl: async url => {
    upstreamCalls++;
    assert.equal(url, 'https://feeds.bbci.co.uk/news/world/rss.xml');
    return {ok:true, text:async () => '<rss version="2.0"><channel><item><title><![CDATA[Research &amp; discovery]]></title><description>A short public description.</description><link>https://www.bbc.com/news/articles/test-story</link><pubDate>Sun, 01 Nov 2026 08:00:00 GMT</pubDate></item></channel></rss>'};
  }});
  const response = await fetch(`${base}/api/news?topic=world`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(upstreamCalls, 1);
  assert.equal(data.items[0].title, 'Research & discovery');
  assert.equal(data.items[0].source, 'BBC News');
  assert.equal(data.items[0].publishedAt, '2026-11-01T08:00:00.000Z');
  assert.equal(data.topic, 'world');
  assert.ok(Number.isFinite(Date.parse(data.fetchedAt)));
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('news route rejects unsupported topics without calling upstream', async t => {
  const base = await serve(t);
  const response = await fetch(`${base}/api/news?topic=arbitrary-url`);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'Choose a supported topic.');
});

test('clone route reports missing configuration only after valid input', async t => {
  const base = await serve(t);
  const response = await post(base, input());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {error:'Voice service is not configured.'});
});

test('clone route requires explicit voice processing consent', async t => {
  const base = await serve(t, {apiKey:'test-only'});
  const response = await post(base, {...input(), consent:false});
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /consent/i);
});

test('clone route blocks requests originating from another website', async t => {
  const base = await serve(t, {apiKey:'test-only'});
  const response = await post(base, input(), {origin:'https://another-site.example'});
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'A same-origin JSON request is required.');
});

test('clone route rejects malformed JSON', async t => {
  const base = await serve(t, {apiKey:'test-only'});
  const response = await fetch(`${base}/api/news-voice`, {method:'POST', headers:{'content-type':'application/json'}, body:'{broken'});
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {error:'Invalid JSON.'});
});
