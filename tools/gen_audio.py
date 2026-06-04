#!/usr/bin/env python3
"""
gen_audio.py — Pre-generate real-voice audio for the JPN study site using VOICEVOX.

WHY: replaces mechanical system TTS with a real voice actor's voice (clearer pitch
accent → better for the "speak fluently" goal). Audio is generated OFFLINE into
audio/*.mp3 and played by the site with no runtime dependency.

PREREQUISITES
  1. VOICEVOX engine running locally (default http://localhost:50021).
     - GUI app: https://voicevox.hiroshiba.jp/  (free, voices from real voice actors)
     - or the headless engine / Docker image.
  2. ffmpeg on PATH (to convert WAV -> MP3; saves a lot of space).
  3. Python 3.9+ (only stdlib used).

USAGE
  python3 tools/gen_audio.py                 # generate paragraph sentences + vocab
  python3 tools/gen_audio.py --speaker 2     # pick a different VOICEVOX speaker id
  python3 tools/gen_audio.py --no-vocab      # paragraphs only
  python3 tools/gen_audio.py --wav           # keep WAV (skip ffmpeg/MP3)
  python3 tools/gen_audio.py --list-speakers # print available speakers and exit

OUTPUT
  audio/d{day}_s{idx}.mp3        # each paragraph sentence  (key "d15_s3")
  audio/vocab/{sha1}.mp3         # each vocab reading
  audio/manifest.json           # { "d15_s3": "audio/d15_s3.mp3", ... }

The script is IDEMPOTENT: existing files are skipped. Re-run after adding days.

NOTE on overriding with a human recording: the simplest way is to OVERWRITE the
existing same-named file the manifest already points to (e.g. replace audio/d17_s7.mp3
for a 名句) — no manifest edit needed, since the key→path mapping is unchanged.
(The site loads audio/manifest.js as a global, not manifest.json, so hand-editing
only the .json would NOT take effect and would be overwritten on the next run.
If you add brand-new files, re-run this script — it regenerates BOTH json + js.)
"""

import argparse, hashlib, json, os, re, subprocess, sys, urllib.parse, urllib.request

ROOT       = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LESSONS    = os.path.join(ROOT, "js", "lessons.js")
SCENARIOS  = os.path.join(ROOT, "js", "scenarios.js")
SCN_ADULT  = os.path.join(ROOT, "js", "scenarios-adult.js")
DAILY      = os.path.join(ROOT, "js", "daily.js")
REFER      = os.path.join(ROOT, "js", "reference.js")
GOJUON     = os.path.join(ROOT, "js", "gojuon.js")
PET_JS     = os.path.join(ROOT, "js", "pet.js")
AUDIO_DIR  = os.path.join(ROOT, "audio")
VOCAB_DIR  = os.path.join(AUDIO_DIR, "vocab")
MANIFEST   = os.path.join(AUDIO_DIR, "manifest.json")
ENGINE     = os.environ.get("VOICEVOX_URL", "http://localhost:50021")

# Per-role scenario voices as (speaker_id, speedScale). Two contrasting voices so the
# learner can tell who is talking. speedScale NORMALIZES tempo: the male speaker (#11)
# naturally talks ~1.5x faster than the female (#16) — measured ~6.8 vs ~4.5 mora/s —
# so we slow him and nudge her up, landing both near ~5 mora/s. The runtime <audio>
# playbackRate (global speed lever) then scales everything uniformly on top of this.
SCN_VOICE   = {"c": (11, 0.80), "s": (16, 1.08)}   # 11 玄野武宏/ノーマル(男) · 16 九州そら/ノーマル(女)
# 五十音 — every kana, for the interactive chart (keys kana_<hira>); clear default voice.
KANA = list("あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん"
            "がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ") + [
    "きゃ","きゅ","きょ","しゃ","しゅ","しょ","ちゃ","ちゅ","ちょ","にゃ","にゅ","にょ",
    "ひゃ","ひゅ","ひょ","みゃ","みゅ","みょ","りゃ","りゅ","りょ","ぎゃ","ぎゅ","ぎょ",
    "じゃ","じゅ","じょ","びゃ","びゅ","びょ","ぴゃ","ぴゅ","ぴょ"]
