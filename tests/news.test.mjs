import test from 'node:test';
import assert from 'node:assert/strict';
import { getNews, parseNewsFeed } from '../lib/news.mjs';

const xml = `<rss version="2.0"><channel><item><title><![CDATA[Science &amp; people]]></title><description><![CDATA[<b>Real</b> description &#x1f30d;]]></description><link>https://www.bbc.com/news/articles/example</link><pubDate>Sun, 01 Nov 2026 10:00:00 GMT</pubDate></item></channel></rss>`;

test('RSS fields decode entities and remove HTML; publication time remains sourced', () => {
  const [item] = parseNewsFeed(xml);
  assert.equal(item.title, 'Science & people');
  assert.equal(item.description, 'Real description 🌍');
  assert.equal(item.source, 'BBC News');
  assert.equal(item.publishedAt, '2026-11-01T10:00:00.000Z');
});

test('bad links are dropped; missing date is not replaced with current time', () => {
  const item = '<item><title>Headline</title><link>https://www.bbc.com/news/a</link></item>';
  const items = parseNewsFeed(`<rss><channel><item><title>Unsafe</title><link>javascript:alert(1)</link></item>${item}${item}</channel></rss>`);
  assert.equal(items.length, 1);
  assert.equal(items[0].publishedAt, null);
});

test('feed limits returned stories to five and rejects malformed feeds', () => {
  const items = Array.from({length:8}, (_,i)=>`<item><title>Story ${i}</title><link>https://www.bbc.com/news/${i}</link></item>`).join('');
  assert.equal(parseNewsFeed(`<rss><channel>${items}</channel></rss>`).length, 5);
  assert.throws(()=>parseNewsFeed('<html>not RSS</html>'), /unreadable/);
  assert.throws(()=>parseNewsFeed('<rss></rss>'), /usable/);
});

test('fixed topic mapping, server caching and expiry', async () => {
  let count = 0;
  const fetchImpl = async (url)=>{ count++; assert.equal(url, 'https://feeds.bbci.co.uk/news/technology/rss.xml'); return {ok:true,text:async()=>xml}; };
  const first = await getNews({topic:'technology',fetchImpl,now:100000});
  first.items[0].title = 'mutated';
  const cached = await getNews({topic:'technology',fetchImpl,now:100001});
  assert.equal(count,1);
  assert.equal(cached.items[0].title,'Science & people');
  await getNews({topic:'technology',fetchImpl,now:160001});
  assert.equal(count,2);
});

test('invalid topic rejects before a network request', async () => {
  await assert.rejects(getNews({topic:'https://untrusted.test',fetchImpl:()=>{throw Error('should not fetch');}}), error=>error.code==='BAD_TOPIC');
});

test('upstream errors and body timeouts are bounded and honest', async () => {
  await assert.rejects(getNews({fetchImpl:async()=>({ok:false,status:500})}), /temporarily unavailable/);
  await assert.rejects(getNews({fetchImpl:async()=>({ok:true,text:async()=>new Promise(()=>{})}),timeoutMs:10}), error=>error.code==='NEWS_TIMEOUT');
  await assert.rejects(getNews({fetchImpl:async()=>new Promise(()=>{}),timeoutMs:10}), error=>error.code==='NEWS_TIMEOUT');
});
