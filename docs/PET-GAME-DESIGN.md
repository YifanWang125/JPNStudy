# 🥚 Study Pet — design doc (v1.1)

A Tamagotchi-style companion that **grows from real study progress**, not random rewards.
The goal: a daily reason to come back, an emotional stake in studying, and — once grown —
a chat buddy that makes studying feel less lonely. Collectible, randomized, cute/cool.

> Status: **DESIGN / PROPOSAL**. Nothing built yet. v1.0 (scenarios audio, speed,
> adult mode) is done. This is the v1.1 plan to review before building.

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

## 3. Lifecycle & growth (tied to study)

```
🥚 Egg → 🐣 Hatchling → 🐤 Child → 🦊 Teen → 🦁 Adult → 🧓 Elder
```

**Growth currency = Study XP (SXP)**, earned ONLY from real study events the app already records:

| Study action (already tracked)                | SXP |
|-----------------------------------------------|-----|
| Complete a session (morning/noon/night)       | +10 |
| Finish all 3 sessions of a day                | +20 bonus |
| Daily streak tick (active today)              | +15 |
| Finish a test (per %)                          | +0.5×score% |
| New vocab/grammar reviewed (per item, capped) | +1  |
| Hit the home "daily goal"                      | +25 |

- Stage thresholds are cumulative SXP gates (e.g. Egg hatches at 30 SXP ≈ a couple of sessions).
- **Hatching specifically requires study**, not time: the egg shows a crack meter that fills with SXP.
- SXP is derived/recomputed from existing progress where possible (idempotent), plus an event log
  so retroactive progress counts when the pet is first adopted.

**Not studying never kills the pet** — only *neglecting care* does (see §4a). Not studying just
stalls *growth* (no SXP). This keeps stakes real (death is possible) but fair (a busy week of
quick care-taps keeps it alive even with zero study).

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

## 6. Collection / breeding / discovery (Typeless-style, later phase)

- **図鑑 (Pokédex)**: a collection book of species you've discovered; silhouettes for undiscovered.
- **Going out & friends:** once Adult, the pet can "go out to play" (a study-gated cooldown).
  It returns with: a **new egg**, a **friend** (NPC creature added to your home yard), or an item.
- **Breeding:** pair two owned adults → an egg whose genome is a **crossover + small mutation**
  of the parents (visible inherited parts/colors). New species archetypes unlock via milestones.
- **Discovery hooks:** big study milestones (finish all 30 days, ace a test, 30-day streak)
  guarantee a **rare egg / new archetype** — collection progress mirrors study progress.

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

- **Phase A — MVP (the heart):** procedural creature renderer + genome; egg→hatch from SXP;
  4 care meters + feed/wash/clean/poop; **HP + sickness + death** (§4a) with capped offline decay
  & warning banners; mood-driven expressions; home companion panel filling the gutters; pet speech
  bubbles tied to state; wire SXP/coins into existing study hooks; backup integration (`jpn-pet`).
  Sensei (📖) stays exactly as today — untouched and always available. *Delivers the daily ritual,
  visible study-driven growth, and real stakes.*
- **Phase B — Brains & book:** full stage ladder; intelligence tiers; **pet chat layer added on
  top of Sensei** (persona switch in one panel — §5; Sensei always on, pet unlocks at Teen);
  in-character Claude; 図鑑 collection page + memorial; species archetypes; VOICEVOX pet voice.
- **Phase C — Social/collection:** going out, friends/yard, **breeding (genome crossover)**,
  milestone-gated rare eggs, mutations.

Recommend building **Phase A** first, reviewing the feel, then B, then C.

---

## 10. Decisions locked (✓) & remaining

- ✓ **Art:** procedural pixel creatures (seed→genome), HD-2D sprite-sheet swap kept as a later
  upgrade path.
- ✓ **Care stakes:** real — pet **can die** (permanent), **never runs away**; sickness & mood
  are first-class; fairness via care≠growth + capped offline decay + warnings (§4 / §4a).
- ✓ **AI contradiction resolved:** "Sensei is the brain, the pet is the heart" — Sensei (📖) is
  always-on tutoring regardless of pet state; the pet is an additive, growing chat persona that
  defers to Sensei while young (§5). Help is never gated on the pet.
- ✓ **Next step:** refine design first (this pass) — not building yet.

**Remaining decisions — now LOCKED (✓):**
1. ✓ **Home placement:** a **side companion panel filling the gutters** of the centered home page
   (collapses to a card on mobile). Directly fixes the "big empty sides" complaint.
2. ✓ **Difficulty:** **forgiving** — death needs ~5–7 days of zero care *with visible warnings*;
   offline catch-up capped ~48 h. All values exposed as `tune` knobs to adjust after playtest.
3. ✓ **Starter:** **pick from 3 random eggs** (light "starter Pokémon" moment, more ownership).

→ All design decisions are locked. Building **Phase A** (the heart) next.
