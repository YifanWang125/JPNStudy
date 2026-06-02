/* Voice models for the ⚙ 声音 picker.
 *
 * The app plays an alternate voice by swapping the path prefix of each clip
 * (audio/…  ->  <prefix>…) and falling back to the default file, then TTS.
 * So a voice only needs its files generated under its own folder — no manifest.
 *
 * To ADD a voice:
 *   1. Start an engine (VOICEVOX, or AivisSpeech on :10101 via VOICEVOX_URL).
 *   2. Generate it:   python3 tools/gen_audio.py --voice-dir <name> --speaker <id> [--no-ex]
 *      (find ids with: python3 tools/gen_audio.py --list-speakers)
 *   3. Add an entry below with prefix "audio/voices/<name>/".
 *
 * `core:true` = covers passages + vocab only (generated with --no-ex); example
 * sentences fall back to the standard voice automatically.
 */
window.VOICES = [
  { id:"default",    name:"四国めたん",  tag:"标准 Standard",
    desc:"清晰中性的女声，咬字标准、语速稳——精听与跟读的默认选择。",
    prefix:"audio/" },
  { id:"no7-anno",   name:"No.7（播音）", tag:"清晰 Clear", core:true,
    desc:"播音员／朗读风格，吐字最清楚。想听“最标准的范读”时选它。",
    prefix:"audio/voices/no7-anno/" },
  { id:"metan-sexy", name:"四国めたん（性感）", tag:"性感 Sexy", core:true,
    desc:"和标准音同一角色的低沉性感版，换个心情听听。",
    prefix:"audio/voices/metan-sexy/" },

  // ── 想要更自然的声音？安装 AivisSpeech（与 VOICEVOX 同款 API），生成后取消下面注释：
  // 启动 AivisSpeech 后： VOICEVOX_URL=http://localhost:10101 python3 tools/gen_audio.py --voice-dir aivis --speaker <id> --no-ex
  // { id:"aivis", name:"AivisSpeech", tag:"逼真 Natural", core:true,
  //   desc:"基于 Style-Bert-VITS2，最自然、有感情。需先安装 AivisSpeech 引擎并生成音频。",
  //   prefix:"audio/voices/aivis/" },
];