# 🔞 adult mode: an intimate/sultry pair — mellow male + sexy female.
ADULT_VOICE = {"c": (84, 0.92), "s": (17, 1.0)}    # 84 青山龍星/しっとり(男) · 17 九州そら/セクシー(女)
# 言霊 first-login intro narration — a calm, elegant, "big-sister" voice (NOT a gruff
# old-man narrator). 16 = 九州そら/ノーマル: mature & clear. Speed 1.1 = a gentle, natural
# pace (VOICEVOX speedScale preserves pitch, so it stays graceful).
INTRO_VOICE = (16, 1.1)

# ---- furigana / normalization (mirrors app.js toPlain + speechNorm) ----
BRACKET = re.compile(r"\[[^\]]+\]")
def to_plain(text):           # 漢字[かな] -> 漢字 ; drop furigana readings
    return BRACKET.sub("", text)
def speech_norm(text):        # what the site actually speaks / keys on
    t = to_plain(text).replace("〜", "").replace("～", "")
    return t.strip(" 、。・「」『』\t\n")
def despace(text):
    """Drop manual readability spaces (分かち書き). VOICEVOX treats every space as an
    accent-phrase boundary and pauses there → choppy, word-by-word delivery (this is what
    bit the 言霊 intro). Applied ONLY to the passage/dialogue surfaces, whose audio keys
    are POSITIONAL (d{day}_s{i}, scn_<id>_<i>), so collapsing spaces never changes a key —
    it only smooths the synthesized reading. Current content has no such spaces, so this is
    a no-op safeguard for any future authored text that adds them for the eye."""
    return re.sub(r"[ 　]", "", text)

# ---- reading-verification helpers (used by --verify) ----
# Compares the kana I HAND-AUTHORED in the furigana against an INDEPENDENT
# morphological analyzer (UniDic via fugashi). A mismatch flags either an
# authoring typo OR a genuinely tricky/ambiguous reading — both worth a glance.
FURI = re.compile(r"([㐀-鿿々〆ヶ]+)\[([^\]]+)\]")
def authored_reading(text):   # 漢字[かな]→かな, keep surrounding kana → full kana string
    return FURI.sub(lambda m: m.group(2), text)
def _hira2kata(s):
    return "".join(chr(ord(c) + 0x60) if "ぁ" <= c <= "ゖ" else c for c in s)
def norm_kana(s):             # canonical katakana, spelling form, punctuation/ascii stripped
    return re.sub(r"[^ァ-ヺー]", "", _hira2kata(s))

# ---- crude extractor for paragraph[].jp and vocab[].r from lessons.js ----
# (lessons.js is hand-authored JS data; we read the string literals we need.)
def load_lessons():
    src = open(LESSONS, encoding="utf-8").read()
    days = []
    # split into day objects by "day:N"
    for m in re.finditer(r"\bday\s*:\s*(\d+)\b", src):
        day = int(m.group(1))
        start = m.end()
        nxt = re.search(r"\bday\s*:\s*\d+\b", src[start:])
        chunk = src[start: start + (nxt.start() if nxt else len(src))]
        # paragraph sentences: jp:"..." that appear before vocab section
        para_area = chunk.split("vocab:")[0]
        sents = re.findall(r'jp\s*:\s*"((?:[^"\\]|\\.)*)"', para_area)
        # vocab readings: r:"..." inside vocab:[ ... ] (before grammar:)
        vocab_area = ""
        if "vocab:" in chunk:
            vocab_area = chunk.split("vocab:")[1].split("grammar:")[0]
        readings = re.findall(r'\br\s*:\s*"((?:[^"\\]|\\.)*)"', vocab_area)
        # EVERY OTHER spoken line — jp:"..." AFTER the paragraph area:
        #   vocab example sentences (ex.jp), grammar examples, conversation lines.
        # These are keyed by content ("x_<normalized>") so the web app can look them
        # up the same way it looks up vocab readings. Paragraph jp (positional keys
        # d{day}_s{i}) are excluded by slicing off para_area first.
        after_para = chunk.split("vocab:", 1)[1] if "vocab:" in chunk else ""
        extra = re.findall(r'jp\s*:\s*"((?:[^"\\]|\\.)*)"', after_para)
        days.append({"day": day, "sents": sents, "readings": readings, "extra": extra})
    return days

