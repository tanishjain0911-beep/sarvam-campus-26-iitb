import test from 'node:test';
import assert from 'node:assert/strict';
import {rankNews} from '../lib/news-ranking.mjs';
const now=Date.parse('2026-11-01T12:00:00Z');
const item=(title,source='The Hindu',age=1,id=title)=>({title,source,description:'',url:'https://example.test/'+encodeURIComponent(id),publishedAt:new Date(now-age*3600000).toISOString()});

test('public policy and safety outrank routine local and celebrity headlines',()=>{
 const result=rankNews([[item('Celebrity birthday wishes go viral'),item('Police arrested suspect after local brawl'),item('RBI announces interest rate decision'),item('Cyclone warning triggers coastal evacuation')]],{now});
 assert.equal(result[0].selectionReason,'Public safety');
 assert.equal(result[1].selectionReason,'Economy & livelihoods');
});
test('stale and implausibly future stories are excluded',()=>{
 const result=rankNews([[item('Old national budget',undefined,80),item('Current research breakthrough'),item('Future election news',undefined,-48)]],{now});
 assert.equal(result.length,1);assert.equal(result[0].title,'Current research breakthrough');
});
test('similar reporting is grouped and links to distinct publishers are retained',()=>{
 const first=item('Supreme Court announces landmark privacy ruling today','The Hindu');
 const second=item('Supreme Court announces landmark privacy ruling','Hindustan Times',1,'other');
 const result=rankNews([[first],[second]],{now});
 assert.equal(result.length,1);assert.equal(result[0].coverage.length,2);
 assert.equal(result[0].selectionReason,'Covered by 2 publishers');
});
test('different events sharing generic political words remain distinct',()=>{
 const result=rankNews([[item('Government announces railway budget for northern regions'),item('Government announces new vaccine programme for children')]],{now});
 assert.equal(result.length,2);
});
test('cross-publisher coverage raises a story without inventing source agreement',()=>{
 const a=item('Climate research reveals rapid Antarctic glacier retreat','The Hindu',8);
 const b=item('Climate research reveals Antarctic glacier retreat','BBC News',8,'second');
 const result=rankNews([[item('Routine technology product launch'),a],[b]],{now});
 assert.equal(result[0].coverage.length,2);
 assert.deepEqual(new Set(result[0].coverage.map(c=>c.source)),new Set(['The Hindu','BBC News']));
 assert.equal(result[0].coverage.find(c=>c.source===result[0].source).url,result[0].url);
});
test('unknown dates stay unknown and an empty fresh edition is allowed',()=>{
 const missing={...item('Public update'),publishedAt:null};
 assert.equal(rankNews([[missing]],{now})[0].publishedAt,null);
 assert.deepEqual(rankNews([[item('Outdated report',undefined,100)]],{now}),[]);
});

test('historical references in descriptions do not create an emergency badge',()=>{const story={...item('Parties exchange remarks at political rally'),description:'A reference to the Emergency of 1975.'};assert.equal(rankNews([[story]],{now})[0].selectionReason,'Publisher priority');});
