// Checks the content files before you publish:
//   node tools/check.js
// - every reference resolves to real verses
// - every non-gathered verse of the Bible is read exactly once
// - every note, thread and link points at a section that exists
const fs = require('fs');
const path = require('path');
const yaml = require('../vendor/js-yaml.min.js');
const Refs = require('../assets/refs.js');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const kjv = JSON.parse(read('data/kjv.json'));
const parts = yaml.load(read('content/timeline.yaml'));
const notes = yaml.load(read('content/notes.yaml'));
const threads = yaml.load(read('content/threads.yaml'));

const problems = [];
const ids = new Set();
const seen = new Map();
let total = 0;
kjv.books.forEach(b => b.chapters.forEach(c => { total += c.length; }));

parts.forEach(p => p.sections.forEach(s => {
  const id = String(s.id);
  if (ids.has(id)) problems.push('Duplicate section id ' + id);
  ids.add(id);
  (s.read || []).forEach(r => {
    let res;
    try { res = Refs.resolve(r, kjv); } catch (e) { problems.push('Section ' + id + ': ' + e.message); return; }
    if (s.gathered) return;
    res.verses.forEach(([c, v]) => {
      const key = res.book + ':' + c + ':' + v;
      if (seen.has(key)) problems.push(kjv.books[res.book].name + ' ' + c + ':' + v + ' is read in section ' + seen.get(key) + ' and again in ' + id);
      else seen.set(key, id);
    });
  });
}));

if (seen.size !== total) {
  const missing = [];
  kjv.books.forEach((b, bi) => b.chapters.forEach((ch, ci) => ch.forEach((_, vi) => {
    if (!seen.has(bi + ':' + (ci + 1) + ':' + (vi + 1))) missing.push(b.name + ' ' + (ci + 1) + ':' + (vi + 1));
  })));
  problems.push(missing.length + ' verses are not read anywhere, e.g. ' + missing.slice(0, 5).join(', '));
}

const checkId = (where, g) => { if (!ids.has(String(g))) problems.push(where + ' links to missing section ' + g); };
notes.forEach((n, i) => {
  checkId('Note ' + (i + 1), n.section);
  (n.go || []).forEach(g => checkId('Note ' + (i + 1) + ' (section ' + n.section + ')', g));
});
threads.forEach(t => t.stops.forEach(g => checkId('Thread "' + t.name + '"', g)));

// Reflections: every listed file exists, has front matter, and links to real sections
const reflectionFiles = yaml.load(read('content/reflections/index.yaml')) || [];
reflectionFiles.forEach(f => {
  const where = 'Reflection ' + f;
  let src;
  try { src = read('content/reflections/' + f); } catch (e) { problems.push(where + ' is listed but the file is missing'); return; }
  const m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) { problems.push(where + ' has no front matter (title, date, summary between --- lines)'); return; }
  const meta = yaml.load(m[1]) || {};
  if (!meta.title) problems.push(where + ' has no title');
  (meta.sections || []).forEach(g => checkId(where, g));
  if (meta.thread && !threads.some(t => t.id === meta.thread)) problems.push(where + ' names missing thread ' + meta.thread);
  (m[2].match(/\bsections? (\d+[a-z]?)\b/gi) || []).forEach(x => checkId(where + ' text', x.split(' ')[1]));
});
fs.readdirSync(path.join(root, 'content/reflections')).filter(f => f.endsWith('.md') && !reflectionFiles.includes(f))
  .forEach(f => problems.push('Reflection ' + f + ' is not listed in content/reflections/index.yaml, so it will not appear'));

console.log(ids.size + ' sections, ' + seen.size + ' of ' + total + ' verses placed, ' + notes.length + ' notes, ' + threads.length + ' threads, ' + reflectionFiles.length + ' reflections.');
if (problems.length) { console.log('\nProblems:\n- ' + problems.join('\n- ')); process.exit(1); }
console.log('All good.');
