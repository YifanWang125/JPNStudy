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

ROOT      = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LESSONS   = os.path.join(ROOT, "js", "lessons.js")
AUDIO_DIR = os.path.join(ROOT, "audio")
VOCAB_DIR = os.path.join(AUDIO_DIR, "vocab")
MANIFEST  = os.path.join(AUDIO_DIR, "manifest.json")
ENGINE    = os.environ.get("VOICEVOX_URL", "http://localhost:50021")

# ---- furigana / normalization (mirrors app.js toPlain + speechNorm) ----
BRACKET = re.compile(r"\[[^\]]+\]")
def to_plain(text):           # 漢字[かな] -> 漢字 ; drop furigana readings
    return BRACKET.sub("", text)
def speech_norm(text):        # what the site actually speaks / keys on
    t = to_plain(text).replace("〜", "").replace("～", "")
    return t.strip(" 、。・「」『』\t\n")

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

def synth_wav(text, speaker):
    query = vv_post("/audio_query", {"text": text, "speaker": speaker})
    return vv_post("/synthesis", {"speaker": speaker}, data=query)

def accent_data(text, speaker):
    """Per-accent-phrase pitch info for the OJAD-style high/low contour.
    Returns [{a:<downstep mora, 1-based; 0=heiban>, m:[mora katakana,...]}, ...]."""
    q = json.loads(vv_post("/audio_query", {"text": text, "speaker": speaker}))
    out = []
    for ap in q.get("accent_phrases", []):
        moras = [m["text"] for m in ap.get("moras", [])]
        if moras:
            out.append({"a": ap.get("accent", 0), "m": moras})
    return out

def build_pitch(speaker):
    """Pre-compute pitch-accent contours for every spoken line → audio/pitch.js (+ .json).
    Keyed identically to the audio manifest (d{day}_s{i} / v_<reading> / x_<text>) so the
    web app can look them up. Runs offline; the site needs no engine at runtime."""
    try:
        urllib.request.urlopen(ENGINE + "/version", timeout=5).read()
    except Exception as e:
        sys.exit(f"✗ VOICEVOX engine not reachable at {ENGINE}. Start it first. {e}")
    pitch = {}
    def setp(key, text):
        spoken = speech_norm(text)
        if not spoken or key in pitch:
            return
        try:
            pitch[key] = accent_data(spoken, speaker)
        except Exception as e:
            print(f"  pitch fail {key}: {e}")
    for d in load_lessons():
        for i, jp in enumerate(d["sents"]):
            setp(f'd{d["day"]}_s{i}', jp)
        for r in d["readings"]:
            sp = speech_norm(r)
            if sp:
                setp(f"v_{sp}", r)
        for jp in d["extra"]:
            sp = speech_norm(jp)
            if sp:
                setp(f"x_{sp}", jp)
    os.makedirs(AUDIO_DIR, exist_ok=True)
    json.dump(pitch, open(os.path.join(AUDIO_DIR, "pitch.json"), "w", encoding="utf-8"), ensure_ascii=False)
    open(os.path.join(AUDIO_DIR, "pitch.js"), "w", encoding="utf-8").write(
        "window.PITCH=" + json.dumps(pitch, ensure_ascii=False) + ";\n")
    print(f"pitch entries: {len(pitch)} → audio/pitch.js (+ pitch.json)")

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
    ap.add_argument("--pitch", action="store_true",
                    help="pre-compute pitch-accent contours → audio/pitch.js (no audio synthesis)")
    ap.add_argument("--voice-dir", default=None,
                    help="generate an ALTERNATE voice into audio/voices/<name>/ (same filenames as default; "
                         "the web app plays it by path-prefix swap with fallback). Use with --speaker / a different "
                         "engine via VOICEVOX_URL (e.g. AivisSpeech on :10101).")
    args = ap.parse_args()

    if args.list_speakers:
        list_speakers(); return
    if args.verify:
        verify_readings(); return
    if args.pitch:
        build_pitch(args.speaker); return

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

    def emit(key, text, out_path):
        nonlocal made, skipped
        spoken = speech_norm(text)
        if not spoken:
            return
        rel_path = os.path.relpath(out_path, ROOT).replace(os.sep, "/")
        if os.path.exists(out_path):
            manifest[key] = rel_path; skipped += 1; return
        wav = synth_wav(spoken, args.speaker)
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
            emit(key, jp, os.path.join(base, f"{key}.{ext}"))
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
