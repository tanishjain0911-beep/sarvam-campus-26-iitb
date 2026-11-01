import { Buffer } from 'node:buffer';
import assets from './assets.mjs';
import { getNews } from './news.mjs';
import { cloneNewsVoice } from './voice-clone.mjs';
import { translateText, synthesizeSpeech, isValidLanguage, codePointLength } from './sarvam.mjs';

// Buffer is supplied explicitly for the shared Node-compatible validation code.
globalThis.Buffer ??= Buffer;
const headers = {
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer',
  'Permissions-Policy':'camera=(), microphone=(self), geolocation=()',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'"
};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const fail=(message,status=400)=>Object.assign(new Error(message),{status});

async function readJson(request,limit) {
  if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json') throw fail('Content-Type must be application/json.');
  const reader=request.body?.getReader();
  if(!reader) throw fail('Invalid JSON body.');
  let size=0; const chunks=[];
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw fail('Request is too large.');}chunks.push(value);}
  let parsed;
  try{parsed=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw fail('Invalid JSON body.');}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)) throw fail('Invalid request body.');
  return parsed;
}

export async function handleSuno(request, env={}, fetchImpl=fetch) {
  const url=new URL(request.url), route=url.pathname;
  const file=route==='/'?'index.html':route.slice(1);
  if(request.method==='GET'&&Object.hasOwn(assets,file)) {
    const type=file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript';
    return new Response(assets[file],{headers:{...headers,'Content-Type':`${type}; charset=utf-8`}});
  }
  if(route==='/api/health') return json({ok:true,configured:Boolean(env.SARVAM_API_KEY)});
  if(route==='/api/news'&&request.method==='GET') {
    try{return json(await getNews({topic:url.searchParams.get('topic')||'world',fetchImpl}));}
    catch(error){return json({error:error.code==='BAD_TOPIC'?'Choose a supported topic.':'News could not be refreshed. Please try again later.'},error.code==='BAD_TOPIC'?400:error.code==='NEWS_TIMEOUT'?504:502);}
  }
  if(route!=='/api/read'&&route!=='/api/news-voice') return json({error:'Not found.'},404);
  if(request.method!=='POST') return json({error:'Method not allowed.'},405);
  const origin=request.headers.get('origin');
  if(origin&&origin!==url.origin) return json({error:'Cross-origin request rejected.'},400);
  try {
    const data=await readJson(request,route==='/api/news-voice'?14*1024*1024:16*1024);
    const apiKey=env.SARVAM_API_KEY||'';
    if(route==='/api/news-voice') {
      try{return json(await cloneNewsVoice({apiKey,fetchImpl,text:data.text,languageCode:data.languageCode,referenceAudio:data.referenceAudio,consent:data.consent,timeoutMs:60000}));}
      catch(error){const status=[400,503,504].includes(error.status)?error.status:502;return json({error:status===400?error.message:status===503?'Voice service is not configured.':'The beta voice service could not create audio. Standard narration is still available.'},status);}
    }
    const {text,sourceLanguage,targetLanguage}=data;
    if(typeof text!=='string'||codePointLength(text.trim())<1||codePointLength(text.trim())>1000) throw fail('Text must be 1 to 1000 Unicode code points.');
    if(!isValidLanguage(sourceLanguage)||!isValidLanguage(targetLanguage)) throw fail('Invalid language code.');
    if(!apiKey) return json({error:'Service not configured.'},503);
    let finalText=text.trim(), translated=false;
    if(sourceLanguage!==targetLanguage) {
      try{finalText=(await translateText({fetchImpl,apiKey,text:finalText,sourceLanguage,targetLanguage,timeoutMs:30000})).trim();translated=true;}
      catch(error){return json({error:error.name==='AbortError'?'Translation service request timed out.':'Translation service request failed.'},error.name==='AbortError'?504:502);}
      if(codePointLength(finalText)<1||codePointLength(finalText)>1000) throw fail('Translated text must be 1 to 1000 Unicode code points.');
    }
    try{const audioBase64=await synthesizeSpeech({fetchImpl,apiKey,text:finalText,targetLanguage,timeoutMs:30000});return json({text:finalText,translated,audioBase64,mimeType:'audio/wav'});}
    catch{return json({error:'Speech service request failed.',text:finalText,translated},502);}
  }catch(error){return json({error:error.status===400?error.message:'Request could not be processed.'},error.status===400?400:500);}
}