def _load_js_array(path):
    """Read a `window.X = [ ... ];` data file and JSON-parse the array literal."""
    src = open(path, encoding="utf-8").read()
    return json.loads(src[src.index("["): src.rindex("]") + 1])

def load_scenarios():
    """[{id, vocab:[{w,r}], dialogue:[{jp, sp}]}] from js/scenarios.js."""
    try:
        return _load_js_array(SCENARIOS)
    except Exception as e:
        print(f"  (skip scenarios: {e})"); return []

def load_daily():
    """每日一句 lines from js/daily.js — phrase jp + example ex.jp (regex; JS not JSON)."""
    try:
        src = open(DAILY, encoding="utf-8").read()
    except OSError:
        return []
    return re.findall(r'jp\s*:\s*"((?:[^"\\]|\\.)*)"', src)

def load_reference():
    """example sentences in js/reference.js (the tappable .r-ex lines) — every jp:"…"."""
    try:
        src = open(REFER, encoding="utf-8").read()
    except OSError:
        return []
    return re.findall(r'jp\s*:\s*"((?:[^"\\]|\\.)*)"', src)

def load_gojuon_words():
    """五十音 chart example-word readings (kana_<reading>) — the r:"…" in gojuon.js cells."""
    try:
        src = open(GOJUON, encoding="utf-8").read()
    except OSError:
        return []
    return re.findall(r'r:"([^"]+)"', src)

def load_intro():
    """言霊 first-login intro narration — the jp:"…" lines inside `const INTRO=[…]` in pet.js."""
    try:
        src = open(PET_JS, encoding="utf-8").read()
    except OSError:
        return []
    m = re.search(r"const\s+INTRO\s*=\s*\[(.*?)\];", src, re.S)
    if not m:
        return []
    # Two cleanups so VOICEVOX reads it as flowing narration, not word-by-word:
    #  • strip the manual readability spaces ("言葉には 魂が 宿る") — VOICEVOX breaks an
    #    accent phrase at every space and pauses there (the choppy delivery).
    #  • turn the visual em-dashes (——) into a single 、 so we get one clean pause instead
    #    of VOICEVOX's unpredictable handling. (NOT the katakana長音 ー — that's a phoneme.)
    out = []
    for jp in re.findall(r'jp\s*:\s*"((?:[^"\\]|\\.)*)"', m.group(1)):
        jp = re.sub(r"[—―─]+", "、", jp)
        jp = re.sub(r"[ 　]", "", jp)
        out.append(jp)
    return out

# ---- VOICEVOX HTTP API ----
def vv_post(path, params=None, data=None):
    url = ENGINE + path + ("?" + urllib.parse.urlencode(params) if params else "")
    req = urllib.request.Request(url, data=data, method="POST",
                                 headers={"Content-Type": "application/json"} if data else {})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()

def list_speakers():
    with urllib.request.urlopen(ENGINE + "/speakers", timeout=30) as r:
        for sp in json.loads(r.read()):
            for st in sp["styles"]:
                print(f'  id={st["id"]:>3}  {sp["name"]} / {st["name"]}')

def synth_wav(text, speaker, speed=None):
    query = vv_post("/audio_query", {"text": text, "speaker": speaker})
    if speed is not None:                      # override tempo (normalize per-speaker)
        q = json.loads(query); q["speedScale"] = speed
        query = json.dumps(q).encode("utf-8")
    return vv_post("/synthesis", {"speaker": speaker}, data=query)

def line_seconds(text, speaker, speed):
    """Spoken length of `text` in seconds (mora + pause durations / speed), excluding the
    leading/trailing silence — used to time the per-line highlight inside the ONE combined
    intro clip. Approximate but smooth (highlight is a soft glow, not a hard cut)."""
    q = json.loads(vv_post("/audio_query", {"text": text, "speaker": speaker}))
    ss = speed or q.get("speedScale") or 1.0
    s = 0.0
    for ph in q.get("accent_phrases", []):
        for mo in ph.get("moras", []):
            s += (mo.get("consonant_length") or 0.0) + (mo.get("vowel_length") or 0.0)
        pm = ph.get("pause_mora")
        if pm:
            s += (pm.get("consonant_length") or 0.0) + (pm.get("vowel_length") or 0.0)
    return s / ss

