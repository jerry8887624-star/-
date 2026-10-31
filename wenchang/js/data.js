// 參拜流程、供品、打氣語、文昌文化等文字內容（集中在這裡，方便日後修改）

export const STEPS = [
  { id: 'prepare', dock: '備供品', label: '到辦事處挑供品，領三炷香和金紙', where: 'counter',
    done: '供品、金紙都備好了，三炷香也點上了。准考證影本和文具先帶在身上。' },
  { id: 'heaven', dock: '拜天公', label: '在天公爐前面朝廟外拜天公、自我介紹，插上一炷香', where: 'censerOut',
    done: '已向天公報上姓名、生日、住址，第一炷香插進天公爐了。' },
  { id: 'wenchang', dock: '拜文昌', label: '入殿把供品擺上供桌，跪在拜墊上向文昌帝君稟告考試與心願', where: 'cushion',
    done: '已向文昌帝君稟告考試與心願，也許下金榜題名後回來還願。' },
  { id: 'plant', dock: '插香', label: '跪在拜墊上，把另外兩炷香插進文昌帝君專屬的文昌爐', where: 'cushion',
    done: '兩炷香插進文昌爐了。' },
  { id: 'pass', dock: '過爐', label: '在拜墊上，准考證影本與文具對著文昌爐順時針繞三圈', where: 'cushion',
    done: '准考證影本與文具過爐完成，收進書包，考試那天帶著。' },
  { id: 'jinzhi', dock: '燒金紙', label: '到金爐依序燒金紙：天金、壽金、刈金', where: 'jinlu',
    done: '金紙燒完了，參拜的心意送到了。' },
  { id: 'card', dock: '祈福卡', label: '寫一張祈福卡，掛上祈福牆', where: 'wall',
    done: '祈福卡掛上牆了。' },
];
// 金紙：常見用法（各廟與各地習慣不同，以廟方指示為準）
export const JINZHI = [
  { id: 'tian', name: '天金', for: '敬天公', color: '#e6c04a' },
  { id: 'shou', name: '壽金', for: '敬文昌帝君', color: '#d9a63a' },
  { id: 'ge', name: '刈金', for: '答謝眾神', color: '#c99a3a' },
];
export const EXTRAS = [
  { id: 'jiaobei', dock: '擲筊', where: 'cushion' },
  { id: 'qian', dock: '求籤', where: 'qianTube' },
];

// 供品：民間取諧音或寓意，各地說法不一
export const OFFERINGS = [
  { id: 'scallion', name: '蔥', mean: '聰明', color: 0x4f9a3a },
  { id: 'celery', name: '芹菜', mean: '勤學', color: 0x7cbf4a },
  { id: 'radish', name: '菜頭', mean: '好彩頭', color: 0xf3efe2 },
  { id: 'bun', name: '包子', mean: '包中', color: 0xf6ead2 },
  { id: 'zongzi', name: '粽子', mean: '包中', color: 0x6c8b3c },
  { id: 'fagao', name: '發糕', mean: '發、高中', color: 0xe7a1a8 },
  { id: 'garlic', name: '蒜頭', mean: '會算', color: 0xefe6d6 },
  { id: 'tea', name: '包種茶', mean: '包中', color: 0x8a6a3a },
];
export const TABOO = [
  { id: 'egg', name: '滷蛋', why: '民間說法「蛋」有「完蛋」之意，拜文昌多半避開。' },
  { id: 'ball', name: '丸子', why: '「丸」與「完」同音，考生多半不拿來拜。' },
  { id: 'redturtle', name: '紅龜粿', why: '有「槓龜」的聯想，拜文昌時通常不選。' },
];

export const EXAMS = ['國中會考', '學測', '分科測驗', '統測', '國家考試', '研究所', '證照檢定', '語言檢定', '期中期末考', '其他'];

// 祈福卡顏色
export const CARD_COLORS = [
  { id: 'red', name: '紅', hex: '#c8352b', ink: '#fff6e4' },
  { id: 'gold', name: '金', hex: '#e2b13c', ink: '#3a2408' },
  { id: 'jade', name: '青', hex: '#2f7d6d', ink: '#f4f1e2' },
  { id: 'ink', name: '墨', hex: '#2a2f4a', ink: '#f0e6c8' },
];

// 香客之間只能傳這些打氣語（不開放自由輸入，避免騷擾與個資外流）
export const CHEERS = ['加油！', '金榜題名！', '一定考上！', '穩穩的', '別緊張', '一起努力', '謝謝你', '你也加油'];

// 密語的快速句子
export const CHAT_PHRASES = ['你好', '你考什麼試？', '一起加油', '祝你金榜題名', '我也好緊張', '謝謝你', '拜拜，加油！'];

