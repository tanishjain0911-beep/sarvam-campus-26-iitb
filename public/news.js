(() => {
  'use strict';
  const reader = document.querySelector('.app-main');
  const header = document.querySelector('.header-container');
  if (!reader || !header) return;
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const store = {get(k, fallback) {try {return localStorage.getItem(k) || fallback;} catch {return fallback;}}, set(k,v) {try {localStorage.setItem(k,v);} catch {}}};
  const nav = el('nav', 'mode-switch'); nav.setAttribute('aria-label','Choose Suno mode');
  const readerButton = el('button','mode-button','Text Reader'); readerButton.type='button';
  const newsButton = el('button','mode-button','News Mirror'); newsButton.type='button';
  const newBadge=el('span','new-mode-badge','NEW'); newsButton.append(newBadge);
  nav.append(readerButton,newsButton); header.querySelector('.brand-bar').after(nav);
  const section=el('main','news-mode'); section.id='news-mode'; section.hidden=true;
  section.innerHTML=`<div class="news-shell">
    <div class="news-intro"><div><p class="news-eyebrow">YOUR WORLD. YOUR LANGUAGE. YOUR VOICE.</p><h2>Your personal listening edition.</h2><p>Choose what matters to you. Hear current headlines in your language, with an optional AI recreation of your own voice.</p></div><span class="news-edition-mark" aria-hidden="true">N / M</span></div>
    <div class="news-controls"><div><label for="news-topic">Your interests</label><select id="news-topic"><option value="world">World affairs</option><option value="technology">Technology</option><option value="science">Science & environment</option><option value="business">Business</option></select></div><div><label for="news-language">Your listening language</label><select id="news-language"></select></div><button type="button" id="news-refresh" class="btn btn-secondary">Refresh headlines</button></div>
    <div class="news-feed-meta"><span id="news-freshness">Headlines update from the source.</span><span class="news-poll-note">Checks every minute while this view is open</span></div>
    <p id="news-status" class="news-status" role="status" aria-live="polite"></p>
    <div class="news-layout"><section class="news-feed" aria-label="Current news headlines"><div id="news-cards" class="news-cards"></div></section>
    <aside class="news-listening card" aria-labelledby="news-listening-title"><p class="news-eyebrow">THE LISTENING ROOM</p><h3 id="news-listening-title">A familiar way to hear the world.</h3><p class="news-listen-hint">Choose a headline to create a short spoken reading. Your first reading uses Sarvam's standard voice.</p>
      <div id="news-output" hidden><span id="news-audio-kind" class="badge">Standard voice</span><h4 id="news-output-title"></h4><p id="news-output-text" class="news-output-text"></p><audio id="news-audio" controls preload="metadata"></audio></div>
      <p id="news-audio-status" class="news-status" role="status" aria-live="polite"></p>
      <div class="voice-mirror-box"><span class="voice-beta">OPTIONAL · BETA</span><h4>Make it sound more like you.</h4><p>Upload a clean, single-speaker WAV recording of yourself, ideally 10–15 seconds. Accent and expression matching can vary.</p><label for="news-voice-file" class="voice-file-label">Your voice sample (WAV, up to 10 MB)</label><input id="news-voice-file" type="file" accept=".wav,audio/wav,audio/x-wav"><label class="news-consent"><input type="checkbox" id="news-voice-consent"><span>This is my voice, and I consent to sending this recording to Sarvam to generate an AI recreation for this reading.</span></label><button type="button" id="news-clone" class="btn btn-primary" disabled>Read in my voice (beta)</button><p class="voice-private-note">Used only when you press the button. No sample is uploaded just by selecting it.</p></div>
    </aside></div>
    <p class="news-transparency">A listening aid, not a news publisher. Headlines and excerpts come from linked sources; publication times belong to the publisher. Translations and voices are AI-generated. New stories depend on source updates.</p>
  </div>`;
  reader.before(section);
  const $=s=>section.querySelector(s);
  const topic=$('#news-topic'),language=$('#news-language'),cards=$('#news-cards'),status=$('#news-status'),freshness=$('#news-freshness'),refresh=$('#news-refresh');
  const audio=$('#news-audio'),audioStatus=$('#news-audio-status'),output=$('#news-output'),sample=$('#news-voice-file'),consent=$('#news-voice-consent'),clone=$('#news-clone');
  const languageOptions=[['en-IN','English'],['hi-IN','हिन्दी · Hindi'],['bn-IN','বাংলা · Bengali'],['gu-IN','ગુજરાતી · Gujarati'],['kn-IN','ಕನ್ನಡ · Kannada'],['ml-IN','മലയാളം · Malayalam'],['mr-IN','मराठी · Marathi'],['or-IN','ଓଡ଼ିଆ · Odia'],['pa-IN','ਪੰਜਾਬੀ · Punjabi'],['ta-IN','தமிழ் · Tamil'],['te-IN','తెలుగు · Telugu']];
  for(const [value,name] of languageOptions) {const o=el('option','',name);o.value=value;language.append(o);}
  const savedTopic=store.get('suno_news_topic','technology'); if([...topic.options].some(o=>o.value===savedTopic))topic.value=savedTopic;
  const savedLanguage=store.get('suno_news_language','hi-IN'); if(languageOptions.some(o=>o[0]===savedLanguage))language.value=savedLanguage;
  let active=false,fetching=false,busy=false,prepared=null,audioUrl=null,feedController=null,feedVersion=0;
  const dateLabel=value=>{if(!value)return 'Publication time unavailable';const d=new Date(value);return Number.isNaN(d.getTime())?'Publication time unavailable':d.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});};
  function cloneState() {clone.disabled=busy||!prepared||!sample.files?.[0]||!consent.checked;}
  function setBusy(value) {busy=value;language.disabled=value;sample.disabled=value;consent.disabled=value;for(const b of cards.querySelectorAll('button'))b.disabled=value;cloneState();}
  function stopAudio() {audio.pause();audio.removeAttribute('src');audio.load();if(audioUrl)URL.revokeObjectURL(audioUrl);audioUrl=null;}
  function setAudio(base64,mime) {
    if(typeof base64!=='string'||!base64)throw Error('No audio was returned.');
    const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
    stopAudio();audioUrl=URL.createObjectURL(new Blob([bytes],{type:mime||'audio/wav'}));audio.src=audioUrl;
  }
  async function fetchNews() {
    if(fetching||!active||document.hidden)return;
    fetching=true;refresh.disabled=true;const version=++feedVersion;feedController=new AbortController();status.textContent='Checking the publisher for current headlines…';
    try {
      const r=await fetch('/api/news?topic='+encodeURIComponent(topic.value),{signal:feedController.signal});
      const data=await r.json();if(!r.ok)throw Error(data.error||'Headlines are unavailable right now.');
      if(version!==feedVersion)return;
      cards.replaceChildren();
      for(const item of (data.items||[]).slice(0,5)) {
        let sourceUrl;try{sourceUrl=new URL(item.url);if(sourceUrl.protocol!=='https:')continue;}catch{continue;}
        const card=el('article','news-story');
        const meta=el('div','news-story-meta');meta.append(el('span','news-source',item.source||'News source'),el('time','',dateLabel(item.publishedAt)));
        const title=el('h3','',String(item.title||''));const description=el('p','news-excerpt',String(item.description||''));
        const actions=el('div','news-story-actions');const listen=el('button','btn btn-primary','Listen in my language');listen.type='button';listen.disabled=busy;listen.addEventListener('click',()=>listenStory(item));
        const source=el('a','news-source-link','Read original ↗');source.href=sourceUrl.href;source.target='_blank';source.rel='noopener noreferrer';
        actions.append(listen,source);card.append(meta,title,description,actions);cards.append(card);
      }
      freshness.textContent='Last checked '+dateLabel(data.fetchedAt||new Date().toISOString());
      status.textContent=cards.children.length?'Choose a story to hear your edition.':'No current headlines were returned. Try another topic.';
    } catch(error) {if(version===feedVersion&&error.name!=='AbortError')status.textContent=error.message||'Cannot load headlines. Please try again.';}finally{if(version===feedVersion){fetching=false;refresh.disabled=false;}}
  }
  async function listenStory(item) {
    if(busy)return;setBusy(true);prepared=null;stopAudio();output.hidden=true;audioStatus.textContent='Preparing this headline in your listening language…';
    const target=language.value;
    try {
      const text=Array.from(String(item.title||'')+'. '+String(item.description||'')).slice(0,650).join('');
      const r=await fetch('/api/read',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,sourceLanguage:'en-IN',targetLanguage:target})});
      const data=await r.json();
      if(typeof data.text==='string'&&data.text.trim()) {
        prepared={text:data.text,languageCode:target,title:String(item.title||'')};
        $('#news-output-title').textContent=prepared.title;$('#news-output-text').textContent=prepared.text;$('#news-output-text').lang=target;output.hidden=false;
      }
      if(!r.ok)throw Error(data.error||'This reading could not be created.');
      setAudio(data.audioBase64,data.mimeType);$('#news-audio-kind').textContent='Standard voice · AI-generated';
      audioStatus.textContent='Your reading is ready. Press play to listen.';
    }catch(error){audioStatus.textContent=error.message||'Unable to create this reading.';}finally{setBusy(false);}
  }
  async function cloneReading() {
    if(busy||!prepared||!consent.checked)return;
    const file=sample.files?.[0];if(!file)return;
    if(!/\.wav$/i.test(file.name)||file.size>10*1024*1024||file.size<44){audioStatus.textContent='Choose a WAV recording no larger than 10 MB, with one speaker and at most 15 seconds.';return;}
    setBusy(true);audioStatus.textContent='Creating an AI version of your voice. Your standard reading stays available while you wait…';
    try {
      const bytes=new Uint8Array(await file.arrayBuffer());let raw='';for(let i=0;i<bytes.length;i+=32768)raw+=String.fromCharCode(...bytes.subarray(i,i+32768));
      if(!consent.checked||sample.files?.[0]!==file)throw Error('Voice permission changed. Please confirm your sample again.');
      const r=await fetch('/api/news-voice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:prepared.text,languageCode:prepared.languageCode,referenceAudio:btoa(raw),consent:true})});
      const data=await r.json();if(!r.ok)throw Error(data.error||'Your voice reading could not be generated.');
      setAudio(data.audioBase64,data.mimeType);$('#news-audio-kind').textContent='Your voice · AI recreation';audioStatus.textContent='Your AI voice reading is ready. Voice likeness and accent may vary.';
    }catch(error){audioStatus.textContent=(error.message||'Voice generation failed.')+(audioUrl?' Your standard audio remains available.':' Your prepared text remains readable.');}finally{setBusy(false);}
  }
  function setMode(news) {
    active=news;section.hidden=!news;reader.hidden=news;readerButton.setAttribute('aria-pressed',String(!news));newsButton.setAttribute('aria-pressed',String(news));
    if(!news){audio.pause();feedVersion++;fetching=false;refresh.disabled=false;if(feedController)feedController.abort();}else fetchNews();
  }
  readerButton.addEventListener('click',()=>setMode(false));newsButton.addEventListener('click',()=>setMode(true));
  refresh.addEventListener('click',fetchNews);
  topic.addEventListener('change',()=>{store.set('suno_news_topic',topic.value);if(feedController)feedController.abort();fetching=false;fetchNews();});
  language.addEventListener('change',()=>{store.set('suno_news_language',language.value);prepared=null;stopAudio();output.hidden=true;consent.checked=false;cloneState();audioStatus.textContent='Language changed. Choose a headline to create a new reading.';});
  sample.addEventListener('change',()=>{consent.checked=false;cloneState();});consent.addEventListener('change',cloneState);clone.addEventListener('click',cloneReading);
  setInterval(()=>{if(active&&!document.hidden)fetchNews();},60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active)fetchNews();});
  window.addEventListener('pagehide',()=>{if(audioUrl)URL.revokeObjectURL(audioUrl);if(feedController)feedController.abort();});
  setMode(true);
})();
