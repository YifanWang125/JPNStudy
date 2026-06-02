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
        days.append({"day": day, "sents": sents, "readings": readings})
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

def to_mp3(wav_bytes, out_path):
    p = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", "pipe:0",
                        "-codec:a", "libmp3lame", "-qscale:a", "4", out_path],
                       input=wav_bytes)
    return p.returncode == 0

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--speaker", type=int, default=2, help="VOICEVOX speaker id (default 2 = 四国めたん ノーマル)")
    ap.add_argument("--no-vocab", action="store_true")
    ap.add_argument("--wav", action="store_true", help="keep WAV, skip MP3 conversion")
    ap.add_argument("--list-speakers", action="store_true")
    args = ap.parse_args()

    if args.list_speakers:
        list_speakers(); return

    # sanity: engine reachable?
    try:
        urllib.request.urlopen(ENGINE + "/version", timeout=5).read()
    except Exception as e:
        sys.exit(f"✗ VOICEVOX engine not reachable at {ENGINE}\n  Start VOICEVOX first (see header of this file). {e}")

    os.makedirs(AUDIO_DIR, exist_ok=True)
    os.makedirs(VOCAB_DIR, exist_ok=True)
    manifest = json.load(open(MANIFEST, encoding="utf-8")) if os.path.exists(MANIFEST) else {}
    ext = "wav" if args.wav else "mp3"
    made = skipped = 0

    def emit(key, text, out_path, rel_path):
        nonlocal made, skipped
        spoken = speech_norm(text)
        if not spoken:
            return
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
            emit(key, jp, os.path.join(AUDIO_DIR, f"{key}.{ext}"), f"audio/{key}.{ext}")
        if not args.no_vocab:
            for r in d["readings"]:
                spoken = speech_norm(r)
                if not spoken:
                    continue
                # manifest KEY = readable normalized reading ("v_をとおして") so the
                # web app can look it up directly; FILENAME = short hash (filesystem-safe).
                h = hashlib.sha1(spoken.encode("utf-8")).hexdigest()[:12]
                emit(f"v_{spoken}", r, os.path.join(VOCAB_DIR, f"{h}.{ext}"), f"audio/vocab/{h}.{ext}")

    json.dump(manifest, open(MANIFEST, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    # also emit a JS manifest so audio works on file:// (double-click) where fetch() is blocked
    manifest_js = os.path.join(AUDIO_DIR, "manifest.js")
    with open(manifest_js, "w", encoding="utf-8") as f:
        f.write("window.AUDIO_MANIFEST=" + json.dumps(manifest, ensure_ascii=False) + ";\n")
    print(f"\nDone. generated={made}  skipped(existing)={skipped}  total in manifest={len(manifest)}")
    print(f"Manifest: {MANIFEST}  (+ manifest.js for file:// playback)")

if __name__ == "__main__":
    main()
