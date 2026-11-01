(() => {
  'use strict';
  function init() {
    const input = document.querySelector('#news-voice-file');
    if (!input || document.querySelector('#news-record-voice')) return;
    const box = document.createElement('div');
    box.className = 'voice-recorder';
    const record = document.createElement('button');
    record.id = 'news-record-voice'; record.type = 'button'; record.className = 'btn btn-secondary';
    record.textContent = 'Record my voice (12 seconds)';
    const stop = document.createElement('button');
    stop.type = 'button'; stop.className = 'btn btn-secondary'; stop.textContent = 'Stop recording'; stop.hidden = true;
    const status = document.createElement('p'); status.className = 'news-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    box.append(record, stop, status); input.after(box);
    let stream, context, source, processor, silent, timer, recording = false, pending = false, frames = [], samples = 0, started = 0, generation = 0;
    const sync = () => { record.disabled = input.disabled || recording || pending; };
    new MutationObserver(sync).observe(input, {attributes:true, attributeFilter:['disabled']});
    function cleanup() {
      clearInterval(timer); timer = undefined;
      if (processor) { processor.onaudioprocess = null; processor.disconnect(); }
      if (source) source.disconnect();
      if (silent) silent.disconnect();
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (context) context.close().catch(() => {});
      stream = context = source = processor = silent = undefined;
      recording = pending = false; stop.hidden = true; sync();
    }
    function wav(rate) {
      const buffer = new ArrayBuffer(44 + samples * 2), view = new DataView(buffer);
      const text = (offset, value) => { for (let i=0;i<value.length;i++) view.setUint8(offset+i,value.charCodeAt(i)); };
      text(0,'RIFF'); view.setUint32(4,36+samples*2,true); text(8,'WAVE'); text(12,'fmt '); view.setUint32(16,16,true);
      view.setUint16(20,1,true); view.setUint16(22,1,true); view.setUint32(24,rate,true); view.setUint32(28,rate*2,true);
      view.setUint16(32,2,true); view.setUint16(34,16,true); text(36,'data'); view.setUint32(40,samples*2,true);
      let offset = 44;
      for (const frame of frames) for (const value of frame) { const n=Math.max(-1,Math.min(1,value));view.setInt16(offset,n<0?n*32768:n*32767,true);offset+=2; }
      return new File([buffer], 'my-voice-sample.wav', {type:'audio/wav'});
    }
    function finish(save=true) {
      generation++;
      if (!recording) { cleanup(); return; }
      const rate = context.sampleRate;
      let file;
      if (save && samples >= rate) file = wav(rate);
      cleanup(); frames=[]; samples=0;
      if (!save) return;
      if (!file) { status.textContent='Recording was too short. Please record at least one second.'; return; }
      try {
        const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files; input.dispatchEvent(new Event('change', {bubbles:true}));
        status.textContent='Voice sample ready. Nothing has been uploaded. Confirm consent before creating your reading.';
      } catch { status.textContent='Unable to attach this recording. Please choose a WAV file instead.'; }
    }
    record.addEventListener('click', async () => {
      if (input.disabled || recording || pending) return;
      if (!navigator.mediaDevices?.getUserMedia || !(window.AudioContext || window.webkitAudioContext)) { status.textContent='Microphone recording is unavailable in this browser. Choose a WAV file instead.'; return; }
      pending=true; sync(); const token=++generation;
      status.textContent='Allow microphone access, then speak clearly in your natural voice. Only you should speak.';
      try {
        const granted = await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true}});
        if (token!==generation || input.disabled) { granted.getTracks().forEach(t=>t.stop()); cleanup(); return; }
        stream=granted; context=new (window.AudioContext || window.webkitAudioContext)(); await context.resume();
        if (token!==generation) { cleanup(); return; }
        source=context.createMediaStreamSource(stream); processor=context.createScriptProcessor(4096,1,1); silent=context.createGain(); silent.gain.value=0;
        frames=[]; samples=0; const limit=Math.floor(context.sampleRate*12);
        processor.onaudioprocess = event => {
          if (!recording) return;
          const data=event.inputBuffer.getChannelData(0); const chunk=data.slice(0,Math.max(0,limit-samples)); frames.push(chunk); samples+=chunk.length;
          if (samples>=limit) finish();
        };
        source.connect(processor); processor.connect(silent); silent.connect(context.destination);
        pending=false; recording=true; started=Date.now(); stop.hidden=false; sync();
        const tick=()=>{const elapsed=Math.min(12,Math.floor((Date.now()-started)/1000));status.textContent=`Recording: ${elapsed} / 12 seconds. Speak clearly; one speaker only.`;if(elapsed>=12)finish();};
        tick(); timer=setInterval(tick,250);
      } catch { cleanup(); status.textContent='Microphone access was denied or unavailable. Allow microphone access and try again, or choose a WAV file.'; }
    });
    stop.addEventListener('click',()=>finish());
    window.addEventListener('pagehide',()=>finish(false));
    window.addEventListener('beforeunload',()=>finish(false));
    sync();
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