def to_mp3(wav_bytes, out_path):
    p = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", "pipe:0",
                        "-codec:a", "libmp3lame", "-qscale:a", "4", out_path],
                       input=wav_bytes)
    return p.returncode == 0

def verify_readings():
    """Independent reading check: my hand-authored furigana vs UniDic (fugashi).
    Lists every line where the two disagree, for a quick human review. Catches both
    authoring typos and genuinely ambiguous readings. No audio is generated."""
    try:
        import fugashi
    except ImportError:
        sys.exit("✗ needs fugashi + unidic-lite:  pip3 install --user fugashi unidic-lite")
    tagger = fugashi.Tagger()

    def unidic_reading(plain):
        out = []
        for w in tagger(plain):
            k = getattr(w.feature, "kana", None)
            out.append(k if k and k != "*" else w.surface)
        return norm_kana("".join(out))

    # collect (label, text-with-furigana) for every spoken/furigana-bearing line
    items = []
    for d in load_lessons():
        for i, jp in enumerate(d["sents"]):
            items.append((f"D{d['day']} 文{i}", jp))
        for jp in d["extra"]:
            items.append((f"D{d['day']} 例/会話", jp))
    # vocab w↔r pairs (verify the authored reading r against UniDic reading of w)
    src = open(LESSONS, encoding="utf-8").read()
    for m in re.finditer(r'w\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*r\s*:\s*"((?:[^"\\]|\\.)*)"', src):
        w, r = m.group(1), m.group(2)
        items.append((f"単語 {w}", f"{w}[{r}]" if not FURI.search(w) else w, r))

    flags, checked = [], 0
    for it in items:
        label, text = it[0], it[1]
        if len(it) == 3:                       # vocab pair: authored = r directly
            authored = norm_kana(it[2]); plain = to_plain(text).replace("〜", "").replace("～", "")
        else:
            authored = norm_kana(authored_reading(text)); plain = to_plain(text)
        if not authored:
            continue
        checked += 1
        got = unidic_reading(plain)
        if authored != got:
            flags.append((label, to_plain(text), authored, got))

    report = os.path.join(os.path.dirname(os.path.abspath(__file__)), "verify_report.txt")
    with open(report, "w", encoding="utf-8") as f:
        f.write(f"Reading verification — {checked} lines checked, {len(flags)} mismatches\n")
        f.write("(authored furigana  vs  UniDic guess — review each; many are OK ambiguous cases)\n\n")
        for label, plain, a, g in flags:
            f.write(f"[{label}]\n  text : {plain}\n  mine : {a}\n  unidic: {g}\n\n")
    print(f"Checked {checked} lines. {len(flags)} mismatches → {report}")
    for label, plain, a, g in flags[:40]:
        print(f"  ⚠ {label}: {plain}\n      mine={a}  unidic={g}")
    if len(flags) > 40:
        print(f"  … +{len(flags)-40} more in {report}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--speaker", type=int, default=2, help="VOICEVOX speaker id (default 2 = 四国めたん ノーマル)")
    ap.add_argument("--no-vocab", action="store_true")
    ap.add_argument("--no-ex", action="store_true", help="skip example/conversation lines (used for alternate voices to save space)")
    ap.add_argument("--wav", action="store_true", help="keep WAV, skip MP3 conversion")
    ap.add_argument("--list-speakers", action="store_true")
    ap.add_argument("--verify", action="store_true",
                    help="check every furigana reading against UniDic (fugashi) and report mismatches; no synthesis")
    ap.add_argument("--voice-dir", default=None,
                    help="generate an ALTERNATE voice into audio/voices/<name>/ (same filenames as default; "
                         "the web app plays it by path-prefix swap with fallback). Use with --speaker / a different "
                         "engine via VOICEVOX_URL (e.g. AivisSpeech on :10101).")
    args = ap.parse_args()

    if args.list_speakers:
        list_speakers(); return
    if args.verify:
        verify_readings(); return

    # sanity: engine reachable?
    try:
        urllib.request.urlopen(ENGINE + "/version", timeout=5).read()
    except Exception as e:
        sys.exit(f"✗ VOICEVOX engine not reachable at {ENGINE}\n  Start VOICEVOX first (see header of this file). {e}")

    # default → audio/ ; alternate voice → audio/voices/<name>/ (same filenames).
    base    = AUDIO_DIR if not args.voice_dir else os.path.join(AUDIO_DIR, "voices", args.voice_dir)
    vocab_d = os.path.join(base, "vocab")
    ex_d    = os.path.join(base, "ex")
    manifest_path = os.path.join(base, "manifest.json")
    os.makedirs(base, exist_ok=True)
    os.makedirs(vocab_d, exist_ok=True)
    os.makedirs(ex_d, exist_ok=True)
    manifest = json.load(open(manifest_path, encoding="utf-8")) if os.path.exists(manifest_path) else {}
    ext = "wav" if args.wav else "mp3"
    made = skipped = 0

    def emit(key, text, out_path, speaker=None, speed=None):
        nonlocal made, skipped
        spoken = speech_norm(text)
        if not spoken:
            return
        rel_path = os.path.relpath(out_path, ROOT).replace(os.sep, "/")
        if os.path.exists(out_path):
            manifest[key] = rel_path; skipped += 1; return
        wav = synth_wav(spoken, args.speaker if speaker is None else speaker, speed)
        if args.wav:
            open(out_path, "wb").write(wav)
        else:
            if not to_mp3(wav, out_path):
                sys.exit("✗ ffmpeg failed — install ffmpeg or run with --wav")
        manifest[key] = rel_path; made += 1
        print(f"  ✓ {key}  «{spoken[:24]}»")

    for d in load_lessons():
        for i, jp in enumerate(d["sents"]):
            key = f'd{d["day"]}_s{i}'
            emit(key, despace(jp), os.path.join(base, f"{key}.{ext}"))   # positional key → safe to despace
        if not args.no_vocab:
            for r in d["readings"]:
                spoken = speech_norm(r)
                if not spoken:
                    continue
                # manifest KEY = readable normalized reading ("v_をとおして") so the
                # web app can look it up directly; FILENAME = short hash (filesystem-safe).
                h = hashlib.sha1(spoken.encode("utf-8")).hexdigest()[:12]
                emit(f"v_{spoken}", r, os.path.join(vocab_d, f"{h}.{ext}"))
        # example sentences + grammar examples + conversation lines.
        # KEY = "x_<normalized spoken text>" so app.js can look it up via speechNorm();
        # FILENAME = short hash. De-dup within a day in case the same line repeats.
        if args.no_ex:
            continue
        seen = set()
        for jp in d["extra"]:
            spoken = speech_norm(jp)
            if not spoken or spoken in seen:
                continue
            seen.add(spoken)
            h = hashlib.sha1(spoken.encode("utf-8")).hexdigest()[:12]
            emit(f"x_{spoken}", jp, os.path.join(ex_d, f"{h}.{ext}"))

    # ---- scenarios + 每日一句 (default voice only; alt voices fall back to these) ----
    if not args.voice_dir:
        scn_d = os.path.join(base, "scn")
        os.makedirs(scn_d, exist_ok=True)
        for s in load_scenarios():
            sid = s.get("id", "scn")
            # vocab: neutral/default voice, keyed v_<reading> (shared with lesson vocab)
            if not args.no_vocab:
                for v in s.get("vocab", []):
                    spoken = speech_norm(v.get("r") or v.get("w") or "")
                    if not spoken:
                        continue
                    h = hashlib.sha1(spoken.encode("utf-8")).hexdigest()[:12]
                    emit(f"v_{spoken}", v.get("r") or v.get("w"),
                         os.path.join(vocab_d, f"{h}.{ext}"))
            # dialogue: positional key scn_<id>_<i>, per-role speaker baked in.
            # strip a leading speaker label ("患者：…") so the voice doesn't read it aloud.
            for i, d in enumerate(s.get("dialogue", [])):
                spk, spd = SCN_VOICE.get(d.get("sp"), (args.speaker, None))
                line = re.sub(r"^[^：:\n]{1,8}[：:]\s*", "", d.get("jp", ""))
                emit(f"scn_{sid}_{i}", despace(line),
                     os.path.join(scn_d, f"{sid}_{i}.{ext}"), speaker=spk, speed=spd)
        # 🔞 adult-mode dialogue (scenarios-adult.js): keyed scna_<id>_<i>, sultry voices.
        adult = None
        if os.path.exists(SCN_ADULT):
            try:
                _src = open(SCN_ADULT, encoding="utf-8").read()
                adult = json.loads(_src[_src.index("{"): _src.rindex("}") + 1])
            except Exception as e:
                print(f"  (skip adult scenarios: {e})")
        if isinstance(adult, dict):
            for sid, lines in adult.items():
                for i, d in enumerate(lines):
                    spk, spd = ADULT_VOICE.get(d.get("sp"), (args.speaker, None))
                    line = re.sub(r"^[^：:\n]{1,8}[：:]\s*", "", d.get("jp", ""))
                    emit(f"scna_{sid}_{i}", despace(line),
                         os.path.join(scn_d, f"a_{sid}_{i}.{ext}"), speaker=spk, speed=spd)
        # 每日一句: phrase + example lines, keyed x_<text> (shared example namespace)
        if not args.no_ex:
            for jp in load_daily():
                spoken = speech_norm(jp)
                if not spoken:
                    continue
                h = hashlib.sha1(spoken.encode("utf-8")).hexdigest()[:12]
                emit(f"x_{spoken}", jp, os.path.join(ex_d, f"{h}.{ext}"))
        # 言霊 first-login intro narration — synthesized as ONE continuous passage
        # (key intro_all) so VOICEVOX phrases the whole thing like a real narrator,
        # not 5 disjoint clips stitched with gaps. intro_marks holds the start time
        # (s) of each display line so the web app can sync the line-by-line glow.
        # Fixed elegant voice, NOT voice-swapped → same on every first login.
        ispk, ispd = INTRO_VOICE
        intro_lines = load_intro()
        if intro_lines:
            emit("intro_all", "".join(intro_lines),
                 os.path.join(base, f"intro_all.{ext}"), speaker=ispk, speed=ispd)
            marks, acc = [], 0.0
            for jp in intro_lines:
                marks.append(round(acc, 3))
                try:
                    acc += line_seconds(speech_norm(jp), ispk, ispd)
                except Exception:
                    acc += 3.0
            manifest["intro_marks"] = marks
            print(f"  ✓ intro_all  (marks: {marks})")

    # ---- content audio that EVERY voice must cover (so changing the voice applies
    #      globally): reference-page examples (x_) + the 五十音 chart (kana_). ----
    if not args.no_ex:
        for jp in load_reference():
            spoken = speech_norm(jp)
            if not spoken:
                continue
            h = hashlib.sha1(spoken.encode("utf-8")).hexdigest()[:12]
            emit(f"x_{spoken}", jp, os.path.join(ex_d, f"{h}.{ext}"))
    kana_d = os.path.join(base, "kana"); os.makedirs(kana_d, exist_ok=True)
    for k in KANA + load_gojuon_words():     # single kana + chart example words (kana_<reading>)
        if not k:
            continue
        h = hashlib.sha1(k.encode("utf-8")).hexdigest()[:12]
        emit(f"kana_{k}", k, os.path.join(kana_d, f"{h}.{ext}"))

    json.dump(manifest, open(manifest_path, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    if not args.voice_dir:
        # default voice → emit the JS manifest the site loads (file://-safe). Alternate
        # voices need no manifest: the app plays them by swapping the path prefix.
        with open(os.path.join(AUDIO_DIR, "manifest.js"), "w", encoding="utf-8") as f:
            f.write("window.AUDIO_MANIFEST=" + json.dumps(manifest, ensure_ascii=False) + ";\n")
    print(f"\nDone ({args.voice_dir or 'default'}). generated={made}  skipped(existing)={skipped}  total={len(manifest)}")
    print(f"Manifest: {manifest_path}")

if __name__ == "__main__":
    main()
