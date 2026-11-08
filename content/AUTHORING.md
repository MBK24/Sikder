# Authoring guide

Everything a reader studies lives in this folder: chapters, questions and flashcards. Run `pnpm content:check` after any change. It must pass with **0 errors** before a commit.

```
content/
├── _meta/parts.yaml                  # Part titles (don't edit casually)
├── book/<part>/NN-slug.mdx           # chapters; <part> ∈ getting-started, cp, cars, bb, ps, appendix
├── book/<part>/_coming-soon.yaml     # planned chapters shown greyed-out in the sidebar
├── questions/<part>/<slug>.yaml      # questions for the chapter with that slug
└── flashcards/<part>/<slug>.yaml     # built-in flashcard deck for that chapter
```

The URL comes from the file name: `book/cp/02-acids-and-bases.mdx` is served at `/cp/acids-and-bases` and displayed as **CP 2**. Its sections are numbered automatically: CP 2.1, CP 2.2, CP 2.2.1. Never type numbers into headings.

## 1. Chapter frontmatter

```yaml
---
title: "Acids and Bases"
summary: "One or two sentences (20–300 chars) used in the chapter header, search results and social previews."
estReadMinutes: 35          # ≈ words / 200
difficulty: core            # intro | core | advanced
access: premium             # free | premium. The first chapter of each section is free.
status: published           # draft | coming-soon | published
aamc: ["5A", "4E"]          # AAMC content categories covered (see §6)
---
```

## 2. Body

- **No H1.** The title comes from frontmatter. Start with 1–3 intro paragraphs, then `##` sections and `###` subsections. H4 and deeper are rejected.
- Headings get stable anchors from their text. `## The Henderson–Hasselbalch Equation` becomes `#the-hendersonhasselbalch-equation`. Avoid renaming headings once published, because forum links point at them.
- Write for a reader studying alone. Use short paragraphs. Every concept gets an MCAT-style "why it matters" or worked example. Prefer concrete biological contexts (blood buffering, enzyme active sites, neurons) over abstract ones, because that's how the exam frames things.
- GitHub-flavored Markdown works: tables, `- [ ]` is **not** used, footnotes are fine but rare.
- **Math:** `$...$` inline, `$$...$$` on its own lines for display. KaTeX syntax.
  - Chemistry uses mhchem: `$\ce{H2SO4}$`, `$\ce{HA <=> H+ + A-}$`, `$\ce{^{14}_{6}C}$`.
  - Units: `$9.8\ \text{m/s}^2$`, or plain text "9.8 m/s²" in prose.
- **Characters to avoid in prose** (outside `$math$` or `` `code` ``): `{` and `}` are rejected. A bare `<` immediately followed by a letter is parsed as a component, so write "less than", or use math `$\lt$` / `$a \lt b$`.
- **No HTML, no `import`/`export`.** Only these three components are allowed:

### `<Callout>`

```mdx
<Callout type="high-yield" title="Optional custom title">
Markdown content, **including** lists and $math$.

- one
- two
</Callout>
```

Leave a blank line after the opening tag and before the closing tag whenever the content has more than one paragraph or a list.

| `type` | Default title | Use for |
|---|---|---|
| `high-yield` | High-Yield | Facts the exam tests repeatedly. Max ~1 per section, or they lose meaning. |
| `trap` | Common Trap | A specific wrong answer students choose, and why it's wrong |
| `mnemonic` | Mnemonic | A memory device (keep it tasteful) |
| `connection` | Connection | A link to another section of the exam. Add `to="/bb/enzymes-and-kinetics"` (optionally with `#anchor`) to make the box a link. |
| `note` | Note | Anything else worth setting apart |

### `<Question id="..." />`

Places an inline practice question. The id must exist in `questions/<part>/<slug>.yaml` with `usage: inline`. Put each question right after the section it tests, with 3–5 per chapter.

### `<Figure src="/figures/<part>/<file>.svg" alt="..." caption="..." />`

Optional. SVGs go in `public/figures/<part>/`. Draw with `currentColor` strokes/fills so they work in dark mode. Only add a figure if it genuinely teaches better than a table would.

## 3. Questions (`questions/<part>/<slug>.yaml`)

```yaml
chapter: acids-and-bases
passages:                         # optional; mostly used for CARS and bank sets
  - id: cp-acids-p1
    title: "Optional title"
    body: |
      At least 200 characters. Markdown and math allowed.
questions:
  - id: cp-acids-01               # globally unique, kebab-case: <part>-<short-chapter>-NN
    usage: inline                 # inline (placed in the chapter) | quiz (end-of-chapter) | bank (QBank only)
    topic: 5A                     # one AAMC code (§6)
    difficulty: core              # intro | core | advanced
    passage: cp-acids-p1          # optional
    stem: |
      Markdown + math.
    choices:
      A: "..."
      B: "..."
      C: "..."
      D: "..."
    answer: C
    explanation: |
      Why C is right, in 2–5 sentences. Show the reasoning or calculation, not just the fact.
    whyWrong:                     # optional but encouraged; one line per wrong choice
      A: "..."
      B: "..."
      D: "..."
```