// 表情動作：大家都看得到（順序與伺服器的編號一致）
export const EMOTES = [
  { id: 'wave', name: '揮手', icon: '👋' },
  { id: 'bow', name: '拜一拜', icon: '🙏' },
  { id: 'thumb', name: '比讚', icon: '👍' },
  { id: 'jump', name: '開心跳', icon: '🎉' },
];

// 籤等 → 給考生的一句提醒（只依籤等，不是解籤）
export const RANK_TIP = {
  '上上': '籤等很好。照著讀書計畫穩穩走，把會的寫對就好。',
  '上': '籤等不錯。維持節奏，考前把錯題再看一輪。',
  '中': '籤等持平。成績看平時累積，現在補弱點還來得及。',
  '下': '籤等偏保守，是提醒不是定論。調整讀書方法、照顧好作息，比擔心籤更有用。',
};

export const RITUAL_NOTE = '參拜順序與供品依新聞與民俗介紹整理，各廟做法不同，實際參拜請依廟方指示。';

export const FACTS = [
  '文昌帝君又稱梓潼帝君，被視為文昌星的化身，民間相信祂主掌功名祿位，因此考生常來祈求考運。',
  '相傳本名張亞子，居於蜀地七曲山，後人立廟奉祀；到了元代受封為帝君。',
  '聖誕在農曆二月初三。考季前後與聖誕當天，文昌廟常常擠滿考生與家長。',
  '「五文昌」常見說法是文昌帝君、關聖帝君、孚佑帝君（呂洞賓）、魁斗星君、朱衣星君，各地配祀略有不同。',
  '供品多取諧音：蔥＝聰明、芹菜＝勤學、菜頭＝好彩頭、包子粽子＝包中。准考證影本常一起放上供桌，拜完過爐。',
  '燒金紙是把心意「送」給神明：一般拜天公用天金、拜神明用壽金，刈金多用於答謝眾神。各廟用的金紙不同，有些廟為了環保已不收金紙，請依廟方指示。',
];
export const SOURCES = [
  ['NOWnews：拜文昌帝君流程與供品', 'https://www.nownews.com/news/6774035'],
  ['TVBS：考生拜文昌注意事項', 'https://news.tvbs.com.tw/life/2371078'],
  ['今周刊：文昌帝君怎麼拜、說詞、供品', 'https://www.businesstoday.com.tw/article/category/183035/post/202605040028/'],
  ['東海大學圖書館館刊第19期（五文昌）', 'https://dcollection.lib.thu.edu.tw/wp-content/uploads/2024/12/第19期館刊32-37.pdf'],
];

// 每日小任務：「抽今日一籤」每天都有，其他從任務池依日期輪替抽 3 項（同一天大家的任務一樣）
export const TASK_POOL = [
  { id: 'lot', name: '抽今日一籤', go: 'lot', fixed: true },
  { id: 'bow', name: '在拜墊上叩拜一次', go: 'cushion' },
  { id: 'bless', name: '幫 3 張祈福卡加持', need: 3, go: 'wall' },
  { id: 'cheer', name: '跟其他考生打氣或做個動作', go: 'social' },
  { id: 'study', name: '在讀書角專注一輪', go: 'study' },
  { id: 'lamp', name: '點一盞光明燈', go: 'lamp' },
  { id: 'wish', name: '在許願池投一枚許願幣', go: 'pool' },
  { id: 'photo', name: '拍一張合照打卡', go: 'photo' },
  { id: 'jiaobei', name: '擲筊請示一次', go: 'jiaobei' },
];
export const DAILY_COUNT = 4;
export const WEEK_GOAL = 5; // 一週完成幾天算「本週全勤」

// 稱號（顯示在名牌前面，大家都看得到）；tier 決定名牌外框：1 銀、2 紅金、3 金
export const TITLES = [
  { name: '不顯示', tier: 0 }, { name: '初入文昌', tier: 1 }, { name: '勤學生', tier: 1 }, { name: '七日精進', tier: 2 }, { name: '文曲星', tier: 3 },
  { name: '狀元', tier: 3 }, { name: '熱心加持', tier: 1 }, { name: '金榜題名', tier: 3 }, { name: '聖誕祈福', tier: 2 }, { name: '讀書郎', tier: 1 },
  { name: '本週全勤', tier: 2 }, { name: '點燈人', tier: 1 },
];
// 特效
export const FXS = ['不使用', '金色光暈', '金色腳印', '文昌星'];

