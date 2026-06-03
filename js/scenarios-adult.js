/* 🔞 Adult-mode scenario dialogue — playful, suggestive innuendo between consenting
   adults. Tasteful and comedic (double-entendre, flirtation), NOT explicit. Gated
   behind an opt-in toggle (off by default). Keyed by scenario id; each line mirrors
   the normal dialogue shape: jp (furigana 漢字[かな]), zh, en, sp:"c"|"s".
   Audio: scna_<id>_<i> via tools/gen_audio.py, with sultry VOICEVOX voices. */
window.SCENARIOS_ADULT = {
  "hospital": [
    {"sp":"s","jp":"看護師[かんごし]：あら、緊張[きんちょう]してるんですか？ もっと…リラックスして。","zh":"护士：哎呀，你紧张了吗？再…放松一点嘛。","en":"Nurse: Oh my, are you nervous? Relax a little more… for me."},
    {"sp":"c","jp":"患者[かんじゃ]：は、はい…。","zh":"患者：是、是的…。","en":"Patient: Y-yes…"},
    {"sp":"s","jp":"看護師[かんごし]：どこか具合[ぐあい]が悪[わる]いんですか？ ここ…ですか？ それとも、もっと下[した]のほう…？","zh":"护士：你哪里不舒服呀？是…这里吗？还是，再…下面一点…？","en":"Nurse: Where doesn't it feel good? Right… here? Or… a little lower down…?"},
    {"sp":"c","jp":"患者[かんじゃ]：せ、先生[せんせい]、それは…ちょっと…。","zh":"患者：医、医生，那个…有点…。","en":"Patient: D-doctor, that's… a bit…"},
    {"sp":"s","jp":"看護師[かんごし]：ふふっ、冗談[じょうだん]ですよ。…半分[はんぶん]はね。","zh":"护士：呵呵，开玩笑的啦。…一半是真的哦。","en":"Nurse: Hehe, I'm only teasing. …Half of it, anyway."},
    {"sp":"c","jp":"患者[かんじゃ]：心臓[しんぞう]に悪[わる]いです…。","zh":"患者：这对心脏不好啊…。","en":"Patient: This is bad for my heart…"},
    {"sp":"s","jp":"看護師[かんごし]：じゃあ、特別[とくべつ]に…ゆっくり、診[み]てあげます。","zh":"护士：那我就特别地…慢慢地，给你看哦。","en":"Nurse: Then, just for you… I'll examine you nice and slowly."}
  ],
  "shopping": [
    {"sp":"s","jp":"店員[てんいん]：いらっしゃいませ…お客[きゃく]さん、いい体[からだ]してますね。","zh":"店员：欢迎光临…客人，你身材真好呢。","en":"Clerk: Welcome… my, you've got a nice build, sir."},
    {"sp":"c","jp":"客[きゃく]：えっ、急[きゅう]に…。","zh":"客人：诶，怎么突然…。","en":"Customer: Huh, so suddenly…?"},
    {"sp":"s","jp":"店員[てんいん]：このシャツ、絶対[ぜったい]似合[にあ]いますよ。試着[しちゃく]、手伝[てつだ]いましょうか？","zh":"店员：这件衬衫绝对适合你。试穿…要我帮你吗？","en":"Clerk: This shirt would look great on you. Shall I… help you try it on?"},
    {"sp":"c","jp":"客[きゃく]：じ、自分[じぶん]でできます…。","zh":"客人：我、我自己来就行…。","en":"Customer: I-I can manage by myself…"},
    {"sp":"s","jp":"店員[てんいん]：つれないなあ。…じゃあ、ポイントカードだけでも、作[つく]っていきません？","zh":"店员：真冷淡呢。…那，至少办张积分卡再走嘛？","en":"Clerk: So cold~ Then at least let me sign you up for a point card before you go?"},
    {"sp":"c","jp":"客[きゃく]：それは…作[つく]ります。","zh":"客人：那个…我办。","en":"Customer: That… I'll do."},
    {"sp":"s","jp":"店員[てんいん]：ふふ、また会[あ]いに来[き]てくださいね。","zh":"店员：呵呵，要再来见我哦。","en":"Clerk: Hehe, come back to see me again, won't you?"}
  ],
  "dining": [
    {"sp":"s","jp":"店員[てんいん]：お一人[ひとり]ですか？ さびしい夜[よる]ですね…私[わたし]が隣[となり]、座[すわ]りましょうか？","zh":"店员：一个人吗？真是寂寞的夜晚呢…要我坐你旁边吗？","en":"Server: All alone? What a lonely night… shall I sit beside you?"},
    {"sp":"c","jp":"客[きゃく]：い、いいんですか？","zh":"客人：可、可以吗？","en":"Customer: I-is that okay?"},
    {"sp":"s","jp":"店員[てんいん]：とりあえず…熱[あつ]いの、飲[の]みます？ 体[からだ]、温[あたた]めてあげる。","zh":"店员：先…来杯热的？我帮你把身子暖起来。","en":"Server: First… something hot to drink? Let me warm you up."},
    {"sp":"c","jp":"客[きゃく]：の、飲[の]みます…。","zh":"客人：我、我喝…。","en":"Customer: I-I'll have one…"},
    {"sp":"s","jp":"店員[てんいん]：お通[とお]しは…私[わたし]の手作[てづく]り。特別[とくべつ]サービスですよ。","zh":"店员：餐前小菜是…我亲手做的。特别服务哦。","en":"Server: The appetizer is… homemade by me. A special service, just for you."},
    {"sp":"c","jp":"客[きゃく]：ドキドキしてきた…。","zh":"客人：心跳开始加速了…。","en":"Customer: My heart's starting to race…"},
    {"sp":"s","jp":"店員[てんいん]：今夜[こんや]は、ゆっくりしていってね。","zh":"店员：今晚，就慢慢待着别走嘛。","en":"Server: Tonight, take your time and stay a while~"}
  ],
  "gym": [
    {"sp":"s","jp":"トレーナー：フォーム、乱[みだ]れてますよ。…ほら、私[わたし]が後[うし]ろから、支[ささ]えてあげます。","zh":"教练：你姿势乱了哦。…来，我从后面扶着你。","en":"Trainer: Your form's gone sloppy. …Here, let me support you from behind."},
    {"sp":"c","jp":"客[きゃく]：ち、近[ちか]いです…。","zh":"客人：好、好近…。","en":"Customer: Y-you're so close…"},
    {"sp":"s","jp":"トレーナー：もっと、力[ちから]を入[い]れて。…そう、上手[じょうず]ですよ。","zh":"教练：再用点力。…对，很棒哦。","en":"Trainer: Put more into it. …Yes, that's good."},
    {"sp":"c","jp":"客[きゃく]：もう、限界[げんかい]かも…。","zh":"客人：我，可能到极限了…。","en":"Customer: I think I'm… at my limit…"},
    {"sp":"s","jp":"トレーナー：まだまだ。汗[あせ]、すごいですね…拭[ふ]いてあげましょうか？","zh":"教练：还早呢。汗好多啊…要我帮你擦吗？","en":"Trainer: Not yet. You're dripping with sweat… shall I wipe it off for you?"},
    {"sp":"c","jp":"客[きゃく]：じ、自分[じぶん]で…！","zh":"客人：我、我自己来…！","en":"Customer: I-I'll do it myself…!"},
    {"sp":"s","jp":"トレーナー：ふふ、明日[あした]は筋肉痛[きんにくつう]ですね。また、私[わたし]としましょう。","zh":"教练：呵呵，明天会肌肉酸痛吧。下次，再跟我一起做哦。","en":"Trainer: Hehe, you'll be sore tomorrow. Let's do it together again, just you and me."}
  ],
  "hotel": [
    {"sp":"s","jp":"フロント：お部屋[へや]、一[ひと]つしか空[あ]いてないんです…ダブル、ですけど。","zh":"前台：房间只剩一间了…是大床房哦。","en":"Front desk: We've only one room left… a double, though."},
    {"sp":"c","jp":"客[きゃく]：え、ダブル…。","zh":"客人：诶，大床房…。","en":"Guest: Uh, a double…"},
    {"sp":"s","jp":"フロント：お部屋[へや]まで、ご案内[あんない]しましょうか？ …個人的[こじんてき]に。","zh":"前台：要我带你到房间吗？…私下里地。","en":"Front desk: Shall I show you to the room myself? …Personally."},
    {"sp":"c","jp":"客[きゃく]：お、お願[ねが]いします…。","zh":"客人：麻、麻烦你了…。","en":"Guest: P-please do…"},
    {"sp":"s","jp":"フロント：何[なに]か、足[た]りないものがあれば…いつでも、呼[よ]んでくださいね。","zh":"前台：要是少了什么…随时叫我哦。","en":"Front desk: If there's anything you're missing… call for me anytime."},
    {"sp":"c","jp":"客[きゃく]：…フロントの内線[ないせん]、ですよね？","zh":"客人：…是前台的内线电话吧？","en":"Guest: …You mean the front-desk extension, right?"},
    {"sp":"s","jp":"フロント：ふふ、どう思[おも]います？","zh":"前台：呵呵，你觉得呢？","en":"Front desk: Hehe… what do you think?"}
  ],
  "nightlife": [
    {"sp":"s","jp":"キャスト：初[はじ]めまして…今夜[こんや]は、私[わたし]が相手[あいて]してあげる。","zh":"陪侍：初次见面…今晚，由我来陪你哦。","en":"Hostess: Nice to meet you… tonight, I'll be the one keeping you company."},
    {"sp":"c","jp":"客[きゃく]：よ、よろしく…。","zh":"客人：请、请多关照…。","en":"Customer: N-nice to meet you…"},
    {"sp":"s","jp":"キャスト：そんなに緊張[きんちょう]しないで。…ほら、もっとこっち、来[き]て。","zh":"陪侍：别那么紧张嘛。…来，再过来一点。","en":"Hostess: Don't be so tense. …Come on, come a little closer."},
    {"sp":"c","jp":"客[きゃく]：は、はい。","zh":"客人：是、是的。","en":"Customer: O-okay."},
    {"sp":"s","jp":"キャスト：指名[しめい]、してくれる？ …私[わたし]を、独[ひと]り占[じ]めできるよ。","zh":"陪侍：会指名我吗？…你可以把我一个人独占哦。","en":"Hostess: Will you request me? …You could have me all to yourself."},
    {"sp":"c","jp":"客[きゃく]：し、指名[しめい]します！","zh":"客人：我、我指名！","en":"Customer: I-I'll request you!"},
    {"sp":"s","jp":"キャスト：うれしい。…今夜[こんや]は、帰[かえ]さないから。","zh":"陪侍：好开心。…今晚，可不放你回去哦。","en":"Hostess: I'm so happy. …I won't be letting you leave tonight."}
  ]
};
