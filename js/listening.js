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
    "explainEn":"He had pasta yesterday and wants Japanese food today; they agree on the sushi place by the station." },

  { "id":"l7", "type":"課題理解",
    "lines":[
      {"sp":"f", "jp":"レポートですが、来週[らいしゅう]の月曜[げつよう]までに出[だ]せばいいですか。"},
      {"sp":"m", "jp":"いえ、今週[こんしゅう]の金曜[きんよう]までです。それから、メールではなく、紙[かみ]で出[だ]してください。"},
      {"sp":"f", "jp":"分[わ]かりました。表紙[ひょうし]は必要[ひつよう]ですか。"},
      {"sp":"m", "jp":"表紙[ひょうし]はいりません。本文[ほんぶん]だけで大丈夫[だいじょうぶ]です。"}
    ],
    "q":"学生[がくせい]はレポートをどのように出[だ]しますか。",
    "options":["メールで送[おく]る","紙[かみ]で金曜[きんよう]までに出[だ]す","表紙[ひょうし]をつけて出[だ]す","月曜[げつよう]までに出[だ]す"],
    "answer":1, "zh":"学生要怎么交报告？", "qEn":"How should the student submit the report?",
    "explain":"老师说不是邮件、要用纸交，截止本周五，且不需要封面。",
    "explainEn":"The teacher says: not by email but on paper, by this Friday, and no cover page is needed." },

  { "id":"l8", "type":"ポイント理解",
    "lines":[
      {"sp":"f", "jp":"最近[さいきん]、ジムで見[み]かけないけど、やめちゃったの？"},
      {"sp":"m", "jp":"うん、続[つづ]けたかったんだけど、会費[かいひ]がちょっと高[たか]くてね。今[いま]は家[いえ]の近[ちか]くを走[はし]ってるよ。"}
    ],
    "q":"男[おとこ]の人[ひと]はどうしてジムをやめましたか。",
    "options":["時間[じかん]がないから","会費[かいひ]が高[たか]いから","家[いえ]から遠[とお]いから","けがをしたから"],
    "answer":1, "zh":"男的为什么不去健身房了？", "qEn":"Why did the man quit the gym?",
    "explain":"他说想继续，但会费有点贵；现在改在家附近跑步。",
    "explainEn":"He says he wanted to keep going, but the membership fee was a bit high; now he runs near home instead." },

  { "id":"l9", "type":"概要理解",
    "lines":[
      {"sp":"m", "jp":"お客様[きゃくさま]にお知[し]らせいたします。ただいま、強[つよ]い風[かぜ]の影響[えいきょう]で、電車[でんしゃ]が約[やく]十分[じゅっぷん]遅[おく]れて運転[うんてん]しております。お急[いそ]ぎのところ、ご迷惑[めいわく]をおかけして申[もう]し訳[わけ]ございません。"}
    ],
    "q":"このアナウンスは主[おも]に何[なに]を伝[つた]えていますか。",
    "options":["電車[でんしゃ]が遅[おく]れていること","電車[でんしゃ]が止[と]まったこと","天気[てんき]が良[よ]くなること","切符[きっぷ]の買[か]い方[かた]"],
    "answer":0, "zh":"这则广播主要在传达什么？", "qEn":"What is this announcement mainly conveying?",
    "explain":"因强风影响，电车晚点约十分钟运行——主旨是「电车延误」。",
    "explainEn":"Because of strong winds, trains are running about ten minutes late — the main point is that the trains are delayed." },

  { "id":"l10", "type":"即時応答",
    "lines":[ {"sp":"m", "jp":"あのう、この席[せき]、空[あ]いていますか。"} ],
    "q":"適切[てきせつ]な応答[おうとう]はどれですか。",
    "options":["ええ、どうぞ。","いいえ、空[あ]きました。","はい、座[すわ]りました。","では、失礼[しつれい]しました。"],
    "answer":0, "zh":"（问座位空不空）最合适的回应是？", "qEn":"(\"Is this seat free?\") Which reply fits best?",
    "explain":"被问「这个座位空着吗」，请对方坐下回「ええ、どうぞ」最自然。",
    "explainEn":"Asked whether the seat is free, 「ええ、どうぞ」 (\"Yes, go ahead\") is the natural reply." },

  { "id":"l11", "type":"即時応答",
    "lines":[ {"sp":"f", "jp":"課長[かちょう]、今[いま]、お時間[じかん]よろしいでしょうか。"} ],
    "q":"適切[てきせつ]な応答[おうとう]はどれですか。",
    "options":["はい、何[なん]でしょうか。","いいえ、よろしくないです。","では、いただきます。","お時間[じかん]どうぞ。"],
    "answer":0, "zh":"（问课长现在是否方便）最合适的回应是？", "qEn":"(Asking the section chief if he has a moment) Which reply fits best?",
    "explain":"下属问「现在方便吗」，上司回「はい、何でしょうか」最自然。",
    "explainEn":"When a subordinate asks if you have a moment, 「はい、何でしょうか」 (\"Yes, what is it?\") is the natural reply." },

  { "id":"l12", "type":"即時応答",
    "lines":[ {"sp":"m", "jp":"せっかくだから、もう少[すこ]しいてくださいよ。"} ],
    "q":"適切[てきせつ]な応答[おうとう]はどれですか。",
    "options":["それじゃ、あと三十分[さんじゅっぷん]だけ。","はい、もう帰[かえ]りました。","いいえ、来[き]ませんでした。","では、いただきます。"],
    "answer":0, "zh":"（挽留：「难得，再多待会儿吧」）最合适的回应是？", "qEn":"(\"Since you're here, do stay a little longer\") Which reply fits best?",
    "explain":"对方挽留「再多待一会儿」，答应再留一会回「それじゃ、あと三十分だけ」最贴切。",
    "explainEn":"When someone urges you to stay longer, agreeing with 「それじゃ、あと三十分だけ」 (\"OK, just 30 more minutes then\") fits best." },

  { "id":"l13", "type":"統合理解",
    "lines":[
      {"sp":"f", "jp":"田中[たなか]さんの送別会[そうべつかい]、プレゼント、何[なに]がいいかな。"},
      {"sp":"m", "jp":"そうだね。前[まえ]に手帳[てちょう]がほしいって言[い]ってたよ。"},
      {"sp":"f", "jp":"いいね。でも、もう自分[じぶん]で買[か]っちゃったかもしれない。お花[はな]はどう？"},
      {"sp":"m", "jp":"お花[はな]は持[も]って帰[かえ]るのが大変[たいへん]だよ。やっぱり、言[い]ってたものにしよう。"}
    ],
    "q":"二人[ふたり]は何[なに]をプレゼントすることにしましたか。",
    "options":["手帳[てちょう]","お花[はな]","本[ほん]","お菓子[かし]"],
    "answer":0, "zh":"两人决定送什么礼物？", "qEn":"What did the two decide to give as a gift?",
    "explain":"田中说过想要记事本；鲜花不好带回去——最后决定送他说过想要的「记事本」。",
    "explainEn":"Tanaka had said he wanted a planner; flowers are hard to carry home — so they settle on the planner he'd mentioned." },

  { "id":"l14", "type":"課題理解",
    "lines":[
      {"sp":"f", "jp":"引[ひ]っ越[こ]しの手続[てつづ]き、何[なに]からすればいい？"},
      {"sp":"m", "jp":"まず、市役所[しやくしょ]で住所[じゅうしょ]の変更[へんこう]をして。それが終[お]わってから、電気[でんき]とガスに連絡[れんらく]するといいよ。"},
      {"sp":"f", "jp":"銀行[ぎんこう]は？"},
      {"sp":"m", "jp":"銀行[ぎんこう]は一番[いちばん]最後[さいご]でいいよ。"}
    ],
    "q":"女[おんな]の人[ひと]は最初[さいしょ]に何[なに]をしますか。",
    "options":["市役所[しやくしょ]で住所[じゅうしょ]を変更[へんこう]する","電気[でんき]とガスに連絡[れんらく]する","銀行[ぎんこう]に行[い]く","引[ひ]っ越[こ]しの会社[かいしゃ]を探[さが]す"],
    "answer":0, "zh":"女的最先做什么？", "qEn":"What will the woman do first?",
    "explain":"男方说先去市役所变更住址，再联系水电气，银行放最后——最先是「去市役所改住址」。",
    "explainEn":"He says to first change her address at city hall, then contact the utilities, with the bank last — so first is the city-hall address change." }
];