// 獎勵與解鎖條件：days 累積天數、streak 最長連續天數、bless 送出加持、bang 還願、fest 聖誕期間完成、study 專注輪數、week 全勤週數、lamp 點燈次數
export const REWARDS = [
  { kind: 'title', v: 1, need: { days: 1 }, how: '完成 1 天每日任務' },
  { kind: 'acc', v: 1, need: { days: 1 }, how: '完成 1 天每日任務' },
  { kind: 'title', v: 2, need: { days: 3 }, how: '累積 3 天' },
  { kind: 'acc', v: 2, need: { days: 3 }, how: '累積 3 天' },
  { kind: 'outfit', v: 8, need: { days: 3 }, how: '累積 3 天' },
  { kind: 'fx', v: 2, need: { days: 5 }, how: '累積 5 天' },
  { kind: 'title', v: 3, need: { streak: 7 }, how: '連續 7 天' },
  { kind: 'fx', v: 1, need: { streak: 7 }, how: '連續 7 天' },
  { kind: 'title', v: 4, need: { days: 14 }, how: '累積 14 天（名牌金框）' },
  { kind: 'fx', v: 3, need: { days: 14 }, how: '累積 14 天' },
  { kind: 'title', v: 5, need: { days: 30 }, how: '累積 30 天' },
  { kind: 'outfit', v: 9, need: { days: 30 }, how: '累積 30 天' },
  { kind: 'title', v: 10, need: { week: 1 }, how: `一週內完成 ${5} 天` },
  { kind: 'title', v: 6, need: { bless: 50 }, how: '幫別人加持 50 次' },
  { kind: 'title', v: 9, need: { study: 10 }, how: '在讀書角專注 10 輪' },
  { kind: 'title', v: 11, need: { lamp: 3 }, how: '點 3 次光明燈' },
  { kind: 'title', v: 7, need: { bang: 1 }, how: '考上後回來還願' },
  { kind: 'acc', v: 3, need: { fest: 1 }, how: '文昌帝君聖誕期間完成每日任務（限定）', fest: true },
  { kind: 'title', v: 8, need: { fest: 1 }, how: '文昌帝君聖誕期間完成每日任務（限定）', fest: true },
];
export const FOCUS_MIN = [15, 25, 50]; // 讀書角專注時間（分鐘）

// 文昌帝君聖誕：農曆二月初三換算成國曆（用 lunar-javascript 預先算好，免得遊戲多載一個大檔案）
export const FEAST_DATES = ['2026-03-21', '2027-03-10', '2028-02-27', '2029-03-17', '2030-03-06', '2031-02-23', '2032-03-14', '2033-03-03', '2034-03-22', '2035-03-12',
  '2036-02-29', '2037-03-19', '2038-03-08', '2039-02-25', '2040-03-15', '2041-03-04', '2042-02-22', '2043-03-13', '2044-03-02', '2045-03-21'];
export const FEAST_DAYS_BEFORE = 2; // 聖誕前兩天到當天算活動期間
// 專注時的聲音：靈犀配樂，或輕柔的環境聲（audio/focus/，取自開源專案 Moodist，CC0／Pixabay 授權，來源見 README）
export const FOCUS_SOUNDS = [
  { k: 'none', zh: '安靜', group: '' },
  { k: 'ritual', zh: '儀式靜心', src: 'audio/ritual-pause.mp3', group: '靈犀配樂' },
  { k: 'still', zh: '缽音入定', src: 'audio/resonant-stillness.mp3', group: '靈犀配樂' },
  { k: 'dawn', zh: '晨鐘回響', src: 'audio/resonant-dawn.mp3', group: '靈犀配樂' },
  { k: 'night', zh: '靜夜安神', src: 'audio/nocturnal-calm.mp3', group: '靈犀配樂' },
  { k: 'rain', zh: '細雨', src: 'audio/focus/rain.mp3', group: '環境聲' },
  { k: 'window', zh: '雨打窗', src: 'audio/focus/window.mp3', group: '環境聲' },
  { k: 'library', zh: '圖書館', src: 'audio/focus/library.mp3', group: '環境聲', vol: 0.45 },
  { k: 'paper', zh: '翻紙聲', src: 'audio/focus/paper.mp3', group: '環境聲' },
  { k: 'temple', zh: '寺院', src: 'audio/focus/temple.mp3', group: '環境聲' },
  { k: 'river', zh: '溪流', src: 'audio/focus/river.mp3', group: '環境聲' },
  { k: 'crickets', zh: '夏夜蟲鳴', src: 'audio/focus/crickets.mp3', group: '環境聲' },
  { k: 'clock', zh: '時鐘滴答', src: 'audio/focus/clock.mp3', group: '環境聲' },
];
export const FOCUS_CHEERS = ['一次只做一件事', '慢慢來，比較快', '今天的努力，考場上看得見', '寫錯沒關係，弄懂就好', '文昌帝君陪你讀書', '專注的你最帥／最美'];
