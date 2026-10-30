// 參拜流程、供品、打氣語、文昌文化等文字內容（集中在這裡，方便日後修改）

export const STEPS = [
  { id: 'prepare', dock: '備供品', label: '到辦事處挑供品、領三炷香', where: 'counter',
    done: '供品備好了，三炷香也點上了。准考證影本和文具先帶在身上。' },
  { id: 'heaven', dock: '拜天公', label: '在天公爐前面朝廟外拜天公，自我介紹（先不插香）', where: 'censerOut',
    done: '已面朝廟外向天公報上姓名、生日、住址。香先拿著，等一下再插。' },
  { id: 'wenchang', dock: '拜文昌', label: '入殿把供品擺上供桌，向文昌帝君稟告考試與心願', where: 'cushion',
    done: '已向文昌帝君稟告考試與心願，也許下金榜題名後回來還願。' },
  { id: 'plant', dock: '插香', label: '回天公爐插上三炷香', where: 'censer',
    done: '三炷香插進天公爐了。' },
  { id: 'pass', dock: '過爐', label: '准考證影本與文具在爐上順時針繞三圈', where: 'censer',
    done: '准考證影本與文具過爐完成，收進書包，考試那天帶著。' },
  { id: 'card', dock: '祈福卡', label: '寫一張祈福卡，掛上祈福牆', where: 'wall',
    done: '祈福卡掛上牆了。' },
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

// 悄悄話的快速句子
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
];
export const SOURCES = [
  ['NOWnews：拜文昌帝君流程與供品', 'https://www.nownews.com/news/6774035'],
  ['TVBS：考生拜文昌注意事項', 'https://news.tvbs.com.tw/life/2371078'],
  ['今周刊：文昌帝君怎麼拜、說詞、供品', 'https://www.businesstoday.com.tw/article/category/183035/post/202605040028/'],
  ['東海大學圖書館館刊第19期（五文昌）', 'https://dcollection.lib.thu.edu.tw/wp-content/uploads/2024/12/第19期館刊32-37.pdf'],
];
