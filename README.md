# Herein Is Love

*From everlasting.* "Herein is love, not that we loved God, but that he loved us" (1 John 4:10).

The King James Bible arranged in the order its events happened, from before creation to Revelation. It comes with study notes, study threads, short reflections, and a report on what the whole book adds up to when read in order.

It's a static site with no build step and no server, so it runs on GitHub Pages as-is.

## What's where

| Path | What it holds | How often it changes |
|---|---|---|
| `data/kjv.json` | All 31,102 verses of the KJV (public domain), by book, chapter and verse | Never |
| `content/timeline.yaml` | The reading order: 13 parts and 457 sections, each listing references like `Genesis 22` | Rarely |
| `content/notes.yaml` | Study notes, shown above the text of a section | Often |
| `content/threads.yaml` | Study threads, each following one idea through the sections | Sometimes |
| `content/report.md` | The report, *A Report on the Whole Bible, Read in Order* | Sometimes |
| `content/reflections/` | Reflections: short readings, one Markdown file each, listed in `index.yaml` | Often |
| `index.html`, `assets/` | The reader | Rarely |
| `report.html`, `reflections.html` | The report page and the reflections page | Rarely |
| `vendor/` | js-yaml and marked (MIT), vendored so the site has no outside dependencies | Never |
| `tools/check.js` | Checks the content before you publish | — |

The reading order stores references, not verse text. The reader looks up the text in `kjv.json`, so moving a passage means editing one line.

## Editing

**Add a study note** to the end of `content/notes.yaml`:

```yaml
- section: 407
  text: His side is opened after death, as Adam's side was opened for his bride. Pattern.
  go: [2, 3, 452]
```

`go` lists the sections the note links to. The note conventions are:

- **Stated:** the Bible itself draws the link.
- **Pattern:** the text sets the pieces side by side.
- **(my reading):** interpretation.
- **Honest note:** a hard text.
- **Outside:** material from outside the canon.

**Add a thread** to `content/threads.yaml`:

```yaml
- id: bride
  name: The Lamb and the bride
  intro: One or two sentences on what the thread follows.
  stops: [2, 18, 19, 456]
```

**Change the reading order** in `content/timeline.yaml`. A section looks like this:

```yaml
- id: 18
  title: The binding of Isaac
  date: About 2050 BC
  read:
  - Genesis 22
```

References can take these forms:

- `Genesis 1-2` (whole chapters)
- `John 1:1-5`
- `Mark 8:31-9:1` (a span across chapters)
- `John 17:5, 24`
- `Ephesians 1:4-5, 9-11`

A section marked `gathered: true` (section 1a) repeats verses that are also read in their own place. Search skips those sections, so each verse is found once.

**Write a reflection** as a Markdown file in `content/reflections/`, starting with front matter:

```markdown
---
title: Loved Before the Foundation of the World
date: 2026-09-27
summary: One sentence shown in the list of reflections.
sections: [1a, 18, 407, 456]
thread: union
---

The reflection, in plain Markdown. Writing "section 18" links it to that section.
```

Then add its file name to the top of `content/reflections/index.yaml`, which lists reflections newest first. `sections` and `thread` are optional. They add a "Read it in order" list at the end of the reflection.

**Edit the report** in `content/report.md`. It's plain Markdown.

## Before you push

```sh
node tools/check.js
```

The check confirms that every reference resolves to real verses. It also confirms that every verse outside the gathered sections is read exactly once, and that every note, thread and reflection points to a section that exists.

## Previewing locally

The pages load their content with `fetch`, so they need to be served rather than opened as files:

```sh
python3 -m http.server
```

Then open http://localhost:8000.

## Publishing on GitHub Pages

1. Push this folder to a GitHub repository.
2. Go to **Settings → Pages**, choose **Deploy from a branch**, and select `main` and `/ (root)`.
3. The site appears at `https://<username>.github.io/<repo>/` within a minute or two.

## License

- **Code** (the pages, `assets/`, `tools/`): MIT, see `LICENSE`.
- **Written content** (everything in `content/`): CC BY-SA 4.0, see `LICENSE-CONTENT.md`. Anyone may share and adapt it with credit, and adaptations must stay under the same license.
- **KJV text** (`data/kjv.json`): public domain in the United States.
- **Libraries** in `vendor/`: their own MIT licenses.

Copyright © 2026 Herein Is Love contributors.
