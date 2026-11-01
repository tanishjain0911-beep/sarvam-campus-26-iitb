// Transparent editorial signals, not a claim that importance can be measured objectively.
const STOP = new Set('the a an and or of in on at to for from with by is are was were be has have had as it its this that after before over amid says said new latest live updates news india indian story'.split(' '));
const SIGNALS = [
  {label:'Public safety',weight:30,pattern:/\b(earthquake|cyclone|floods?|tsunami|evacuat\w*|outbreak|pandemic|heatwave|air pollution|air quality|public health|emergency)\b/i},
  {label:'Policy & public life',weight:26,pattern:/\b(supreme court|parliament|election|budget|cabinet|constitution|national policy|legislation|ceasefire|peace talks|war|security breach)\b/i},
  {label:'Economy & livelihoods',weight:24,pattern:/\b(rbi|inflation|interest rates?|employment|unemployment|gdp|trade deal|tariffs?|tax reform|economic growth|fuel prices?|market crash)\b/i},
  {label:'Science & technology',weight:18,pattern:/\b(isro|space mission|climate|breakthrough|research|vaccine|cyberattack|data breach|artificial intelligence|ai regulation|ai safety)\b/i}
];
function tokens(title) {return new Set(title.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(t=>t.length>2&&!STOP.has(t)&&!/^\d+$/.test(t)));}
function similar(a,b) {
  if(a.title.toLowerCase()===b.title.toLowerCase()) return true;
  const x=tokens(a.title),y=tokens(b.title);let common=0;
  for(const word of x)if(y.has(word))common++;
  return common>=4 && common/(x.size+y.size-common)>=0.46;
}
function baseScore(item,position,now) {
  const time=Date.parse(item.publishedAt),hours=Number.isFinite(time)?Math.max(0,(now-time)/3600000):null;
  if(hours!==null&&hours>72||Number.isFinite(time)&&time>now+86400000)return null;
  const text=item.title; // Descriptions may mention historical events unrelated to the current headline.
  const signals=SIGNALS.filter(s=>s.pattern.test(text));
  let score=(hours===null?4:Math.max(0,32-hours*0.6))+Math.max(0,12-position*0.4);
  // Avoid allowing repeated keywords to overwhelm recency and publisher placement.
  score+=Math.max(0,...signals.map(s=>s.weight));
  if(/\b(horoscope|astrology|celebrity|box office|viral video|birthday wishes|shopping deals|best phones|review|opinion|editorial)\b/i.test(item.title))score-=40;
  if(/\b(arrested|stabbed|robbed|road accident|murder|brawl)\b/i.test(item.title)&&!signals.length)score-=18;
  return {score,reason:signals.sort((a,b)=>b.weight-a.weight)[0]?.label||'Publisher priority',hours};
}

export function rankNews(lists,{now=Date.now(),limit=5}={}) {
  const groups=[],seenUrls=new Set();
  for(const list of lists)for(const [position,item] of list.entries()) {
    if(seenUrls.has(item.url))continue;seenUrls.add(item.url);
    const rating=baseScore(item,position,now);if(!rating)continue;
    const existing=groups.find(group=>similar(group.item,item));
    if(existing){
      if(!existing.coverage.some(c=>c.source===item.source))existing.coverage.push({source:item.source,url:item.url});
      if(rating.score>existing.score){existing.item=item;existing.score=rating.score;existing.reason=rating.reason;}
    } else groups.push({item,score:rating.score,reason:rating.reason,coverage:[{source:item.source,url:item.url}]});
  }
  for(const group of groups)group.score+=Math.min(24,(group.coverage.length-1)*12);
  groups.sort((a,b)=>b.score-a.score||a.item.url.localeCompare(b.item.url));
  const selected=[],counts=new Map(),categories=new Map();
  // Prefer a varied briefing while allowing a major story to lead on its own merits.
  while(groups.length&&selected.length<limit){
    let index=groups.findIndex(g=>(counts.get(g.item.source)||0)<3&&(categories.get(g.reason)||0)<2&&g.score>=groups[0].score-22);
    if(index<0)index=groups.findIndex(g=>(counts.get(g.item.source)||0)<3);if(index<0)index=0;
    const [group]=groups.splice(index,1);counts.set(group.item.source,(counts.get(group.item.source)||0)+1);categories.set(group.reason,(categories.get(group.reason)||0)+1);
    selected.push({...group.item,selectionReason:group.coverage.length>1?'Covered by '+group.coverage.length+' publishers':group.reason,coverage:group.coverage});
  }
  return selected;
}
