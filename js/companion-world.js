/* ============================================================================
 *  言の葉の国 — companion-world layer  (ADDITIVE; never replaces lessons.js)
 *
 *  A light lore / visual frame so the 🎴 看图说话 (picture-talk) drill and the
 *  companion can connect to the VALIDATED daily passages — without overshadowing
 *  them (不喧宾夺主). The original passage stays the primary content & model; this
 *  layer just gives みけ a world (言の葉の国) and the picture-talk its framing.
 *  Grows day by day. Real illustrations replace the emoji `scene` placeholders later.
 * ==========================================================================*/
window.COMPANION_WORLD = {
  world: { name:"言[こと]の葉[は]の国[くに]", nameZh:"言之叶之国", pet:"みけ" },
  byDay: {
    1: {
      // task = produce TODAY'S real content (self-intro), prompted only by the picture
      task:{ zh:"看着这幅画，用日语做一个自我介绍——像今天课文那样：你是谁、从哪来、每天做什么、以后想做什么。",
             en:"From this picture, introduce yourself in Japanese — like today's passage: who you are, where you're from, your daily routine, what you want to do." },
      scene:["🐱","🌅","🚃","🏫"],   // placeholder visual hint until real art exists
      // みけ's parallel intro — LORE ONLY (mirrors Day-1 grammar), shown as みけ's "example", not study material
      mikeIntro:"はじめまして。ぼくはみけ。言[こと]の葉[は]の国[くに]から来[き]ました。今[いま]、人間[にんげん]の言葉[ことば]を勉強[べんきょう]しています。毎日[まいにち]少[すこ]しずつ練習[れんしゅう]して、いつか君[きみ]と自由[じゆう]に話[はな]したいんだ。",
      cheers:["わー、いいね！もっと聞[き]きたいな。","すごい！ぼく、どきどきしたよ。","えへへ、君[きみ]の声[こえ]、好[す]き。","その調子[ちょうし]！いっしょに頑張[がんば]ろう。"]
    }
  }
};
