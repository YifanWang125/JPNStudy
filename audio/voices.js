/* Voice models for the ⚙ 声音 picker.
 *
 * The app plays an alternate voice by swapping the path prefix of each clip
 * (audio/…  ->  <prefix>…) and falling back to the default file, then TTS.
 * So a voice only needs its files generated under its own folder — no manifest.
 *
 * Each entry: { id, char(角色), style(风格), tag, desc, prefix, [core] }
 *   - the picker GROUPS options by `char`, so a character can have a 普通版 + 有意思版.
 *   - `core:true` just means it was generated with --no-ex (covers 课文+单词; the ~600
 *     example sentences fall back to the standard voice). Not shown in the UI.
 *
 * To ADD a voice:
 *   1. ids:  python3 tools/gen_audio.py --list-speakers
 *   2. gen:  python3 tools/gen_audio.py --voice-dir <name> --speaker <id> --no-ex
 *   3. add an entry below with prefix "audio/voices/<name>/".
 *
 * Kansai-ben (关西腔): standard VOICEVOX has no Kansai voice; AivisSpeech / extra
 * character packs may. Left out for now.
 */
window.VOICES = [
  // —— 四国めたん ——
  { id:"default",     char:"四国めたん", style:"标准",   tag:"标准",   prefix:"audio/",
    desc:"清晰中性的女声，咬字标准、语速稳——精听与跟读的默认选择。" },
  { id:"metan-sexy",  char:"四国めたん", style:"性感",   tag:"性感",   prefix:"audio/voices/metan-sexy/", core:true,
    desc:"同一角色的低沉性感版，换个心情听听。" },
  // —— ずんだもん（吉祥物，活泼）——
  { id:"zunda-normal",char:"ずんだもん", style:"普通",   tag:"萌系",   prefix:"audio/voices/zunda-normal/", core:true,
    desc:"东北萌系吉祥物的普通版，声音清亮可爱。" },
  { id:"zunda-tsun",  char:"ずんだもん", style:"傲娇",   tag:"傲娇",   prefix:"audio/voices/zunda-tsun/", core:true,
    desc:"傲娇（ツンツン）版，有点小脾气的小太妹感，趣味十足。" },
  // —— 波音リツ ——
  { id:"ritsu-normal",char:"波音リツ",   style:"普通",   tag:"沉静",   prefix:"audio/voices/ritsu-normal/", core:true,
    desc:"成熟沉静的女声普通版。" },
  { id:"ritsu-queen", char:"波音リツ",   style:"女王",   tag:"女王",   prefix:"audio/voices/ritsu-queen/", core:true,
    desc:"高冷女王（クイーン）版，气场全开。" },
  // —— No.7（播音）——
  { id:"no7-anno",    char:"No.7",       style:"清晰朗读", tag:"清晰", prefix:"audio/voices/no7-anno/", core:true,
    desc:"播音员／朗读风格，吐字最清楚。想听“最标准的范读”时选它。" },

  // 想要更自然的声音？装 AivisSpeech（同款 API，端口 10101），生成后取消注释：
  // { id:"aivis", char:"AivisSpeech", style:"逼真", tag:"逼真", prefix:"audio/voices/aivis/", core:true,
  //   desc:"基于 Style-Bert-VITS2，最自然、有感情。需先安装 AivisSpeech 引擎并生成。" },
];
