/* ============================================================================
 *  聴解 Listening practice items (window.LISTENING).
 *  Each item: { id, type, lines:[{sp:"f"|"m", jp}], q, options[4], answer, zh, explain }
 *  Audio: per line → key `listen_<id>_<i>` (gen_audio.py, per-speaker VOICEVOX voice);
 *  the UI plays the lines in sequence (speakSequence), then you answer & see the script.
 *  furigana: 漢字[かな]. Types mirror the real N2 listening 問題1–5.
 *  NOTE: keys are JSON-quoted so tools/gen_audio.py (json.loads) can read this file.
 *  For the REAL exam's audio, use the Official Samples (jlpt.jp) — this is in-app practice.
 * ==========================================================================*/
window.LISTENING = [
  { "id":"l1", "type":"課題理解",
    "lines":[
      {"sp":"f", "jp":"明日[あした]の会議[かいぎ]の準備[じゅんび]ですが、資料[しりょう]はもうできていますか。"},
      {"sp":"m", "jp":"はい、資料[しりょう]はもう印刷[いんさつ]しました。あとは会議室[かいぎしつ]の予約[よやく]だけです。"},
      {"sp":"f", "jp":"会議室[かいぎしつ]の予約[よやく]は私[わたし]がやっておきます。じゃ、お願[ねが]いしたいのは、参加者[さんかしゃ]へのメールですね。"},
      {"sp":"m", "jp":"分[わ]かりました。すぐ送[おく]ります。"}
    ],
    "q":"男[おとこ]の人[ひと]はこれから何[なに]をしますか。",
    "options":["資料[しりょう]を印刷[いんさつ]する","会議室[かいぎしつ]を予約[よやく]する","参加者[さんかしゃ]にメールを送[おく]る","会議[かいぎ]に出席[しゅっせき]する"],
    "answer":2, "zh":"男的人接下来要做什么？", "qEn":"What will the man do next?",
    "explain":"资料已印好、会议室由女方预约——男方要做的是给参加者发邮件。",
    "explainEn":"The materials are already printed and the woman will book the meeting room, so the man's remaining task is to email the participants." },

  { "id":"l2", "type":"ポイント理解",
    "lines":[
      {"sp":"m", "jp":"遅[おそ]かったね。電車[でんしゃ]が遅[おく]れたの？"},
      {"sp":"f", "jp":"ううん、電車[でんしゃ]は大丈夫[だいじょうぶ]だったんだけど、出[で]かける前[まえ]に家[いえ]の鍵[かぎ]が見[み]つからなくて、ずっと探[さが]していたの。"}
    ],
    "q":"女[おんな]の人[ひと]はどうして遅[おく]れましたか。",
    "options":["電車[でんしゃ]が遅[おく]れたから","鍵[かぎ]が見[み]つからなかったから","寝坊[ねぼう]をしたから","道[みち]が混[こ]んでいたから"],
    "answer":1, "zh":"女的为什么迟到了？", "qEn":"Why was the woman late?",
    "explain":"她说电车没问题，是出门前找不到家里的钥匙、一直在找。",
    "explainEn":"She says the train was fine — before leaving she couldn't find her house key and kept searching for it." },

  { "id":"l3", "type":"概要理解",
    "lines":[
      {"sp":"m", "jp":"本日[ほんじつ]はご来店[らいてん]いただき、誠[まこと]にありがとうございます。ただいま当店[とうてん]では、二階[にかい]の催事場[さいじじょう]にて北海道[ほっかいどう]物産展[ぶっさんてん]を開催[かいさい]しております。新鮮[しんせん]な海産物[かいさんぶつ]やお菓子[かし]を多数[たすう]取[と]りそろえております。皆様[みなさま]のお越[こ]しを心[こころ]よりお待[ま]ちしております。"}
    ],
    "q":"このアナウンスは、主[おも]に何[なに]について話[はな]していますか。",
    "options":["閉店[へいてん]の時間[じかん]","二階[にかい]で行[おこな]われているイベント","駐車場[ちゅうしゃじょう]の場所[ばしょ]","商品[しょうひん]の値段[ねだん]"],
    "answer":1, "zh":"这则广播主要在说什么？", "qEn":"What is this announcement mainly about?",
    "explain":"广播在介绍二楼正在举办的北海道物产展（一个活动/イベント）。",
    "explainEn":"The announcement is introducing the Hokkaido products fair — an event being held on the second floor." },

  { "id":"l4", "type":"即時応答",
    "lines":[ {"sp":"f", "jp":"お先[さき]に失礼[しつれい]します。"} ],
    "q":"適切[てきせつ]な応答[おうとう]はどれですか。",
    "options":["お疲[つか]れさまでした。","いただきます。","おかげさまで。","どういたしまして。"],
    "answer":0, "zh":"（同事下班先走）最合适的回应是？", "qEn":"(A colleague is leaving work ahead of you) Which reply fits best?",
    "explain":"对方下班先走，回「お疲れさまでした」最自然。",
    "explainEn":"When someone leaves work ahead of you, replying 「お疲れさまでした」 is the most natural." },

  { "id":"l5", "type":"即時応答",
    "lines":[ {"sp":"m", "jp":"悪[わる]いけど、これ、コピーしておいてくれる？"} ],
    "q":"適切[てきせつ]な応答[おうとう]はどれですか。",
    "options":["はい、すぐにやります。","はい、コピーしました。","いいえ、まだ来[き]ていません。","では、お先[さき]に。"],
    "answer":0, "zh":"（被拜托去复印）最合适的回应是？", "qEn":"(You're asked to make some copies) Which reply fits best?",
    "explain":"被请求「帮我复印」，还没做，回「はい、すぐにやります」最贴切。",
    "explainEn":"Asked to make copies and not having done it yet, 「はい、すぐにやります」 (\"Yes, I'll do it right away\") fits best." },

  { "id":"l6", "type":"ポイント理解",
    "lines":[
      {"sp":"f", "jp":"今夜[こんや]、どこで食[た]べる？イタリアンはどう？"},
      {"sp":"m", "jp":"うーん、昨日[きのう]パスタを食[た]べたから、今日[きょう]は和食[わしょく]がいいな。"},
      {"sp":"f", "jp":"じゃあ、駅前[えきまえ]のお寿司屋[すしや]さんはどう？"},
      {"sp":"m", "jp":"いいね。そうしよう。"}
    ],
    "q":"二人[ふたり]は今夜[こんや]、何[なに]を食[た]べることにしましたか。",
    "options":["イタリア料理[りょうり]","パスタ","お寿司[すし]","中華料理[ちゅうかりょうり]"],
    "answer":2, "zh":"两人今晚决定吃什么？", "qEn":"What did the two decide to eat tonight?",
    "explain":"男方昨天吃了意面、今天想吃和食；最后同意去车站前的寿司店。",
    "explainEn":"He had pasta yesterday and wants Japanese food today; they agree on the sushi place by the station." }
];
