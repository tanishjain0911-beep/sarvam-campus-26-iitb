import test from 'node:test';
import assert from 'node:assert/strict';
import {getNews, CITY_FEEDS, NEWS_FEEDS} from '../lib/news.mjs';
const rss=(host,prefix='National',date='')=>'<rss><channel>'+Array.from({length:7},(_,i)=>`<item><title>${prefix} headline ${i}</title><link>https://${host}/${prefix}/${i}</link>${date?'<pubDate>'+date+'</pubDate>':''}</item>`).join('')+'</channel></rss>';
function provider({localFailure=false,nationalFailure=false,oldLocal=false}={}) {
 return async url=>{
   const city=Object.values(CITY_FEEDS).find(c=>c.source.url===url);
   if(city)return localFailure?{ok:false,status:503}:{ok:true,text:async()=>rss(city.source.hosts[0],city.label,oldLocal?'Mon, 01 Jan 2018 00:00:00 GMT':'')};
   const source=NEWS_FEEDS.india.find(s=>s.url===url);
   return nationalFailure?{ok:false,status:503}:{ok:true,text:async()=>rss(source.hosts[0],source.name)};
 };
}
test('city briefing keeps three national stories and adds two tagged local stories',async()=>{
 const r=await getNews({topic:'india',city:'mumbai',fetchImpl:provider()});
 assert.equal(r.items.length,5);assert.equal(r.localCount,2);assert.equal(r.cityLabel,'Mumbai');
 assert.equal(r.items.filter(i=>i.scope==='national').length,3);
 assert.ok(r.items.filter(i=>i.scope==='local').every(i=>i.city==='Mumbai'&&i.title.startsWith('Mumbai')));
});
test('cache keys isolate cities and national-only editions',async()=>{
 let count=0;const mock=provider();const fetchImpl=async(...args)=>{count++;return mock(...args);};
 await getNews({topic:'india',city:'mumbai',fetchImpl});assert.equal(count,4);
 const d=await getNews({topic:'india',city:'delhi',fetchImpl});assert.equal(count,8);assert.equal(d.cityLabel,'Delhi');
 await getNews({topic:'india',city:'mumbai',fetchImpl});assert.equal(count,8);
 const n=await getNews({topic:'india',fetchImpl});assert.equal(count,11);assert.equal(n.localCount,0);
});
test('failed local feed falls back to full national briefing with explicit status',async()=>{
 const r=await getNews({topic:'india',city:'mumbai',fetchImpl:provider({localFailure:true})});
 assert.equal(r.items.length,5);assert.equal(r.localCount,0);assert.equal(r.localStatus,'unavailable');
});
test('stale local stories are not presented as current city coverage',async()=>{
 const r=await getNews({topic:'india',city:'mumbai',fetchImpl:provider({oldLocal:true})});
 assert.equal(r.localStatus,'no-recent-headlines');assert.equal(r.localCount,0);assert.equal(r.items.length,5);
});
test('healthy local feed still works when national publishers fail',async()=>{
 const r=await getNews({topic:'india',city:'delhi',fetchImpl:provider({nationalFailure:true})});
 assert.equal(r.items.length,2);assert.equal(r.localCount,2);assert.equal(r.localStatus,'available');
});
test('unsupported cities and city requests outside India reject before fetching',async()=>{
 let calls=0;const fetchImpl=()=>{calls++;throw Error('unexpected');};
 for(const args of [{topic:'india',city:'https://example.test'},{topic:'world',city:'mumbai'},{topic:'india',city:'__proto__'}])await assert.rejects(getNews({...args,fetchImpl}),e=>e.code==='BAD_TOPIC');
 assert.equal(calls,0);
});
test('same national and local story is not counted twice',async()=>{
 const r=await getNews({topic:'india',city:'mumbai',fetchImpl:async url=>({ok:true,text:async()=>'<rss><channel><item><title>One national and local headline</title><link>https://www.hindustantimes.com/india-news/shared-story</link></item></channel></rss>'})});
 assert.equal(new Set(r.items.map(i=>i.url)).size,r.items.length);assert.equal(r.localCount,0);
});