Question-writing rules:

- MCAT style: four choices, one unambiguously correct answer, plausible distractors built from real misconceptions. No "all of the above" or "none of the above".
- Vary which letter is correct. Across a chapter, the correct answers should be spread roughly evenly over A–D.
- Choices should be parallel in length and form. The correct answer shouldn't be the longest one.
- Quiz questions (`usage: quiz`, 10–15 per chapter) should mix recall, application and at least 2–3 that are set inside a short experimental or clinical scenario, like real MCAT discretes.
- Quote YAML strings that start with a special character (`"*"`, `"-"`, `":"`, `"%"`, `"@"`) or that are pure numbers. When in doubt, quote. Use `|` block scalars for multi-line text.

## 4. Flashcards (`flashcards/<part>/<slug>.yaml`)

```yaml
deck:
  title: "Acids and Bases"
  description: "Optional."
cards:
  - id: cp-acids-fc-01
    front: "Which six acids are strong in water?"
    back: "HCl, HBr, HI, $\\ce{HNO3}$, $\\ce{H2SO4}$ (first proton), $\\ce{HClO4}$"
    tags: [strong-acids]
```

- 15–30 cards per chapter. Each card should test one atomic fact. Prefer questions over bare terms on the front.
- Inside double-quoted YAML strings, backslashes must be doubled (`\\ce`). Single quotes or `|` blocks avoid this.

## 5. Originality and accuracy

- **All content must be original.** Do not reproduce text, questions or passages from AAMC, Kaplan, Princeton Review, Khan Academy, UWorld, Blueprint, textbooks or Wikipedia. Facts are fine. Wording and question construction must be ours.
- CARS passages must be original prose written in the style of a humanities or social-science essay, or genuinely public-domain text (pre-1929) with the author and work named in the passage `title`.
- Avoid time-sensitive specifics that will go stale: registration fees, exact test dates, current percentile tables. Give stable facts (scoring scale, section lengths) and point to the AAMC for the rest.
- Use precise numbers where the exam uses them (e.g., normal arterial pH 7.35–7.45) and double-check them.

## 6. AAMC content categories

| Code | Category |
|---|---|
| 1A | Structure and function of proteins and their constituent amino acids |
| 1B | Transmission of genetic information from the gene to the protein |
| 1C | Transmission of heritable information from generation to generation |
| 1D | Principles of bioenergetics and fuel molecule metabolism |
| 2A | Assemblies of molecules, cells, and groups of cells |
| 2B | Structure, growth, physiology, and genetics of prokaryotes and viruses |
| 2C | Processes of cell division, differentiation, and specialization |
| 3A | Structure and functions of the nervous and endocrine systems |
| 3B | Structure and integrative functions of the main organ systems |
| 4A | Translational motion, forces, work, energy, and equilibrium |
| 4B | Importance of fluids for the circulation of blood, gas movement, and gas exchange |
| 4C | Electrochemistry and electrical circuits and their elements |
| 4D | How light and sound interact with matter |
| 4E | Atoms, nuclear decay, electronic structure, and atomic chemical behavior |
| 5A | Unique nature of water and its solutions |
| 5B | Nature of molecules and intermolecular interactions |
| 5C | Separation and purification methods |
| 5D | Structure, function, and reactivity of biologically relevant molecules |
| 5E | Principles of chemical thermodynamics and kinetics |
| 6A | Sensing the environment |
| 6B | Making sense of the environment |
| 6C | Responding to the world |
| 7A | Individual influences on behavior |
| 7B | Social processes that influence human behavior |
| 7C | Attitude and behavior change |
| 8A | Self-identity |
| 8B | Social thinking |
| 8C | Social interactions |
| 9A | Understanding social structure |
| 9B | Demographic characteristics and processes |
| 10A | Social inequality |
| CARS-FC | CARS: Foundations of Comprehension |
| CARS-RWT | CARS: Reasoning Within the Text |
| CARS-RBT | CARS: Reasoning Beyond the Text |

## 7. Chapter slugs (for cross-links)

| URL | Free? |
|---|---|
| `/getting-started/how-the-mcat-is-scored`, `/getting-started/building-a-study-schedule`, `/getting-started/how-to-use-this-site`, `/getting-started/test-day` | all free |
| `/cp/atoms-and-periodic-trends` · `/cp/acids-and-bases` | first is free |
| `/cars/reading-for-structure` · `/cars/question-types-and-elimination` | first is free |
| `/bb/amino-acids-and-proteins` · `/bb/enzymes-and-kinetics` | first is free |
| `/ps/sensation-and-perception` · `/ps/learning-and-memory` | first is free |
| `/appendix/high-yield-equations` · `/appendix/amino-acids` · `/appendix/hormones` · `/appendix/lab-techniques` | premium |

Chapters listed in a part's `_coming-soon.yaml` don't exist yet, so don't link to them. You can mention them in prose ("covered in the upcoming chapter on metabolism").
