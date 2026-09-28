// Herein Is Love: the reader. Loads the text and the study content, then renders
// one section at a time. Content lives in content/*.yaml and data/kjv.json.
(async function () {
  const page = document.getElementById('page');
  const toc = document.getElementById('toc');
  const tocBtn = document.getElementById('tocBtn');
  const q = document.getElementById('q');

  const get = (url, as) => fetch(url).then(r => { if (!r.ok) throw new Error(url + ': ' + r.status); return as === 'json' ? r.json() : r.text(); });
  let kjv, parts, notesList, threads;
  try {
    [kjv, parts, notesList, threads] = await Promise.all([
      get('data/kjv.json', 'json'),
      get('content/timeline.yaml').then(t => jsyaml.load(t)),
      get('content/notes.yaml').then(t => jsyaml.load(t)),
      get('content/threads.yaml').then(t => jsyaml.load(t)),
    ]);
  } catch (e) {
    page.innerHTML = '<p class="loading">The text could not be loaded (' + e.message + '). If you opened this file directly, serve the folder instead, for example with GitHub Pages.</p>';
    return;
  }

  const NAMES = kjv.books.map(b => b.name);
  const secs = [], partOf = {}, idx = {};
  parts.forEach(p => p.sections.forEach(s => { s.id = String(s.id); idx[s.id] = secs.length; secs.push(s); partOf[s.id] = p; }));
  const notes = {};
  notesList.forEach(n => (notes[String(n.section)] ||= []).push(n));
  const passages = s => s._p || (s._p = (s.read || []).map(r => ({ r, ...Refs.resolve(r, kjv) })));

  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const md = t => marked.parse(String(t));
  const dash = r => r.replace(/-/g, '–');

  // Contents
  let html = `<button class="threads" type="button" id="threadsBtn">Study threads <span style="color:var(--muted);font-weight:400">· ${threads.length} traced through the timeline</span></button>`;
  parts.forEach(p => {
    html += `<div class="part">Part ${p.part}<span>${esc(p.title)}</span></div>`;
    p.sections.forEach(s => html += `<button class="sec" type="button" data-n="${esc(s.id)}"><span class="n">${esc(s.id)}</span><span>${esc(s.title)}${s.date ? `<span class="dt">${esc(s.date)}</span>` : ''}</span></button>`);
    if (!p.sections.length) html += `<button class="sec" type="button" data-part="${p.part}"><span class="n">—</span><span>${p.note ? 'About these years' : 'No reading'}</span></button>`;
  });
  toc.innerHTML = html;
  const threadsBtn = document.getElementById('threadsBtn');

  const goBtns = list => `<div class="go">${list.map(g => { const s = secs[idx[String(g)]]; return s ? `<button type="button" data-n="${esc(s.id)}"><b>${esc(s.id)}</b>${esc(s.title)}</button>` : ''; }).join('')}</div>`;
  const studyBox = id => {
    const L = notes[id]; if (!L) return '';
    return `<div class="study"><div class="study-h">From our study<span>Commentary, not Scripture</span></div><ul>${L.map(x => `<li>${esc(x.text)}${x.go && x.go.length ? goBtns(x.go) : ''}</li>`).join('')}</ul></div>`;
  };
  const setCurrent = id => {
    toc.querySelectorAll('button.sec').forEach(b => b.setAttribute('aria-current', b.dataset.n === id ? 'true' : 'false'));
    threadsBtn.setAttribute('aria-current', id === '#threads' ? 'true' : 'false');
  };

  const hush = () => { if (window.Listen) Listen.stop(); };

  function renderThreads() {
    hush();
    let out = `<div class="eyebrow">Study threads</div><h1>Threads through the timeline</h1><p class="refs">Each thread follows one idea through the sections where it appears, in timeline order. Tap a section to read it; its study notes appear above the text. These notes are commentary, not Scripture. "Stated" means the Bible itself draws the link, and "pattern" means the text sets the pieces side by side.</p>`;
    threads.forEach(th => { out += `<div class="thread" id="th-${esc(th.id)}"><h2>${esc(th.name)}</h2><p>${esc(th.intro)}</p>${goBtns(th.stops)}</div>`; });
    page.innerHTML = out; window.scrollTo(0, 0); setCurrent('#threads');
    if (location.hash !== '#threads') history.replaceState(null, '', '#threads');
  }

  function renderSection(id, verseId, keepAudio) {
    const i = idx[id]; if (i == null) return renderSection(secs[0].id);
    if (!keepAudio) hush();
    const s = secs[i], part = partOf[id];
    let out = `<div class="eyebrow">Part ${part.part} · ${esc(part.title)}</div><h1>${esc(s.id)}. ${esc(s.title)}</h1>` + (s.date ? `<div class="date">${esc(s.date)}</div>` : '');
    out += `<div class="refs">${s.read && s.read.length ? s.read.map(r => esc(dash(r))).join(' · ') : 'No new reading'}</div>`;
    out += `<div class="progress" aria-hidden="true"><i style="width:${((i + 1) / secs.length * 100).toFixed(1)}%"></i></div>`;
    if (s.note) out += `<div class="note">${md(s.note)}</div>`;
    out += studyBox(id);
    passages(s).forEach(p => {
      out += `<h2 class="passage">${esc(dash(p.r))}</h2>`;
      let cur = null, buf = '';
      const flush = () => { if (cur != null) out += `<p class="chap"><span class="cn" title="${esc(NAMES[p.book])} ${cur}">${cur}</span>${buf}</p>`; };
      p.verses.forEach(([c, v, t]) => {
        if (c !== cur) { flush(); cur = c; buf = ''; }
        buf += `<span class="verse" id="v-${p.book}-${c}-${v}"><sup class="v">${v}</sup>${esc(t)} </span>`;
      });
      flush();
    });
    const prev = secs[i - 1], next = secs[i + 1];
    out += `<div class="pager">
      <button type="button" ${prev ? `data-n="${esc(prev.id)}"` : 'disabled'}><small>Previous</small>${prev ? esc(prev.id + '. ' + prev.title) : ''}</button>
      <button type="button" ${next ? `data-n="${esc(next.id)}"` : 'disabled'} style="text-align:right"><small>Next</small>${next ? esc(next.id + '. ' + next.title) : ''}</button>
    </div>`;
    out += `<p class="foot">Dates are approximate and follow the Bible's own chronology where it gives one. For what the whole reading adds up to, see <a href="report.html">the report</a>. Text of the King James Version is public domain. Notes, threads, reflections and the report are © 2026 Herein Is Love contributors, <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>.</p>`;
    page.innerHTML = out; setCurrent(id);
    setupListen(s, i);
    const cur = toc.querySelector(`button.sec[data-n="${CSS.escape(id)}"]`); if (cur) cur.scrollIntoView({ block: 'nearest' });
    try { localStorage.setItem('tb-last', id); } catch (e) {}
    if (location.hash !== '#s' + id) history.replaceState(null, '', '#s' + id);
    const el = verseId && document.getElementById(verseId);
    if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); } else window.scrollTo(0, 0);
  }

  // Listen: reads the section's Scripture aloud, verse by verse, then goes on to the next section.
  function setupListen(s, i) {
    if (!window.Listen || !Listen.supported) return;
    Listen.setup({
      collect: () => {
        const items = [{ el: page.querySelector('h1'), text: 'Section ' + s.id + '. ' + s.title + '.', label: 'Section ' + s.id }];
        page.querySelectorAll('p.chap').forEach(p => {
          const cn = p.querySelector('.cn');
          const [book, ch] = [cn.title.replace(/ \d+$/, ''), cn.title.match(/\d+$/)[0]];
          items.push({ el: cn, text: book === 'Psalm' ? 'Psalm ' + ch + '.' : book + ', chapter ' + ch + '.', label: book + ' ' + ch });
          p.querySelectorAll('.verse').forEach(v => {
            const text = [...v.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('');
            items.push({ el: v, text, label: book + ' ' + ch + ':' + v.querySelector('sup').textContent });
          });
        });
        return items;
      },
      onFinished: () => {
        const next = secs[i + 1];
        if (!next) { Listen.stop(); return; }
        renderSection(next.id, null, true);
        Listen.play(0);
      },
    });
    Listen.button(page.querySelector('.refs'), 'afterend');
  }

  function renderPart(n) {
    hush();
    const p = parts.find(x => String(x.part) === String(n));
    page.innerHTML = `<div class="eyebrow">Part ${p.part}</div><h1>${esc(p.title)}</h1><div class="note">${md(p.note || '')}</div>`;
    window.scrollTo(0, 0); setCurrent(null);
  }

  const closeToc = () => { document.body.classList.remove('toc-open'); tocBtn.setAttribute('aria-expanded', 'false'); };
  toc.addEventListener('click', e => {
    if (e.target.closest('#threadsBtn')) { closeToc(); renderThreads(); return; }
    const b = e.target.closest('button.sec'); if (!b) return;
    closeToc();
    if (b.dataset.part) renderPart(b.dataset.part); else renderSection(b.dataset.n);
  });
  page.addEventListener('click', e => { const b = e.target.closest('button[data-n]'); if (b) renderSection(b.dataset.n, b.dataset.v); });
  tocBtn.addEventListener('click', () => { const open = document.body.classList.toggle('toc-open'); tocBtn.setAttribute('aria-expanded', open); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeToc(); });

  // Search: gathered sections are skipped so each verse is found once, in its own place.
  let flat = null, timer;
  const buildIndex = () => {
    flat = [];
    secs.forEach(s => { if (!s.gathered) passages(s).forEach(p => p.verses.forEach(([c, v, t]) => flat.push([s.id, p.book, c, v, t, t.toLowerCase()]))); });
  };
  q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(runSearch, 200); });
  function runSearch() {
    hush();
    const term = q.value.trim().toLowerCase();
    if (term.length < 3) { if (!term) renderSection(current()); return; }
    if (!flat) buildIndex();
    const hits = []; let total = 0;
    for (const r of flat) if (r[5].includes(term)) { total++; if (hits.length < 300) hits.push(r); }
    const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let out = `<div class="results"><div class="eyebrow">Search</div><h1>${total.toLocaleString()} verse${total === 1 ? '' : 's'} with “${esc(q.value.trim())}”</h1>`;
    if (total > hits.length) out += `<p class="refs">Showing the first ${hits.length}, in reading order.</p>`;
    hits.forEach(([n, b, c, v, t]) => {
      out += `<button class="res" type="button" data-n="${esc(n)}" data-v="v-${b}-${c}-${v}"><b>${esc(NAMES[b])} ${c}:${v}</b><em>Section ${esc(n)}</em><p>${esc(t).replace(re, m => `<mark>${m}</mark>`)}</p></button>`;
    });
    page.innerHTML = out + '</div>'; window.scrollTo(0, 0);
  }

  function current() {
    const m = decodeURIComponent(location.hash).match(/^#s(.+)$/);
    if (m && idx[m[1]] != null) return m[1];
    try { const l = localStorage.getItem('tb-last'); if (l && idx[l] != null) return l; } catch (e) {}
    return secs[0].id;
  }
  const route = () => { if (location.hash === '#threads') renderThreads(); else renderSection(current()); };
  window.addEventListener('hashchange', route);
  route();
})();
