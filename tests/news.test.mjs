import test from 'node:test';
import assert from 'node:assert/strict';
import { getNews, parseNewsFeed, NEWS_FEEDS } from '../lib/news.mjs';

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
  const fetchImpl = async (url)=>{ count++; assert.ok(NEWS_FEEDS.technology.some(source=>source.url===url)); return {ok:true,text:async()=>xml}; };
  const first = await getNews({topic:'technology',fetchImpl,now:1793534400000});
  first.items[0].title = 'mutated';
  const cached = await getNews({topic:'technology',fetchImpl,now:1793534400001});
  assert.equal(count,3);
  assert.equal(cached.items[0].title,'Science & people');
  await getNews({topic:'technology',fetchImpl,now:1793534460001});
  assert.equal(count,6);
});

test('invalid topic rejects before a network request', async () => {
  await assert.rejects(getNews({topic:'https://untrusted.test',fetchImpl:()=>{throw Error('should not fetch');}}), error=>error.code==='BAD_TOPIC');
});

test('upstream errors and body timeouts are bounded and honest', async () => {
  await assert.rejects(getNews({fetchImpl:async()=>({ok:false,status:500})}), /temporarily unavailable/);
  await assert.rejects(getNews({fetchImpl:async()=>({ok:true,text:async()=>new Promise(()=>{})}),timeoutMs:10}), error=>error.code==='NEWS_TIMEOUT');
  await assert.rejects(getNews({fetchImpl:async()=>new Promise(()=>{}),timeoutMs:10}), error=>error.code==='NEWS_TIMEOUT');
});


test('news fetch works with Worker redirect modes and rejects redirects without following', async () => {
  const fetchImpl = async (url, init) => {
    if (init.redirect === 'error') throw new TypeError('Unsupported redirect mode');
    assert.equal(init.redirect, 'manual');
    return {ok:true,text:async()=>xml};
  };
  assert.equal((await getNews({fetchImpl})).items.length, 1);
  let calls=0;
  await assert.rejects(getNews({fetchImpl:async(_url, init)=>{calls++;assert.equal(init.redirect,'manual');return {ok:false,status:302};}}), /temporarily unavailable/);
  assert.equal(calls,3);
});

const indianXml=(host, prefix='Story')=>'<rss><channel>'+Array.from({length:5},(_,i)=>'<item><title>'+prefix+' '+i+'</title><link>https://'+host+'/news/'+i+'</link><description>Public news snippet</description></item>').join('')+'</channel></rss>';
test('India edition mixes three correctly attributed Indian publishers',async()=>{
 const result=await getNews({topic:'india',fetchImpl:async url=>{const source=NEWS_FEEDS.india.find(s=>s.url===url);return {ok:true,text:async()=>indianXml(source.hosts[0],source.name)};}});
 assert.equal(result.items.length,5);
 assert.deepEqual(new Set(result.items.map(i=>i.source)),new Set(['The Indian Express','The Hindu','Hindustan Times']));
 assert.deepEqual(result.unavailableSources,[]);
});
test('a failed publisher does not suppress healthy publishers',async()=>{
 const result=await getNews({topic:'india',fetchImpl:async url=>url.includes('indianexpress')?{ok:false,status:503}:{ok:true,text:async()=>indianXml(url.includes('thehindu.com')?'www.thehindu.com':'www.hindustantimes.com')}});
 assert.equal(result.items.length,5);assert.deepEqual(result.unavailableSources,['The Indian Express']);assert.equal(result.sources.length,2);
});
test('publisher-scoped parsing prevents false attribution and untrusted links',()=>{
 assert.throws(()=>parseNewsFeed(xml,NEWS_FEEDS.india[0]),/usable/);
 assert.equal(parseNewsFeed(indianXml('indianexpress.com'),NEWS_FEEDS.india[0])[0].source,'The Indian Express');
 assert.throws(()=>parseNewsFeed(indianXml('indianexpress.com.evil.test'),NEWS_FEEDS.india[0]),/usable/);
});
test('a slow publisher times out while other headlines remain available',async()=>{
 const result=await getNews({topic:'india',timeoutMs:10,fetchImpl:async url=>url.includes('indianexpress')?new Promise(()=>{}):{ok:true,text:async()=>indianXml(url.includes('thehindu.com')?'www.thehindu.com':'www.hindustantimes.com')}});
 assert.equal(result.items.length,5);assert.deepEqual(result.unavailableSources,['The Indian Express']);
});
