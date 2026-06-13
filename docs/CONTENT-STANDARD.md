# CONTENT STANDARD — the enrichment every paragraph must carry

> This is not a checklist for one day. It is **the mindset for how we generate
> study material.** Every existing paragraph is held to it, and **every future
> day must ship complete on all layers below.** "A day is done" = all layers green.

The throughline: turn **看得懂 → 说得出**. So content is not just *presented* —
each item is broken down (how it's built), connected (synonyms/antonyms/contrast),
and made producible (conjugation, usage, recall).

---

## Per PARAGRAPH (the `paragraph[]` of a day)
- [ ] Furigana on every kanji: `漢字[かな]` (validated — brackets balanced).
- [ ] `zh` translation; **`en`** translation in `i18n-en.js` (`paraEn`).
- [ ] **VOICEVOX audio** for every sentence (`d{day}_s{i}`), default voice.

## Per VOCAB word (the `vocab[]`)
- [ ] `w` (kanji), `r` (reading), `zh`, **`en`**, `pos`.
- [ ] One `ex` example (`jp`/`zh`) + its `en` (`vocabExEn`) + audio (`x_…`).
- [ ] `parts` 拆解 for compound **nouns** (自己＋紹介).
- [ ] **🔄 活用 conjugation** — AUTOMATIC for verbs via `conjugate.js`
      (engine: full paradigm + everyday usage, kanji & kana). Ambiguous group?
      add `g:"ichidan|godan|suru|kuru"` to the vocab entry. *(TODO: extend the
      engine to い/な-adjectives so every conjugating word type is covered.)*
- [ ] **🔎 词义扩展 lexicon** (`lexicon.js`, keyed by exact `w` incl. `〜`):
      - **compound verbs (複合動詞):** `compound={roots, why, pattern, family}`
        — roots, *why* they combine, the productive pattern (V〜出す / 〜合う /
        〜かける / 〜抜く / 〜続ける / 〜返る…), and sibling words.
      - **plain words:** `syn` / `ant` / `related` (`[{w,m,note}]`) + a `note`
        explaining **when to use which** and how they differ.
      Coverage tiers (highest wins): authored `LEXICON` ▸ committed AI draft
      `LEXICON_GEN` (label "AI 草拟") ▸ runtime AI fallback (BYOK, cached).

## Per GRAMMAR point (the `grammar[]`)
- [ ] `point`, `label`, `zh` written so `formatGrammarExp` yields structure:
      用法①②③ / 构成 (结构＝…) / 注意 (⚠️…). `en` exp in `gramEn`.
- [ ] `examples[]` (+ `en` in `gramEn.ex`) + audio.
- [ ] **Usage-grouped examples** (`uses[]` + `use` tags) when a point has
      multiple distinct uses (〜ています = 进行/习惯/结果状态).
- [ ] **⚖️ contrast block** (`contrast={q, rows}`) for any multi-use or
      confusable / near-synonym point (ので vs から, と/たら/ば/なら, 様態 vs 伝聞…).
- [ ] Conjugation-form terms (て形/た形/ない形/ます形…) auto-link to the glossary.

## Other surfaces (when a day uses them)
- Tests: `cat` (文法/語彙/読解), `point`, `day`, `explain` + `explainEn`.
- Listening / scenarios: real-voice audio, `zh`+`en`, transcript.

---

## How to fill it at scale (current backlog + future days)
1. **Conjugation** needs no authoring — the engine covers every verb. (Just tag
   `g` on the rare ambiguous verb.)
2. **Lexicon**: run `python3 tools/gen_lexicon.py` (BYOK: `ANTHROPIC_API_KEY`
   env). It drafts entries for every vocab word **missing** from `lexicon.js`,
   writes `js/lexicon-gen.js` (`window.LEXICON_GEN`, marked `ai:true`). Re-run
   after adding any new day — it's idempotent (skips authored + already-drafted).
   Promote good drafts into `lexicon.js` (then they show without the "AI 草拟"
   label). Never commit the API key.
3. **Authoring a NEW day**: write `lessons.js` (paragraph/vocab/grammar to this
   standard) → `gen_audio.py` → `gen_lexicon.py` → review. Not done until green.

See [[jpn-review-findings]] for build history. lessons.js is the source of
truth and is never overwritten by tooling — generated layers live in their own
files (manifest.js, lexicon-gen.js, i18n-en.js).
