# 🥚 Study Pet — design doc (v1.1)

A Tamagotchi-style companion that **grows from real study progress**, not random rewards.
The goal: a daily reason to come back, an emotional stake in studying, and — once grown —
a chat buddy that makes studying feel less lonely. Collectible, randomized, cute/cool.

> Status: **Phase A BUILT & live** (js/pet.js — procedural creature, egg-of-fate, care,
> sickness/death, home rail). **Growth v2 BUILT** (progress-weighted, §3). The "alive"
> layer (diary/autonomy/conversation/evolution-as-language, §5b–5c) is DESIGNED below,
> not yet built. v1.0 (scenarios audio, speed, adult mode) is done.

---

## 0. North star — the pet is a STUDY TOOL, not a game

**Every pet mechanic must earn its place by serving Japanese learning.** This is an
interactive, engaging *practice tool* wearing a game's clothes — not a game bolted onto a
study site. The mapping is explicit and non-negotiable:

| Pet mechanic            | The learning function it actually serves                        |
|-------------------------|-----------------------------------------------------------------|
| Activity log + diary (all 日本語) | **Reading practice** — you must read JP to know your pet's life |
| Pet starts conversation | **Conversation practice** — daily, low-stakes, on/off topic     |
| Evolution               | **Exposure to a new register/dialect** of Japanese (see §5c)    |
| Growth bar              | **Motivation tied to real progress** (not clock-watching)       |
| Home with friends/party | More voices → more registers, more reading/listening surface    |
| Care loop               | A 20-second daily habit that pulls you into the app             |

If a feature is fun but teaches nothing, it gets cut or reshaped until it teaches.

---

## 1. Design pillars (from the user's brief)

