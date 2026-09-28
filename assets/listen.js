// Listen: reads a page aloud with the browser's own speech voices.
// Works on any page: the page describes what to read with Listen.setup(),
// and puts a Listen button where it wants one with Listen.button(host).
(function () {
  const synth = window.speechSynthesis;
  const supported = !!(synth && window.SpeechSynthesisUtterance);

  // Words the voices tend to get wrong in the KJV.
  const SAY = [
    [/\bLORD\b/g, 'Lord'], [/\bGOD\b/g, 'God'], [/\bJEHOVAH\b/g, 'Jehovah'],
    [/\bJAH\b/g, 'Jah'], [/\bI AM\b/g, 'I am'], [/\bKJV\b/g, 'King James Version'],
    [/æ/g, 'e'], [/Æ/g, 'E'],
    [/\bMelchizedek\b/g, 'Mel-kizz-eh-deck'], [/\bMelchisedec\b/g, 'Mel-kizz-eh-deck'],
    [/\bMaher-shalal-hash-baz\b/g, 'Maher shalal hash baz'],
    [/\bZerubbabel\b/g, 'Zeh-rubba-bel'], [/\bNebuchadnezzar\b/g, 'Nebb-oo-kad-nezzar'],
    [/\bThessalonians\b/g, 'Thessa-lonians'], [/\bPhilemon\b/g, 'Fie-lee-mon'],
    [/\bRev\.\s/g, 'Revelation '], [/(\d+)[–-](\d+)/g, '$1 to $2'], [/(\d+):(\d+)/g, '$1 verse $2'],
  ];
  const clean = t => SAY.reduce((s, [re, to]) => s.replace(re, to), String(t)).replace(/\s+/g, ' ').trim();

  // Split long text at sentence ends so no single utterance runs too long
  // (some browsers stop speaking after about 15 seconds of one utterance).
  function pieces(text, max = 220) {
    const out = [];
    let rest = text;
    while (rest.length > max) {
      let cut = -1;
      for (const mark of ['. ', '; ', ': ', '? ', '! ', ', ']) {
        const i = rest.lastIndexOf(mark, max);
        if (i > 40) { cut = i + 1; break; }
      }
      if (cut < 0) cut = rest.lastIndexOf(' ', max);
      if (cut < 1) cut = max;
      out.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) out.push(rest);
    return out;
  }

  let cfg = null;          // {collect, onFinished}
  let queue = [];          // [{el, text}]
  let pos = 0;             // index into queue
  let playing = false;
  let token = 0;           // cancels stale callbacks
  let voice = null;
  let rate = 1;
  try { rate = parseFloat(localStorage.getItem('listen-rate')) || 1; } catch (e) {}

  // Voices: prefer the most natural English voice on this device.
  function rankVoice(v) {
    const n = v.name.toLowerCase();
    let s = 0;
    if (/^en[-_]us/i.test(v.lang)) s += 30; else if (/^en/i.test(v.lang)) s += 20; else return -1;
    if (/natural|neural|premium|enhanced|siri/.test(n)) s += 40;
    if (/google/.test(n)) s += 25;
    if (/samantha|ava|allison|evan|nathan|zoe|daniel|aaron|serena|jenny|guy|aria/.test(n)) s += 10;
    if (/compact|espeak|novelty|whisper|bad news|bells|boing|bubbles|cellos|zarvox|trinoids|albert|jester|organ|superstar/.test(n)) s -= 60;
    if (v.localService === false) s += 5;
    return s;
  }
  function englishVoices() {
    return synth.getVoices().filter(v => rankVoice(v) >= 0).sort((a, b) => rankVoice(b) - rankVoice(a));
  }
  function pickVoice() {
    const list = englishVoices();
    let saved = null;
    try { saved = localStorage.getItem('listen-voice'); } catch (e) {}
    voice = list.find(v => v.name === saved) || list[0] || null;
    fillVoices();
  }

  // Player bar
  let bar, btnPlay, selVoice, selRate, label;
  function buildBar() {
    if (bar) return;
    bar = document.createElement('div');
    bar.className = 'listen-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Audio player');
    bar.hidden = true;
    bar.innerHTML = `
      <button type="button" data-a="prev" aria-label="Back">⏮</button>
      <button type="button" data-a="play" class="main" aria-label="Pause">❚❚</button>
      <button type="button" data-a="next" aria-label="Skip ahead">⏭</button>
      <span class="listen-label" aria-live="polite"></span>
      <label class="listen-opt">Speed <select data-a="rate">${[0.8, 0.9, 1, 1.1, 1.25, 1.5].map(r => `<option value="${r}">${r}×</option>`).join('')}</select></label>
      <label class="listen-opt listen-voice">Voice <select data-a="voice"></select></label>
      <button type="button" data-a="stop" aria-label="Stop and close">✕</button>`;
    document.body.appendChild(bar);
    btnPlay = bar.querySelector('[data-a="play"]');
    selVoice = bar.querySelector('[data-a="voice"]');
    selRate = bar.querySelector('[data-a="rate"]');
    label = bar.querySelector('.listen-label');
    selRate.value = String(rate);
    bar.addEventListener('click', e => {
      const a = e.target.closest('button') && e.target.closest('button').dataset.a;
      if (a === 'play') playing ? pause() : resume();
      if (a === 'prev') jump(-1);
      if (a === 'next') jump(1);
      if (a === 'stop') stop();
    });
    selRate.addEventListener('change', () => {
      rate = parseFloat(selRate.value) || 1;
      try { localStorage.setItem('listen-rate', String(rate)); } catch (e) {}
      if (playing) speakFrom(pos);
    });
    selVoice.addEventListener('change', () => {
      voice = englishVoices().find(v => v.name === selVoice.value) || voice;
      try { localStorage.setItem('listen-voice', voice ? voice.name : ''); } catch (e) {}
      if (playing) speakFrom(pos);
    });
    fillVoices();
  }
  function fillVoices() {
    if (!selVoice) return;
    const list = englishVoices();
    selVoice.innerHTML = list.map(v => `<option value="${v.name.replace(/"/g, '&quot;')}">${v.name.replace(/</g, '&lt;')}</option>`).join('');
    if (voice) selVoice.value = voice.name;
    selVoice.closest('label').hidden = list.length < 2;
  }
  function showBar(on) {
    buildBar();
    bar.hidden = !on;
    document.body.classList.toggle('listening', on);
  }
  function setPlayButton() {
    if (btnPlay) {
      btnPlay.textContent = playing ? '❚❚' : '▶';
      btnPlay.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    }
    document.querySelectorAll('.listen-btn').forEach(b => {
      b.textContent = playing ? '❚❚ Pause' : (pos > 0 && queue.length ? '▶ Resume' : '▶ Listen');
    });
  }

  function highlight(el) {
    document.querySelectorAll('.speaking').forEach(x => x.classList.remove('speaking'));
    if (!el) return;
    el.classList.add('speaking');
    const r = el.getBoundingClientRect();
    const barH = bar && !bar.hidden ? bar.offsetHeight : 0;
    if (r.top < 70 || r.bottom > window.innerHeight - barH - 20) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function speakFrom(i) {
    const my = ++token;
    synth.cancel();
    pos = i;
    if (pos >= queue.length) { finish(); return; }
    const item = queue[pos];
    highlight(item.el);
    if (label) label.textContent = item.label || '';
    const parts = pieces(clean(item.text));
    let k = 0;
    const next = () => {
      if (my !== token) return;
      if (k >= parts.length) { speakFrom(pos + 1); return; }
      const u = new SpeechSynthesisUtterance(parts[k++]);
      if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-US';
      u.rate = rate;
      u.onend = () => { if (my === token) next(); };
      u.onerror = e => { if (my === token && e.error !== 'interrupted' && e.error !== 'canceled') next(); };
      synth.speak(u);
    };
    next();
  }

  function finish() {
    const done = cfg && cfg.onFinished;
    playing = false; setPlayButton(); highlight(null);
    if (done) done(); else { pos = 0; showBar(false); setPlayButton(); }
  }

  function play(from) {
    if (!supported || !cfg) return;
    if (!voice) pickVoice();
    if (!queue.length || from === 0) queue = cfg.collect().filter(x => x && x.text && x.text.trim());
    if (!queue.length) return;
    playing = true; showBar(true); setPlayButton();
    speakFrom(from == null ? pos : from);
  }
  function pause() { token++; synth.cancel(); playing = false; setPlayButton(); }
  function resume() { play(pos); }
  function jump(d) {
    if (!queue.length) return;
    const to = Math.max(0, Math.min(queue.length - 1, pos + d));
    if (playing) speakFrom(to); else { pos = to; highlight(queue[pos].el); }
  }
  function stop() {
    token++; if (supported) synth.cancel();
    playing = false; pos = 0; queue = [];
    highlight(null); if (bar) showBar(false); setPlayButton();
  }

  window.Listen = {
    supported,
    // Describe the current page. collect() returns [{el, text, label?}] in reading order.
    setup(c) { cfg = c; queue = []; pos = 0; },
    // Put a Listen button inside host (an element). Does nothing where speech is unavailable.
    button(host, where = 'beforeend') {
      if (!supported || !host) return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'listen-btn';
      b.addEventListener('click', () => { if (playing) pause(); else play(pos > 0 ? pos : 0); });
      host.insertAdjacentElement(where, b);
      setPlayButton();
    },
    play, stop, pause,
    // Reading order for an article page: headings, paragraphs, list items and quotes,
    // skipping navigation, bylines and tables. Stops at a heading whose text matches stopAt.
    collectArticle(root, stopAt) {
      const out = [];
      for (const el of root.querySelectorAll('h1, h2, h3, p, li, blockquote')) {
        if (stopAt && /^H/.test(el.tagName) && stopAt.test(el.textContent)) break;
        if (el.closest('.toc-list, .go, .byline, .eyebrow, table, .listen-btn, .loading')) continue;
        if (el.tagName === 'P' && el.closest('li, blockquote')) continue;
        const text = el.textContent.trim();
        if (text) out.push({ el, text: /^H/.test(el.tagName) && !/[.?!]$/.test(text) ? text + '.' : text });
      }
      return out;
    },
    get playing() { return playing; },
  };

  if (supported) {
    pickVoice();
    if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', pickVoice);
    else synth.onvoiceschanged = pickVoice;
    window.addEventListener('pagehide', () => synth.cancel());
  }
})();
