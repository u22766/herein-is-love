// Resolves a reference label such as "Genesis 22", "Matthew 27:1-2",
// "Mark 8:31-9:1" or "Ephesians 1:4-5, 9-11" into verses from kjv.json.
// Shared by the site (window.Refs) and the check script (Node).
(function (root) {
  function bookIndex(label, names) {
    let best = -1;
    names.forEach((n, i) => {
      if ((label === n || label.startsWith(n + ' ')) && (best < 0 || n.length > names[best].length)) best = i;
    });
    if (best < 0) throw new Error('Unknown book in "' + label + '"');
    return best;
  }

  // Returns {book, verses: [[chapter, verse, text], ...]}
  function resolve(label, kjv) {
    const names = kjv.books.map(b => b.name);
    const b = bookIndex(label, names);
    const chapters = kjv.books[b].chapters;
    const rest = label.slice(names[b].length).trim();
    const out = [];
    const push = (c, v) => {
      const t = chapters[c - 1] && chapters[c - 1][v - 1];
      if (t == null) throw new Error('No verse ' + names[b] + ' ' + c + ':' + v + ' in "' + label + '"');
      out.push([c, v, t]);
    };
    const wholeChapters = (c1, c2) => { for (let c = c1; c <= c2; c++) for (let v = 1; v <= chapters[c - 1].length; v++) push(c, v); };
    const span = (c1, v1, c2, v2) => {
      for (let c = c1; c <= c2; c++) {
        const from = c === c1 ? v1 : 1, to = c === c2 ? v2 : chapters[c - 1].length;
        for (let v = from; v <= to; v++) push(c, v);
      }
    };
    let chap = null; // set once a segment names verses
    rest.split(/\s*,\s*/).forEach(seg => {
      let m;
      if ((m = seg.match(/^(\d+):(\d+)-(\d+):(\d+)$/))) { span(+m[1], +m[2], +m[3], +m[4]); chap = +m[3]; }
      else if ((m = seg.match(/^(\d+):(\d+)-(\d+)$/))) { span(+m[1], +m[2], +m[1], +m[3]); chap = +m[1]; }
      else if ((m = seg.match(/^(\d+):(\d+)$/))) { push(+m[1], +m[2]); chap = +m[1]; }
      else if (chap != null && (m = seg.match(/^(\d+)-(\d+)$/))) span(chap, +m[1], chap, +m[2]);
      else if (chap != null && (m = seg.match(/^(\d+)$/))) push(chap, +m[1]);
      else if ((m = seg.match(/^(\d+)-(\d+)$/))) wholeChapters(+m[1], +m[2]);
      else if ((m = seg.match(/^(\d+)$/))) wholeChapters(+m[1], +m[1]);
      else throw new Error('Cannot read "' + seg + '" in "' + label + '"');
    });
    return { book: b, verses: out };
  }

  const api = { resolve };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Refs = api;
})(this);