1. **Growth = study.** Every growth step is bought with real study actions the app already
   tracks. No "spin the wheel" rewards. (req #5)
2. **Collectible & randomized.** Each creature is unique; the Japanese love of collecting
   (Pokémon / Digimon) is the hook. Eggs are random; species are discovered, not bought.
3. **Cute or cool, pixel-art.** 2D pixel / HD-2D look. Cute (round, Tamagotchi/Digimon) or
   cool (sleek, Pokémon-rival). (user's stated taste)
4. **Care creates the daily ritual.** Feed, wash, clean poop, sleep — small, quick, daily.
5. **It gives back.** As it gets smarter it becomes a chat buddy (ties into the existing
   BYOK Claude assistant), speaks in character, asks for care, reacts to your studying. (req #6)
6. **Fills the empty home gutters.** The pet lives in the centered home page's dead side-space.

---

## 2. The key technical bet: **procedural pixel creatures**

Instead of hand-drawing dozens of sprites (asset-heavy, limited, not "infinite collection"),
**generate each creature deterministically from a numeric seed**, drawn on `<canvas>`.

- A seed → a **genome**: body shape, ear/horn/tail/wing parts, eye style, palette, pattern,
  size, "vibe" axis (cute ⟷ cool). Symmetric pixel grid (mirror left/right) like real sprite art.
- **Why this nails the brief:** unlimited unique creatures (collection craze ✓), zero external
  assets (fully offline, file://-safe ✓), and **genetics for free** — breeding = crossover of two
  genomes, so offspring visibly inherit parents' parts/colors (req: breeding/discovery ✓).
- Stage growth = the same genome rendered at higher "evolution" detail (egg → blob → limbed →
  adult → elder), so a creature keeps its identity as it grows.
- A small curated set of **named "species archetypes"** (seed ranges / part-rules) gives the
  collection structure & 図鑑 entries, while within each, variation keeps every pet personal.

Rendering: 32×32 or 48×48 logical grid, `image-rendering:pixelated`, scaled up. Idle animation
= 2–4 frame bob/blink. Tiny code, looks like a Game-Boy-era creature.

> Alternative considered: a fixed hand-pixel-art sprite set (more polished, but limited,
> needs sourced assets, and kills the "infinite random collection" feel). Recommend procedural.
> A later upgrade path: swap the renderer for HD-2D sprite sheets per species without changing
> the genome/state model.

---

## 3. Lifecycle & growth v2 — EFFORT + real PROGRESS  ✅ BUILT

```
🥚 Egg → 🐣 Hatchling → 🐤 Child → 🦊 Teen → 🦁 Adult → 🧓 Elder
```

The critical principle (your emphasis): **growth tracks real learning, not activity.**
Marking a session "done" is weak & gameable; *improving* is the strong signal. So
`studySXP = EFFORT + PROGRESS`, with **progress weighted far higher**:

- **EFFORT (small floor — "showing up"):** `sessions×5 + full-days×10 + active-days×4`.
  Gets a non-tester to ~child/teen, no further. Can't be the main driver (anti-cheat).
- **PROGRESS (dominant — real mastery):**
  - `Σ best-test-score% × 1.2` over the 4 tests, and
  - `best-pronunciation × 0.8`.
  - **Best-score is un-gameable & monotonic:** a plateau adds nothing; beating your
    record adds *exactly* the gain (40→60→90 grows the pet a lot); being **stuck at 60**
    keeps the pet small ("unacceptable" — correctly reflected); someone content at a
    real 80 isn't punished (they earned 80). No farmable "improvement deltas."

*Verified:* effort-only (6 marked days) = 174 SXP; + real progress (test 90%, pron 90) =
354 (progress ≈ doubles growth); pron-best-80 plateau (346) < pron-best-90 (354).

- **Seeing progress:** every test attempt → `jpn-test-log`, every scored pronunciation →
  `jpn-pron-log` (timestamped, capped). The pet *notices* the attempt you just made and
  comments in Japanese — "発音、20点アップ！その調子！" / "今回はちょっと残念…次はいけるよ！"
  (reading practice + the seed of study-tied conversation, §5b).
- **Time-on-task (optional, 1a):** not tracked yet; sessions/days are the effort proxy.
  Could add lightweight active-minute tracking later — but per your call, *progress > time*.
- **Hatching requires study** (SXP, not the clock); the egg shows a fill meter.
- All derived & monotonic, so stages never regress; retroactive (counts past progress).

**Not studying never kills the pet** — only *neglecting care* does (§4a). Not studying just
stalls *growth*. Stakes stay real (death is possible) but fair (20-second care keeps it alive).

---

## 4. Care loop (the daily ritual)

Four meters decay slowly over **real wall-clock time** (timestamp-based, offline-safe):

- **🍙 Hunger** — feed it (costs Coins).
- **🛁 Cleanliness** — wash it; it also drops **💩 poop** that you tap to clean.
- **😊 Happiness / Mood** — play / pet / teach. Mood is *first-class*: it drives the sprite's
  expression, what the pet says, its chat tone, and the coin rate. (You flagged mood as important.)
- **⚡ Energy** — sleep (a night-time rest cycle).

**Coins** are a soft currency earned by studying (separate from SXP, smaller). Feeding/items
cost coins → care is *funded by* studying. **Crucially, care ≠ growth:**
- **Care keeps it ALIVE** (meters + health). You can keep the pet healthy with ~20 s/day of
  tapping even on a day you don't study.
- **Study makes it GROW** (SXP → stages). A busy non-study day won't kill it; it just won't grow.

This decoupling is the fairness valve given that death is on the table (§4a).

Care actions are 1-tap, fast, satisfying (little particle/animation), designed for a 20-second
daily check-in: *open app → pet says "おはよう！ 💩 掃除して！" → feed + clean → study.*

## 4a. Health, sickness & death (Tamagotchi-style — your call: real stakes, **can die, never runs away**)

A pet **can die from sustained neglect** and death is **permanent** for that creature. It will
**never run away.** But the system is built to kill only on *genuine, warned* neglect — not a
single busy week — so it feels meaningful, not punishing.

- **❤️ Health (HP):** a meter that only moves when things are bad/good for a while. It *drains*
  when hunger/energy bottom out, or when poop is left uncleaned, or while the pet is **sick**.
  It *slowly regenerates* when all meters are healthy.
- **🤒 Sickness:** triggered by low cleanliness (uncleaned poop), starvation, or exhaustion.
  A sick pet shows 🤒, mood tanks, **SXP gain pauses** (it can't grow while sick), and HP drains.
  Cure with a **medicine** item (coins) or sustained good care. Ignored sickness is the main path
  to death.
- **Escalating warnings (no silent death):** sick/critical state shows a clear banner on open,
  the pet's speech bubbles plead, and the home companion looks visibly ill. Death only happens
  **after the critical state persists past a grace window during which you've seen the warnings**
  (or after a very long unbroken absence).
- **Offline decay is capped:** on open we decay by elapsed time but **clamp the catch-up** (e.g.
  as if ≤48 h passed). A 2-week trip ⇒ pet is sick, filthy, miserable — but alive, giving you a
  comeback/nurse-back-to-health moment rather than logging in to a corpse.
- **On death:** the creature is gone (a memorial entry in the 図鑑 "thanks for the memories"),
  but you **keep coins, 図鑑 progress, and SXP-unlocks**, and hatch a fresh egg. The loss has
  weight without nuking the whole save. Lineage/breeding history is preserved.
- All thresholds (grace windows, decay rates, offline cap) are **tunables** in one config block
  so we can dial difficulty after playtesting.

---

## 5. "It gives back" — the chat buddy (req #6)  ⭐ resolving the AI contradiction

**Your worry:** if the pet hasn't hatched, or is too young/dumb, and I have a study question —
who answers? Can a dumb hatchling reply? If not, the assistant feels broken.

**The resolution — one principle: "Sensei is the brain; the pet is the heart."**
We separate the *capability* (always-on tutoring) from the *persona* (a companion that grows).
They live in **one chat surface with a persona switcher**, but the help is NEVER gated on the pet.

- **📖 先生 (Sensei) — ALWAYS available, from the very first launch, egg or no egg.**
  This *is* today's assistant (`assistant.js`, BYOK Claude), reframed as your tutor. Any Japanese /
  JLPT / course question → Sensei answers, grounded in the lessons. It never depends on the pet's
  existence or intelligence. **This is the answer to "what if I don't have a pet yet": you always
  have Sensei.**

- **🐣 [Pet] — the companion layer that grows into a chat buddy.**
  - **Egg / Hatchling / Child (low intelligence):** the pet can only **emote** — canned, in-character
    speech bubbles tied to study & care state. It **cannot answer questions yet, and says so, in
    character**: ask it something and it goes *"うーん、むずかしい…！先生に聞いてみて！"* ("Hmm, too
    hard for me… ask Sensei!") with a tap that hands you straight to 📖 先生. The young pet honestly
    can't help — and that's *charming*, not broken, because Sensei is right there.
  - **Teen+ (intelligence unlocked by study):** the pet gains real chat — backed by the SAME Claude
    brain as Sensei, but with the pet's name, species personality, and your study context in its
    system prompt. Now you can ask the pet directly and it answers like a knowledgeable buddy
    (and can defer the truly hard stuff to Sensei mid-chat: *"これは先生に確認するね"*).
  - Optional **"let [pet] explain it" mode** at Teen+: Sensei's answer is delivered *in the pet's
    voice/personality* — same knowledge, more warmth.

- **UI:** one floating button + one chat panel. A small persona switch at the top: **📖 先生**
  (always lit) and **🐣 [pet]** (locked with a "growing… keep studying!" hint until Teen).
  - **Before the pet is smart:** button shows 📖, default persona = Sensei. The pet still lives on
    the home page as your companion (emoting), just isn't a chat option yet.
  - **Once the pet is smart:** the floating button *becomes the pet sprite*; tapping opens chat
    defaulting to the **pet** persona, with 📖 先生 one tap away. You never lose the reliable tutor.

  → **Q1 (no pet / egg): Sensei answers — always.**  **Q2 (want to ask the AI): tap 📖 先生 anytime;
    once your pet is grown you can also just ask it, and it routes the same knowledge through its
    personality.**

- **Proactive companion lines** (independent of chat tier, even for a hatchling): "やった！Day 7
  クリア！" after finishing a day, gentle "今日はまだ一緒に勉強してないね…" on a cold open, "お腹
  すいた、ご飯つれてって！" when hunger is low — the "Dad, clean my poop / take me to eat" flavor.
- Pet/Sensei speech is bilingual (zh/en via T/zhen) and can be spoken with VOICEVOX (reuse audio path).

**Net:** merging is *additive, not a replacement*. The tutor is always on; the pet is an optional,
growing personality layer on top of it. No state of the pet can ever leave you without help.

---

## 5b. The pet comes alive — autonomy, diary & a living home (reading + conversation practice)

The pet should feel *self-motivated* (Tamagotchi's randomized events, but readable like the
"generative agents" idea), and **every bit of its life is narrated in Japanese** so the user
must read to follow along. This is the engagement engine — and it's all reading/conversation drill.

**(a) Autonomous activity while you're away.** On each return we look at elapsed time and roll a
randomized set of events (more time away → more events). Events are things that happened *to the
home*: Cube read a book, went out, **brought a friend over**, they sang カラオケ, ate together,
**got into a fight and Cube got hurt**, found a coin/item, napped, studied a little on its own…
Mood/health/relationships shift accordingly (a fight → a scratch + lower health; a good day → mood up).

**(b) Activity log + diary — two reading registers:**
- **第三者ログ (third-person log):** terse timeline — 「キューブは 本を 読んだ。」「友[とも]だちが 遊[あそ]びに 来[き]た。」 — easy N5/N4 reading.
- **日記 (first-person diary):** a longer, warmer entry you tap to open — 「今日[きょう]はね、○○が来[き]てくれて…」 — richer N4/N3 reading, leveled to the learner.
- Optional **furigana toggle + tap-to-hear (VOICEVOX)** so the log doubles as listening practice.

**(c) Pet-initiated conversation (your idea #2).** After you study (or on a cold open) the pet
starts a chat: 「ねえ、さっき頑張[がんば]ってたね。どうだった？」 — on-topic *or* random, addressed by the
**user's nickname / character voice** (not always "お父[とう]さん"). Tap to reply → opens the chat
(§5: Sensei brain / pet personality). Pure low-stakes conversation reps.

**(d) Living home & friends (your party idea → §6/Phase C):** the home can host **2–N pets**
(a cap by perf). Friends visit, parties happen (eat / karaoke / even a kiss — randomized & gently
gated by mood/relationship). You can just *watch* the JP unfold, or join the conversation.

**Generation strategy (Claude + fallback):**
- **With a BYOK key (Sensei online):** Claude generates the diary/log/conversation as *fresh,
  leveled Japanese* (N-level matched, in the pet's current register/dialect — §5c), grounded in
  the rolled events + your real study (it can reference "you nailed the pronunciation today").
- **Without a key:** a templated JP event/diary generator (slot-filled sentences) — less varied,
  still real reading. The pet always works offline; Claude just makes it richer.
- **Everything is randomized** (seeded per day so a given day is stable on re-open, but the *roll*
  is random) — no two days read the same.

---

## 5c. Evolution = a NEW kind of Japanese (the real payoff)

Evolution is **event-driven and Digimon-loose** (no fixed tree): it can trigger from a happy
streak, a gift from you, a "deep book" it read, a social/romantic event, a fight, prolonged
neglect (→ an *angry* form), etc. Rare, surprising, randomized.

**What evolution MEANS to the learner = a change in how the pet speaks Japanese.** The sprite
changes, but the *point* is a new **register / dialect / speech style** to get exposed to:

| Trigger (example)            | Evolution → speech style the pet now uses                    |
|------------------------------|--------------------------------------------------------------|
| Met a friend from 大阪        | **関西弁** (なんでやねん／おおきに／ほんま…)                      |
| Friend from 沖縄              | **沖縄 slang** (めんそーれ／なんくるないさ…)                    |
| Read "deep books"            | **literary / 硬い** register, kanji-heavy, formal             |
| Hung out online              | **ネットスラング** (草／それな／〜み…)                          |
| Lots of polite care/keigo    | **敬語** mode (〜でございます…)                                 |
| Neglect → angry form         | blunt / rough 男言葉 or ぞんざい speech                        |
| Baby → child (default)       | plain 標準語, simpler grammar                                  |

So the learner *experiences* that Japanese isn't monolithic — politeness levels, dialects,
slang, written vs spoken — through who their pet becomes. A `register` field on the pet drives
both its canned lines and the Claude system prompt. (Kansai content also already exists in the
Reference section — the pet makes it lived-in.) Evolutions are logged in the 図鑑.

---

## 5d. Personality (nature) — the per-pet character  ✅ BUILT (data layer)

Every pet has a **nature**, like a Pokémon nature, **deterministic from its seed** — so it's
part of "who fate gave you," and it's the same offline. Personality is a **learning lever, not
flavor**, driving three things:

1. **Tone / speech style** — how it talks (元気: 「体[からだ]動[うご]かそうぜ！」 vs クール:
   「ふん、まあまあだな。」 vs 甘えん坊: 「おとうさ〜ん、さみしかった〜！」). Composes with the
   evolution register (§5c): nature = baseline voice, evolution = dialect/register on top.
2. **Activity bias + signature events** — a sporty pet plays ball, a quiet one reads & journals,
   a foodie hunts ramen. The roller merges generic events with the nature's own event set.
3. **⭐ The Japanese vocabulary DOMAIN it exposes you to** — this is the payoff. A 元気 pet's diary
   literally teaches sports JP («バスケで タイマン勝負[しょうぶ]した。めっちゃ上手[うま]かった！»),
   a グルメ teaches food words (ラーメン／こってり／手作[てづく]り), クール teaches calm/observational
   phrasing, etc. Different pets → different slices of Japanese → "richer learning scenarios."

Built natures: 元気(sporty) · 物静か(bookish) · 食いしん坊(foodie) · やんちゃ(mischief/gaming) ·
甘えん坊(clingy) · クール(cool). Each has tone + 2 domain-vocab events (jp/zh/en + first-person
diary fragment). Stored as `p.nature` (retro-safe via `natureOf(seed)`); shown as a header chip.
*Extensible:* more natures + more domain events are just data; Claude (§A) can also generate
nature-true events/lines on the fly.

- **図鑑 (Pokédex)**: a collection book of species you've discovered; silhouettes for undiscovered.
- **Going out & friends:** once Adult, the pet can "go out to play" (a study-gated cooldown).
  It returns with: a **new egg**, a **friend** (NPC creature added to your home yard), or an item.
- **Breeding:** pair two owned adults → an egg whose genome is a **crossover + small mutation**
  of the parents (visible inherited parts/colors). New species archetypes unlock via milestones.
- **Discovery hooks:** big study milestones (finish all 30 days, ace a test, 30-day streak)
  guarantee a **rare egg / new archetype** — collection progress mirrors study progress.

---

## 5e. The house & a roaming pet (navigation as a guided tour)  ← NEXT to build

Treat the whole site as the pet's **home**: each page is a room/floor (主页=living room,
每日=study, 基础=library, 場面=outside, 测试=dojo, 笔记=desk). The pet *roams* it — and its
movement **guides the user to study different pages**:

- **Hops in to cheer:** when you open a study page, sometimes the pet bounces in from the
  screen edge, says a short Japanese line (generic 「がんばって！」 or **page-relevant** — e.g. on
  基础 it might say 「動詞[どうし]の活用[かつよう]、おさらいしよ！」), then hops off. Encouragement
  + a relevant phrase to read.
- **"It's out playing":** sometimes you return home and the pet isn't on its spot — a hint reads
  「キューブは『基础[きそ]』で あそんでるよ！」 with a *follow* button. Going there finds it (and
  you review verb conjugation / particles / 読み方 while you're there). The pet's whims **pull you
  into pages you'd otherwise skip** — that's the point.
- Not random thrashing: weighted toward areas you haven't studied lately; gated so it never nags.
  Text-only (no voice). Roaming sprite = a small fixed-position canvas animating across an edge,
  reusing the genome renderer.

> Constraints locked by the user: **no VOICEVOX / voice for the pet** (text only). The free-chat
> "talk to the pet" feature is built (text) but the user is reconsidering it — kept unobtrusive for
> now, decision deferred.

---

## 7. Home-page integration (fills the gutters)

- New home layout: the centered column stays; the pet gets a **companion panel** in the side
  space (or a hero band at the top of `#page-home`). On mobile it collapses to a card.
- Shows: the live animated pet, its name + stage, SXP-to-next-stage bar, meter pips, and 1–2
  quick care buttons + a speech bubble. Tapping opens the full **Pet** page/modal (care, 図鑑,
  yard, breeding).
- A new nav tab (🥚 / the pet's face) OR reuse the existing home card grid + the floating buddy.

---

## 8. Data model (localStorage, offline-safe)

```js
// jpn-pet
{
  v:1,
  active: "uid",                       // current pet
  coins: 0, sxp: 0,                    // currencies (sxp also drives stage)
  pets: {
    uid: {
      seed: 1234567,                   // → genome (deterministic render)
      species: "archetype-id",
      name: "もち",
      stage: "child",
      bornAt: ts, lastSeen: ts,
      meters: { hunger:80, clean:70, happy:90, energy:60, ts: lastDecayTs },
      hp: 100, sick: false, sickSince: null,   // §4a health/sickness/death
      mood: "happy",
      intelligence: 2,                 // unlocks chat tiers (egg/young → emote only; teen+ → chat)
      parents: ["uidA","uidB"]|null,   // for breeding lineage
      diedAt: null,                    // set on death → moves to memorial, keeps lineage
    }
  },
  dex: { "archetype-id": {seen:true, hatched:true} },   // 図鑑
  memorial: [ {name, species, bornAt, diedAt} ],        // graveyard (deaths are permanent)
  log: [ {ts, type:"session", sxp:10} ],                // event log (retroactive-safe)
  goneOutUntil: ts|null,
  tune: { /* decay rates, grace windows, offline-cap — all difficulty knobs */ }
}
```

- Add `jpn-pet` to the export/import backup key list.
- SXP/coins are granted by a single `petGrant(event)` called from the existing completion hooks
  (`markComplete`, test finish, streak tick) — one integration point, decoupled from rendering.

---

## 9. Build phases (incremental, each shippable)

- **Phase A — MVP (the heart) ✅ BUILT.** Procedural creature + genome; egg-of-fate → hatch from
  SXP; 4 care meters + feed/wash/clean/poop; HP + sickness + permanent death (§4a, forgiving,
  capped offline decay); mood expressions; home rail filling the gutters; speech tied to state.
- **Growth v2 ✅ BUILT (§3).** Progress-weighted (effort floor + best-score mastery); test/pron
  attempt logs; pet notices & comments on the attempt you just made.
- **Phase B — Alive & smart (NEXT).** The §5b/§5c layer + the chat merge:
  - B1 **Activity log + JP diary** (autonomous events while away; templated JP now, Claude-rich
    with a key) — *reading practice.*
  - B2 **Pet-initiated conversation** + the §5 persona chat (Sensei always on, pet unlocks at
    Teen) — *conversation practice.*
  - B3 **Evolution = register/dialect** (§5c): a `register` field driving canned lines + Claude
    prompt (Kansai / Okinawa / net-slang / keigo / literary / angry) — *language-variety exposure.*
  - B4 **図鑑 collection + memorial**; species archetypes; VOICEVOX pet voice.
- **Phase C — Social home.** Multiple pets / friends / parties (watch or join the JP), breeding
  (genome crossover), milestone-gated rare eggs, mutations.

Recommended B order: **B1 (diary) → B2 (conversation) → B3 (evolution) → B4 (図鑑)** — each is a
self-contained reading/speaking surface, and B1 gives the most "alive" feel per unit of work.

---

## 10. Decisions locked (✓) & open

- ✓ **North star:** the pet is a *study/practice tool*; every mechanic maps to a learning function (§0).
- ✓ **Art:** procedural pixel creatures (seed→genome); HD-2D sprite swap kept as a later upgrade.
- ✓ **Growth:** effort floor + **progress-weighted, un-gameable best-score mastery** (§3). BUILT.
- ✓ **Care stakes:** real — **can die** (permanent), **never runs away**; sickness & mood first-class;
  fair via care≠growth + capped offline decay + warnings (§4/§4a).
- ✓ **AI:** "Sensei is the brain, the pet is the heart" — Sensei always on; pet is an additive,
  growing persona (§5).
- ✓ **Home placement:** side rail filling the gutters + mobile card.
- ✓ **Difficulty:** forgiving (tunable knobs).
- ✓ **Starter:** **one egg of fate** (auto-granted; user reverted the pick-from-3).

**Open questions for Phase B:**
1. **Diary depth without a key:** how rich should the *templated* (no-Claude) diary be? (A small
   curated JP event/sentence bank vs minimal one-liners.) Claude makes it rich either way.
2. **Conversation autonomy:** how proactive should the pet be — only after study, or also random
   "pings" on cold opens? (Risk of feeling naggy.)
3. **Evolution rarity & control:** fully random surprise, or a gentle nudge (e.g. a "send it
   abroad / give a book" action you can choose) so the user can *aim* for a dialect they want?
4. **Multi-pet cap (Phase C):** how many simultaneous pets/visitors before it's too busy/slow?

---

## A. Evaluation: "give each pet its own AI Agent"

**Verdict: adopt the *idea*, not the literal implementation.** Each pet *should* feel like it has
its own mind — stable personality, memory of your shared history, its own voice. Claude can deliver
that. But a *literal* always-on autonomous agent process per pet is impossible **and unnecessary**
here, for concrete reasons:

- **No server / no runtime.** This is a static site (GitHub Pages) + browser-only BYOK Claude.
  There is no place to host a process that "lives" while the app is closed. Tamagotchi and
  旅行カエル don't really run while away either — they **compute what happened on the next open**
  from elapsed time + RNG. We already do exactly this (B1's `rollActivity`). So "autonomy" is a
  *simulation computed on return*, not a background loop — and that's fine; it's the genre's trick.
- **Cost & redundancy.** A persistent agent burning tokens while nobody's watching is pure waste,
  and it's the user's own API key. N agents for N pets multiplies that for zero benefit.

**Recommended architecture — "agent-on-demand" (a persona, not a process):**
Model each pet as `agent = persona spec + memory + a generation function`, invoked only when needed:

1. **Persona spec (cheap, deterministic, always offline):** name, **nature** (§5d), **register/
   dialect** (§5c evolution), interests/activity-domains, address term for the user. Built from
   genome+state — no API needed.
2. **Memory (compact, in localStorage):** a rolling summary of shared history — recent events, your
   study trajectory (the test/pron deltas we now log), in-jokes, relationship with other pets. Small
   text blob fed into the prompt so the pet "remembers" you.
3. **Generation (one Claude call, only with a key, only when something is shown):**
   - on **return** → the catch-up diary/log, in the pet's voice & register, leveled to your N-level;
   - on **study** → a proactive line about how it went (uses the real score deltas);
   - on **chat** → a reply (this is the §5 Sensei/pet merge).
   One system prompt assembled from persona+memory+context. **Haiku** for cheap flavor (diary,
   greetings), **Sonnet** when it's actually tutoring.
4. **Fallback (no key):** the templated, nature-flavored generator already built (B1/§5d). The pet
   is always alive offline; Claude just makes its language fresh, varied, and N-level-adaptive.
5. **Multi-pet (Phase C):** generate the **whole household's day in ONE call** (not N calls) — the
   "agents" share a scene; cheaper and lets them reference each other.

**Net:** "one agent per pet" = **one persona + memory per pet, voiced by on-demand Claude calls
with a templated offline fallback.** This delivers the autonomy/character you want, fits a static
BYOK app, costs little, and never breaks offline. This is precisely the plan for **Phase B2**.

---

## B. ⭐ Production exercises (練習) — the missing output skill  ← HIGH PRIORITY, design

**The gap (user's insight):** the site is input-heavy (read, listen, comprehend) and the learner
can understand ~60–80% (kanji helps Chinese speakers) **but cannot PRODUCE** — build sentences,
apply grammar/vocab, speak on the spot (the gym situation). Comprehension ≠ production. We need a
deliberate **output-practice** section that drills *making* Japanese with what was just learned.

**Exercise types (production-focused):**
1. **語/助詞えらび (cloze)** — sentence with a blank; pick the right word/particle. Auto-graded.
   Cheap, fast, drills application + particles (a known weak spot).
2. **並べ替え (sentence building)** — arrange scrambled chunks into a correct sentence. Auto-graded
   (compare to answer). Trains word order / structure — core production.
3. **作文 (compose / translate-into-JP)** — prompt in zh/en (or a target grammar point) → learner
   writes a Japanese sentence. **Claude-graded** (BYOK): correctness + a natural rewrite + furigana
   + a short tip. Offline fallback: reveal a model answer to self-check.
4. **場面で言ってみる (say-it-in-context)** — a real scenario ("at the gym, ask where the lockers
   are") → produce a line. Claude-graded. Directly attacks the real-world transfer gap; reuses the
   場面/Scenarios themes.

**Where it lives:** a **練習 tab inside the daily lesson** (drills *that day's* grammar+vocab — the
tightest learn→apply loop), plus a later **mixed-review** mode pulling from all learned days.

**Generation & grading:** prefer **on-demand Claude** (BYOK) — "make 5 production exercises from Day
N's grammar+vocab, then grade my answers" → infinite, fresh, N-leveled, no authoring burden; reuses
`Assistant.complete`. Offline/no-key fallback: a small authored cloze/reorder set per day + compose
with model-answer self-check. Auto-gradable types work offline regardless.

**Ties to the system:** exercise scores log like tests/pron → feed the **progress-XP** growth model
(production is the hardest skill → high-value signal → the pet grows from genuine output, not just
reading). The pet can also react ("作文、上手になったね！").

**Open design choices (for the user):** which types to include; per-day vs standalone; on-demand
Claude vs authored set vs both.

---

## C. Group activity (Phase C, re-scoped) — visitors & a party = group-conversation practice

Locked scope: **one permanent owned pet**; others only **visit temporarily** (≈a day) then leave.
**No care for visitors. No breeding** (out of scope this version).

- **A friend visits:** occasionally (gated) a visitor pet — its own nature + dialect — shows up for
  a window (announced; a second small sprite). Brings variety of register/topic.
- **パーティー (join the group chat):** tap "みんなで はなす" → a group chat with your pet + 1–2
  visitors, each a distinct Claude persona. They banter in Japanese; **you join by typing.** Claude
  orchestrates the multi-voice turns. Optionally themed (a welcome party, planning an outing) for
  goal-oriented talk.
- **Learning value:** multi-party comprehension (turn-taking, referents), 相槌/reactions, register-
  switching across speakers, and **low-pressure production** (you must output to join). The complement
  to 1:1 chat; same BYOK brain, multi-persona. Speaking input (mic) is a *future* upgrade — text now.

---

## D. Community / "your pet as your representative" (FUTURE — next version, not now)

Vision: the pet represents the user socially. It "goes out" and meets *other users'* pets, shows off
what its owner studied ("うちの主人、今日これ覚えたよ！"), and comes home with news ("パパ、負けてられないよ！")
— a generative-agent social layer that motivates without becoming a hookup app (the *pet*, not the
person, is the social surface). Requires a backend/multiuser (the site is currently static, single-user).
Captured as a future direction; **do not build now.**

---

## E. World & narrative — 言霊 (kotodama)  ✅ intro BUILT

A coherent story that makes the product *believable* and ties every mechanic to studying,
without distracting from it. Built on a **real, teachable Japanese concept** (言霊 = "word-spirit,"
the soul of language — so the lore itself teaches culture).

- **The myth:** words carry a spirit, 言霊. As you genuinely learn Japanese, your words begin to
  *glow* and radiate 言霊. A dormant egg, which **feeds on 言霊**, is drawn to you and hatches/grows
  only as you deepen your Japanese. You were *chosen*.
- **Maps onto existing mechanics (re-skins, doesn't add complexity):**
  - **言霊 = the growth essence** (the existing Study-XP). The growth bar is now labeled 言霊; the
    more (and more genuinely — progress-weighted) you study, the more it fills → the pet grows.
  - **Care** keeps it alive; **言霊 (study)** makes it grow — the same care≠growth split, now with a why.
  - **Evolution** = the creature *absorbing the varieties of Japanese you touch* (Kansai, keigo,
    net-slang…) — it embodies the breadth of your learning.
  - **Death** = without 言霊/care the spirit fades. **Diary/chat** = the 言霊 made articulate.
- **Onboarding:** a one-time cinematic intro tells this story when the egg first appears (§ built).
- **Room to extend (future):** name the care currency 言の葉 (kotonoha, "word-leaves"); the community
  version (§D) = pets carrying their owner's 言霊 out to meet others. Keep it flavor, never a gate.

---

## F. OPEN ISSUE — home layout still feels unbalanced (revisit)

User feedback (kept on the radar, not yet resolved): the home page "feels weird — so much on the
left, very little on the right." Current layout = a centered `[pet 240 | content 880]` flex group
with equal gutters; mathematically balanced, but it *reads* left-heavy (the dense glowing pet box on
the left vs. a tall content column; the left gutter empty below the sticky pet).

Ideas to try later (pick after seeing it on the user's screen):
1. **Pet as a top hero band** on home (full-width card above a single centered content column) →
   removes left/right asymmetry entirely; the pet still leads.
2. **True two-rail dashboard** — add a slim right rail (streak / today's goal / quick links) so both
   gutters are intentionally used and symmetric.
3. **Tighter max-width** so the centered group's gutters are smaller (less "empty" feel).
4. **Fill the left column** below the sticky pet (mini activity feed / care reminders) so it isn't
   "a box then emptiness."
5. Float the pet as a **corner companion** and let content be a normal single centered column.

Recommendation: try (1) hero-band first — simplest, most likely to feel balanced. Revisit with the
user before committing.
