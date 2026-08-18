/* ============================================================
 * 星露谷物语 · 攻略数据（示例，可按需补充）
 * 季节取值：'春' | '夏' | '秋' | '冬'
 * ============================================================ */

const SEASONS = ["春", "夏", "秋", "冬"];

/* ---------- 农作物 ----------
 * season: 数组；growth: 成熟天数；regrow: 再次收获间隔（0=不重复）
 * seed: 种子价格；sell: 基础售价 */
const CROPS = [
  { id: "parsnip",    name: "防风草",   season: ["春"],       growth: 4,  regrow: 0, seed: 20,  sell: 35,  note: "新手作物，成熟快" },
  { id: "potato",     name: "土豆",     season: ["春"],       growth: 6,  regrow: 0, seed: 50,  sell: 80,  note: "收获时有几率翻倍" },
  { id: "greenbean",  name: "青豆",     season: ["春"],       growth: 10, regrow: 3, seed: 60,  sell: 40,  note: "藤架作物，可多次收获" },
  { id: "cauliflower",name: "花椰菜",   season: ["春"],       growth: 12, regrow: 0, seed: 80,  sell: 175, note: "高价作物，可长成巨型" },
  { id: "strawberry", name: "草莓",     season: ["春"],       growth: 8,  regrow: 4, seed: 100, sell: 120, note: "蛋蛋节购买，多次收获" },
  { id: "kale",       name: "甘蓝",     season: ["春"],       growth: 6,  regrow: 0, seed: 70,  sell: 110, note: "收益稳定，经验多" },
  { id: "blueberry",  name: "蓝莓",     season: ["夏"],       growth: 13, regrow: 4, seed: 80,  sell: 50,  note: "一次收获 3 颗，多次收获" },
  { id: "melon",      name: "甜瓜",     season: ["夏"],       growth: 12, regrow: 0, seed: 80,  sell: 250, note: "高价作物，可长成巨型" },
  { id: "tomato",     name: "番茄",     season: ["夏"],       growth: 11, regrow: 4, seed: 50,  sell: 60,  note: "多次收获" },
  { id: "hotpepper",  name: "辣椒",     season: ["夏"],       growth: 5,  regrow: 3, seed: 40,  sell: 40,  note: "多次收获" },
  { id: "wheat",      name: "小麦",     season: ["夏", "秋"], growth: 4,  regrow: 0, seed: 10,  sell: 25,  note: "双季节，可磨成面粉" },
  { id: "corn",       name: "玉米",     season: ["夏", "秋"], growth: 14, regrow: 4, seed: 150, sell: 50,  note: "双季节，多次收获" },
  { id: "sunflower",  name: "向日葵",   season: ["夏", "秋"], growth: 8,  regrow: 0, seed: 200, sell: 80,  note: "收获时掉落向日葵种子" },
  { id: "pumpkin",    name: "南瓜",     season: ["秋"],       growth: 13, regrow: 0, seed: 100, sell: 320, note: "高价作物，可长成巨型" },
  { id: "cranberry",  name: "蔓越莓",   season: ["秋"],       growth: 7,  regrow: 5, seed: 240, sell: 75,  note: "一次收获 2 颗，多次收获" },
  { id: "eggplant",   name: "茄子",     season: ["秋"],       growth: 5,  regrow: 5, seed: 20,  sell: 60,  note: "多次收获" },
  { id: "yam",        name: "山药",     season: ["秋"],       growth: 10, regrow: 0, seed: 60,  sell: 160, note: "秋季节日食材" },
  { id: "amaranth",   name: "苋菜",     season: ["秋"],       growth: 7,  regrow: 0, seed: 70,  sell: 150, note: "高价单收作物" },
  { id: "artichoke",  name: "洋蓟",     season: ["秋"],       growth: 8,  regrow: 0, seed: 30,  sell: 160, note: "第二年解锁" },
];

/* ---------- 收集物（野外采集） ---------- */
const COLLECTIBLES = [
  { id: "wild-horseradish", name: "野山葵",   season: ["春"],       location: "全图",     sell: 50,  use: "春季采集包、送礼" },
  { id: "daffodil",         name: "水仙",     season: ["春"],       location: "全图",     sell: 30,  use: "春季采集包" },
  { id: "leek",             name: "韭葱",     season: ["春"],       location: "全图",     sell: 60,  use: "春季采集包" },
  { id: "dandelion",        name: "蒲公英",   season: ["春"],       location: "全图",     sell: 40,  use: "春季采集包" },
  { id: "spring-onion",     name: "春葱",     season: ["春"],       location: "河岸南侧", sell: 8,   use: "春季采集包" },
  { id: "spice-berry",      name: "香味浆果", season: ["夏"],       location: "全图",     sell: 80,  use: "夏季采集包" },
  { id: "grape",            name: "葡萄",     season: ["夏"],       location: "全图",     sell: 80,  use: "夏季采集包" },
  { id: "sweet-pea",        name: "甜豌豆",   season: ["夏"],       location: "全图",     sell: 50,  use: "夏季采集包" },
  { id: "fiddlehead-fern",  name: "蕨菜",     season: ["夏"],       location: "秘密森林", sell: 90,  use: "厨师收集包" },
  { id: "common-mushroom",  name: "普通蘑菇", season: ["秋"],       location: "全图",     sell: 40,  use: "秋季采集包" },
  { id: "wild-plum",        name: "野梅",     season: ["秋"],       location: "全图",     sell: 80,  use: "秋季采集包" },
  { id: "hazelnut",         name: "榛子",     season: ["秋"],       location: "全图",     sell: 90,  use: "秋季采集包" },
  { id: "blackberry",       name: "黑莓",     season: ["秋"],       location: "灌木丛",   sell: 20,  use: "秋季采集包" },
  { id: "chanterelle",      name: "鸡油菌",   season: ["秋"],       location: "秘密森林", sell: 160, use: "高价值采集" },
  { id: "winter-root",      name: "冬根",     season: ["冬"],       location: "全图挖掘", sell: 70,  use: "冬季采集包" },
  { id: "crystal-fruit",    name: "水晶果",   season: ["冬"],       location: "全图",     sell: 150, use: "冬季采集包" },
  { id: "snow-yam",         name: "雪番薯",   season: ["冬"],       location: "全图挖掘", sell: 100, use: "冬季采集包" },
  { id: "crocus",           name: "番红花",   season: ["冬"],       location: "全图",     sell: 60,  use: "冬季采集包" },
  { id: "holly",            name: "冬青",     season: ["冬"],       location: "全图",     sell: 80,  use: "装饰、送礼（慎送）" },
];

/* ---------- 钓鱼 ----------
 * locCat: 水域分类（山湖/河流/海洋/蟹笼/矿井/沙漠/其他），用于筛选 */
const FISH = [
  /* ---- 山湖 ---- */
  { id: "carp",          name: "鲤鱼",       location: "山湖",       locCat: "山湖", season: SEASONS, time: "全天",       weather: "任意", difficulty: 15,  sell: 30,   use: "湖鱼包、料理" },
  { id: "largemouth",    name: "大嘴黑鲈",   location: "山湖",       locCat: "山湖", season: SEASONS, time: "06:00-19:00", weather: "任意", difficulty: 50,  sell: 100,  use: "湖鱼包" },
  { id: "rainbow",       name: "虹鳟",       location: "山湖/河流",  locCat: "山湖", season: ["夏"], time: "06:00-19:00", weather: "晴",   difficulty: 45,  sell: 65,   use: "料理、送礼" },
  { id: "sturgeon",      name: "鲟鱼",       location: "山湖",       locCat: "山湖", season: ["夏","冬"], time: "06:00-19:00", weather: "任意", difficulty: 78,  sell: 200,  use: "湖鱼包（稀有）" },
  { id: "bullhead",      name: "牛头鲶",     location: "山湖",       locCat: "山湖", season: SEASONS, time: "全天",       weather: "任意", difficulty: 46,  sell: 75,   use: "湖鱼包" },
  { id: "chub",          name: "鲦鱼",       location: "山湖",       locCat: "山湖", season: SEASONS, time: "全天",       weather: "任意", difficulty: 35,  sell: 50,   use: "湖鱼包" },
  { id: "lingcod",       name: "绵鳚",       location: "山湖/河流",  locCat: "山湖", season: ["冬"], time: "全天",       weather: "任意", difficulty: 85,  sell: 150,  use: "湖鱼包、河鱼包" },
  { id: "legend",        name: "传说之鱼",   location: "山湖",       locCat: "山湖", season: ["春"], time: "全天",       weather: "雨",   difficulty: 110, sell: 5000, use: "传说鱼（图鉴）" },
  /* ---- 河流 ---- */
  { id: "sunfish",       name: "太阳鱼",     location: "河流",       locCat: "河流", season: ["春","夏"], time: "06:00-19:00", weather: "晴",   difficulty: 30,  sell: 30,   use: "河鱼包" },
  { id: "smallmouth",    name: "小嘴鲈鱼",   location: "河流",       locCat: "河流", season: ["春","秋"], time: "全天",       weather: "任意", difficulty: 28,  sell: 50,   use: "河鱼包" },
  { id: "walleye",       name: "大眼鲈鱼",   location: "河流",       locCat: "河流", season: ["秋"], time: "12:00-02:00", weather: "雨",   difficulty: 45,  sell: 105,  use: "河鱼包（雨天夜晚）" },
  { id: "perch",         name: "河鲈",       location: "河流",       locCat: "河流", season: ["冬"], time: "全天",       weather: "任意", difficulty: 35,  sell: 55,   use: "河鱼包" },
  { id: "bream",         name: "鲷鱼",       location: "河流",       locCat: "河流", season: SEASONS, time: "全天",       weather: "任意", difficulty: 35,  sell: 45,   use: "河鱼包" },
  { id: "shad",          name: "美洲西鲱",   location: "河流",       locCat: "河流", season: ["春","夏","秋"], time: "09:00-02:00", weather: "雨", difficulty: 44, sell: 60, use: "河鱼包（雨天）" },
  { id: "salmon",        name: "鲑鱼",       location: "河流",       locCat: "河流", season: ["秋"], time: "06:00-19:00", weather: "任意", difficulty: 50,  sell: 75,   use: "河鱼包" },
  { id: "tiger",         name: "虎纹鳟鱼",   location: "河流",       locCat: "河流", season: ["秋","冬"], time: "06:00-19:00", weather: "任意", difficulty: 60,  sell: 150,  use: "河鱼包" },
  { id: "catfish",       name: "鲶鱼",       location: "河流",       locCat: "河流", season: ["春","夏","秋"], time: "全天", weather: "雨", difficulty: 75, sell: 200, use: "河鱼包（雨天）" },
  { id: "pike",          name: "狗鱼",       location: "河流",       locCat: "河流", season: ["夏","冬"], time: "全天",       weather: "任意", difficulty: 60,  sell: 100,  use: "河鱼包" },
  { id: "dorado",        name: "鲯鳅",       location: "河流",       locCat: "河流", season: ["夏"], time: "06:00-19:00", weather: "任意", difficulty: 78,  sell: 165,  use: "河鱼包（稀有）" },
  { id: "angler",        name: "垂钓者",     location: "河流（北）", locCat: "河流", season: ["秋"], time: "全天",       weather: "任意", difficulty: 85,  sell: 4500, use: "传说鱼（图鉴）" },
  { id: "glacierfish",   name: "冰川鱼",     location: "河流（南）", locCat: "河流", season: ["冬"], time: "全天",       weather: "任意", difficulty: 100, sell: 5000, use: "传说鱼（图鉴）" },
  /* ---- 海洋 ---- */
  { id: "anchovy",       name: "凤尾鱼",     location: "海洋",       locCat: "海洋", season: ["春","秋"], time: "06:00-19:00", weather: "任意", difficulty: 20,  sell: 30,   use: "海鱼包" },
  { id: "sardine",       name: "沙丁鱼",     location: "海洋",       locCat: "海洋", season: ["春","秋","冬"], time: "06:00-19:00", weather: "任意", difficulty: 30, sell: 40, use: "海鱼包" },
  { id: "tuna",          name: "金枪鱼",     location: "海洋",       locCat: "海洋", season: ["夏","冬"], time: "06:00-19:00", weather: "任意", difficulty: 70,  sell: 100,  use: "海鱼包" },
  { id: "red-snapper",   name: "红鲷鱼",     location: "海洋",       locCat: "海洋", season: ["夏","秋"], time: "06:00-19:00", weather: "任意", difficulty: 40,  sell: 50,   use: "海鱼包" },
  { id: "squid",         name: "鱿鱼",       location: "海洋",       locCat: "海洋", season: ["冬"], time: "18:00-02:00", weather: "任意", difficulty: 75,  sell: 80,   use: "海鱼包、料理" },
  { id: "sea-cucumber",  name: "海参",       location: "海洋",       locCat: "海洋", season: ["秋","冬"], time: "06:00-19:00", weather: "任意", difficulty: 40,  sell: 75,   use: "海鱼包、料理" },
  { id: "herring",       name: "鲱鱼",       location: "海洋",       locCat: "海洋", season: ["春","冬"], time: "全天",       weather: "任意", difficulty: 25,  sell: 30,   use: "海鱼包" },
  { id: "eel",           name: "鳗鱼",       location: "海洋",       locCat: "海洋", season: ["春","秋"], time: "16:00-02:00", weather: "雨",   difficulty: 70,  sell: 85,   use: "海鱼包（雨天夜晚）" },
  { id: "octopus",       name: "章鱼",       location: "海洋",       locCat: "海洋", season: ["夏"], time: "06:00-13:00", weather: "任意", difficulty: 95,  sell: 150,  use: "海鱼包（稀有）" },
  { id: "pufferfish",    name: "河豚",       location: "海洋",       locCat: "海洋", season: ["夏"], time: "12:00-16:00", weather: "晴",   difficulty: 80,  sell: 200,  use: "稀有鱼、任务" },
  { id: "halibut",       name: "大比目鱼",   location: "海洋",       locCat: "海洋", season: ["春","夏","冬"], time: "06:00-11:00 / 19:00-02:00", weather: "任意", difficulty: 50, sell: 90, use: "海鱼包" },
  { id: "red-mullet",    name: "红鲻鱼",     location: "海洋",       locCat: "海洋", season: ["夏"], time: "06:00-19:00", weather: "任意", difficulty: 55,  sell: 75,   use: "海鱼包" },
  { id: "tilapia",       name: "罗非鱼",     location: "海洋",       locCat: "海洋", season: ["夏","秋"], time: "06:00-19:00", weather: "任意", difficulty: 50,  sell: 75,   use: "海鱼包" },
  { id: "albacore",      name: "长鳍金枪鱼", location: "海洋",       locCat: "海洋", season: ["秋","冬"], time: "06:00-11:00 / 18:00-02:00", weather: "任意", difficulty: 60, sell: 75, use: "海鱼包" },
  { id: "flounder",      name: "比目鱼",     location: "海洋",       locCat: "海洋", season: ["夏","秋"], time: "06:00-19:00", weather: "任意", difficulty: 50,  sell: 100,  use: "海鱼包" },
  { id: "super-cucumber", name: "超级海参",  location: "海洋",       locCat: "海洋", season: SEASONS, time: "18:00-02:00", weather: "任意", difficulty: 80,  sell: 250,  use: "海鱼包（稀有）" },
  { id: "crimsonfish",   name: "绯红鱼",     location: "海洋（东）", locCat: "海洋", season: ["夏"], time: "全天",       weather: "任意", difficulty: 95,  sell: 4500, use: "传说鱼（图鉴）" },
  { id: "midnight-squid", name: "午夜鱿鱼",  location: "夜市·潜艇",  locCat: "其他", season: ["冬"], time: "17:00-02:00", weather: "任意", difficulty: 55,  sell: 100,  use: "夜市限定" },
  { id: "spook-fish",    name: "幽灵鱼",     location: "夜市·潜艇",  locCat: "其他", season: ["冬"], time: "17:00-02:00", weather: "任意", difficulty: 60,  sell: 220,  use: "夜市限定" },
  { id: "blobfish",      name: "水滴鱼",     location: "夜市·潜艇",  locCat: "其他", season: ["冬"], time: "17:00-02:00", weather: "任意", difficulty: 70,  sell: 500,  use: "夜市限定（稀有）" },
  /* ---- 蟹笼 ---- */
  { id: "lobster",       name: "龙虾",       location: "蟹笼·海洋", locCat: "蟹笼", season: SEASONS, time: "全天", weather: "任意", difficulty: 0, sell: 120, use: "蟹笼捕获" },
  { id: "crab",          name: "螃蟹",       location: "蟹笼·海洋", locCat: "蟹笼", season: SEASONS, time: "全天", weather: "任意", difficulty: 0, sell: 100, use: "蟹笼捕获" },
  { id: "clam",          name: "蛤蜊",       location: "蟹笼·海洋", locCat: "蟹笼", season: SEASONS, time: "全天", weather: "任意", difficulty: 0, sell: 50,  use: "蟹笼捕获、料理" },
  { id: "oyster",        name: "牡蛎",       location: "蟹笼·海洋", locCat: "蟹笼", season: SEASONS, time: "全天", weather: "任意", difficulty: 0, sell: 40,  use: "蟹笼捕获" },
  { id: "mussel",        name: "贻贝",       location: "蟹笼·海洋", locCat: "蟹笼", season: SEASONS, time: "全天", weather: "任意", difficulty: 0, sell: 30,  use: "蟹笼捕获、料理" },
  { id: "cockle",        name: "鸟蛤",       location: "蟹笼·海洋", locCat: "蟹笼", season: SEASONS, time: "全天", weather: "任意", difficulty: 0, sell: 50,  use: "蟹笼捕获" },
  { id: "shrimp",        name: "虾",         location: "蟹笼·海洋", locCat: "蟹笼", season: SEASONS, time: "全天", weather: "任意", difficulty: 0, sell: 60,  use: "蟹笼捕获" },
  { id: "crayfish",      name: "淡水龙虾",   location: "蟹笼·淡水", locCat: "蟹笼", season: SEASONS, time: "全天", weather: "任意", difficulty: 0, sell: 75,  use: "蟹笼捕获" },
  { id: "snail",         name: "蜗牛",       location: "蟹笼·淡水", locCat: "蟹笼", season: SEASONS, time: "全天", weather: "任意", difficulty: 0, sell: 65,  use: "蟹笼捕获" },
  { id: "periwinkle",    name: "玉黍螺",     location: "蟹笼·淡水", locCat: "蟹笼", season: SEASONS, time: "全天", weather: "任意", difficulty: 0, sell: 20,  use: "蟹笼捕获" },
  /* ---- 矿井 ---- */
  { id: "stonefish",     name: "石鱼",       location: "矿井·第20层", locCat: "矿井", season: SEASONS, time: "全天", weather: "任意", difficulty: 65, sell: 300, use: "矿井专属" },
  { id: "ghostfish",     name: "幽灵鱼",     location: "矿井·20/60层", locCat: "矿井", season: SEASONS, time: "全天", weather: "任意", difficulty: 50, sell: 200, use: "矿井专属" },
  { id: "ice-pip",       name: "冰柱鱼",     location: "矿井·第20层", locCat: "矿井", season: SEASONS, time: "全天", weather: "任意", difficulty: 85, sell: 500, use: "矿井专属（稀有）" },
  { id: "lava-eel",      name: "熔岩鳗鱼",   location: "矿井·第100层", locCat: "矿井", season: SEASONS, time: "全天", weather: "任意", difficulty: 90, sell: 700, use: "矿井专属（稀有）" },
  /* ---- 沙漠 ---- */
  { id: "sandfish",      name: "沙鱼",       location: "沙漠",       locCat: "沙漠", season: SEASONS, time: "06:00-20:00", weather: "任意", difficulty: 65, sell: 75, use: "沙漠专属" },
  { id: "scorpion-carp", name: "蝎鲤鱼",     location: "沙漠",       locCat: "沙漠", season: SEASONS, time: "06:00-20:00", weather: "任意", difficulty: 90, sell: 150, use: "沙漠专属" },
  /* ---- 其他（森林/下水道/沼泽） ---- */
  { id: "woodskip",      name: "木鱼",       location: "秘密森林",   locCat: "其他", season: SEASONS, time: "全天", weather: "任意", difficulty: 50, sell: 75, use: "湖鱼包" },
  { id: "mutant-carp",   name: "突变鲤鱼",   location: "下水道",     locCat: "其他", season: SEASONS, time: "全天", weather: "任意", difficulty: 80, sell: 1000, use: "传说鱼（图鉴）" },
  { id: "void-salmon",   name: "虚空鲑鱼",   location: "女巫沼泽",   locCat: "其他", season: SEASONS, time: "全天", weather: "任意", difficulty: 80, sell: 150, use: "沼泽专属" },
  /* ---- 姜岛 ---- */
  { id: "stingray",       name: "黄貂鱼",     location: "姜岛",       locCat: "姜岛", season: SEASONS, time: "全天", weather: "任意", difficulty: 80, sell: 300, use: "姜岛专属" },
  { id: "lionfish",       name: "狮子鱼",     location: "姜岛",       locCat: "姜岛", season: SEASONS, time: "全天", weather: "任意", difficulty: 90, sell: 100, use: "姜岛专属" },
  { id: "blue-discus",    name: "蓝圆盘鱼",   location: "姜岛",       locCat: "姜岛", season: SEASONS, time: "全天", weather: "任意", difficulty: 100, sell: 500, use: "姜岛专属（稀有）" },
  { id: "midnight-carp",  name: "午夜鲤鱼",   location: "姜岛池塘",   locCat: "姜岛", season: SEASONS, time: "全天", weather: "任意", difficulty: 55, sell: 150, use: "姜岛专属" },
  { id: "son-of-crimsonfish", name: "绯红鱼之子", location: "姜岛·东", locCat: "姜岛", season: SEASONS, time: "全天", weather: "任意", difficulty: 99, sell: 3000, use: "传说鱼（图鉴）" },
  { id: "legend-2",       name: "传说鱼二代", location: "姜岛",       locCat: "姜岛", season: SEASONS, time: "全天", weather: "任意", difficulty: 110, sell: 5000, use: "传说鱼（图鉴）" },
  { id: "glacierfish-jr", name: "冰川鱼幼体", location: "姜岛·南",   locCat: "姜岛", season: SEASONS, time: "全天", weather: "任意", difficulty: 99, sell: 3000, use: "传说鱼（图鉴）" },
  { id: "ms-angler",      name: "垂钓女士",   location: "姜岛·北",   locCat: "姜岛", season: SEASONS, time: "全天", weather: "任意", difficulty: 99, sell: 3000, use: "传说鱼（图鉴）" },
];

/* ---------- 采矿 ---------- */
const MINERALS = [
  { id: "copper",     name: "铜矿石",   type: "矿石", level: "矿井 1-39 层",    sell: 5,   use: "冶炼铜锭" },
  { id: "iron",       name: "铁矿石",   type: "矿石", level: "矿井 40-79 层",   sell: 10,  use: "冶炼铁锭" },
  { id: "gold-ore",   name: "金矿石",   type: "矿石", level: "矿井 80-119 层",  sell: 25,  use: "冶炼金锭" },
  { id: "iridium",    name: "铱矿石",   type: "矿石", level: "115 层+ / 沙漠矿洞", sell: 100, use: "冶炼铱锭" },
  { id: "coal",       name: "煤炭",     type: "资源", level: "全层 / 烧制木材", sell: 15,  use: "燃料、冶炼" },
  { id: "quartz",     name: "石英",     type: "矿物", level: "矿井 1-39 层",    sell: 25,  use: "精炼石英、玻璃" },
  { id: "amethyst",   name: "紫水晶",   type: "宝石", level: "全层",            sell: 100, use: "送礼（阿比盖尔）" },
  { id: "topaz",      name: "黄水晶",   type: "宝石", level: "全层",            sell: 80,  use: "送礼、售卖" },
  { id: "emerald",    name: "绿宝石",   type: "宝石", level: "矿井 80 层+",    sell: 250, use: "送礼（潘妮）" },
  { id: "ruby",       name: "红宝石",   type: "宝石", level: "矿井 80 层+",    sell: 250, use: "送礼、售卖" },
  { id: "diamond",    name: "钻石",     type: "宝石", level: "矿井 50 层+",    sell: 750, use: "送礼（通用）" },
  { id: "prismatic",  name: "五彩碎片", type: "特殊", level: "全层（极稀有）",  sell: 2000, use: "兑换银河剑" },
];

/* ---------- 战斗 ---------- */
const MONSTERS = [
  { id: "green-slime",  name: "绿史莱姆", hp: 24,  damage: 5,  location: "矿井 1-39 层",  drops: ["史莱姆黏液"],   type: "史莱姆" },
  { id: "blue-slime",   name: "蓝史莱姆", hp: 106, damage: 8,  location: "矿井 40-79 层", drops: ["史莱姆黏液"],   type: "史莱姆" },
  { id: "rock-crab",    name: "岩石蟹",   hp: 30,  damage: 5,  location: "矿井 1-29 层",  drops: ["蟹壳"],         type: "甲壳" },
  { id: "cave-fly",     name: "洞穴蝇",   hp: 22,  damage: 6,  location: "矿井 1-39 层",  drops: ["虫肉"],         type: "飞行" },
  { id: "bat",          name: "蝙蝠",     hp: 24,  damage: 6,  location: "矿井 30-119 层", drops: ["蝙蝠翅膀"],    type: "飞行" },
  { id: "duggy",        name: "铁甲虫",   hp: 40,  damage: 5,  location: "矿井 6-29 层",  drops: ["黏土"],         type: "地底" },
  { id: "skeleton",     name: "骷髅",     hp: 72,  damage: 10, location: "矿井 70-119 层", drops: ["骨头"],        type: "不死" },
  { id: "ghost",        name: "幽灵",     hp: 96,  damage: 12, location: "矿井 50-89 层", drops: ["日光精华","虚空精华"], type: "幽灵" },
  { id: "shadow-brute", name: "暗影蛮兵", hp: 160, damage: 18, location: "矿井 80-119 层", drops: ["虚空精华"],    type: "暗影" },
  { id: "purple-slime", name: "紫色史莱姆", hp: 240, damage: 15, location: "沙漠矿洞",   drops: ["铱矿石"],      type: "史莱姆" },
  { id: "serpent",      name: "飞蛇",     hp: 150, damage: 23, location: "沙漠矿洞",     drops: ["虚空精华"],    type: "飞行" },
  { id: "mummy",        name: "木乃伊",   hp: 260, damage: 30, location: "沙漠矿洞",     drops: ["布料"],        type: "不死" },
];

/* ---------- 任务 ---------- */
const QUESTS = [
  { id: "getting-started", name: "入门",        source: "邮件",       type: "主线", objective: "种植并收获一颗防风草", reward: "100 金币" },
  { id: "introductions",   name: "自我介绍",    source: "主线",       type: "主线", objective: "与 28 位村民打招呼", reward: "100 金币" },
  { id: "wizard",          name: "巫师的委托",  source: "主线",       type: "主线", objective: "前往法师塔与法师会面，取得药剂", reward: "250 金币" },
  { id: "deeper",          name: "深入地底",    source: "矿井",       type: "主线", objective: "抵达矿井第 40 层", reward: "解锁电梯" },
  { id: "bottom",          name: "直达深渊",    source: "矿井",       type: "主线", objective: "抵达矿井第 120 层", reward: "头骨钥匙" },
  { id: "chicken",         name: "养鸡入门",    source: "罗宾",       type: "建造", objective: "建造一座鸡舍", reward: "解锁动物养殖" },
  { id: "community",       name: "社区中心",    source: "社区中心",   type: "收集", objective: "完成社区中心收集包", reward: "修复社区中心" },
  { id: "gift",            name: "冬日之星",    source: "刘易斯",     type: "节日", objective: "为秘密好友准备一份冬日之星礼物", reward: "节日礼物" },
  { id: "skull",           name: "沙漠钥匙",    source: "矿井",       type: "主线", objective: "集齐材料修复巴士，前往沙漠矿洞", reward: "解锁沙漠矿洞" },
  { id: "board",           name: "布告栏委托",  source: "皮埃尔店外", type: "委托", objective: "完成村民张贴的随机委托", reward: "金币与好感度" },
];

/* ---------- NPC ----------
 * birthday 格式 "季节 日"；loves 为最爱的礼物 */
const NPCS = [
  { id: "abigail",   name: "阿比盖尔",   birthday: "秋 13", loves: ["紫水晶", "南瓜", "巧克力蛋糕"], location: "皮埃尔家", marriageable: true,  desc: "紫发少女，喜欢冒险与电子游戏，是皮埃尔的女儿。" },
  { id: "leah",      name: "莉亚",       birthday: "冬 23", loves: ["沙拉", "羊奶酪", "葡萄酒"],   location: "森林木屋", marriageable: true,  desc: "住在森林里的艺术家，热爱自然与雕塑。" },
  { id: "penny",     name: "潘妮",       birthday: "秋 2",  loves: ["钻石", "翡翠", "罂粟"],       location: "拖车",     marriageable: true,  desc: "温柔的家庭教师，喜欢读书与孩子。" },
  { id: "maru",      name: "玛鲁",       birthday: "夏 10", loves: ["电池", "钻石", "草莓"],       location: "罗宾家",   marriageable: true,  desc: "罗宾的女儿，酷爱科学与发明。" },
  { id: "emily",     name: "艾米丽",     birthday: "春 27", loves: ["羊毛", "紫水晶", "翡翠"],     location: "海莉家",   marriageable: true,  desc: "酒吧女招待，热情乐观，喜爱裁缝与冥想。" },
  { id: "haley",     name: "海莉",       birthday: "春 14", loves: ["椰子", "向日葵", "粉红蛋糕"], location: "海莉家",   marriageable: true,  desc: "追求时尚的摄影爱好者，一开始略显高冷。" },
  { id: "sam",       name: "山姆",       birthday: "夏 17", loves: ["仙人掌果", "披萨", "可乐"],   location: "山姆家",   marriageable: true,  desc: "乐队吉他手，阳光开朗的年轻人。" },
  { id: "sebastian", name: "塞巴斯蒂安", birthday: "冬 10", loves: ["虚空蛋", "冷冻泪", "黑曜石"], location: "地下室",   marriageable: true,  desc: "沉迷电脑的机车少年，梦想去城市。" },
  { id: "alex",      name: "亚历克斯",   birthday: "夏 13", loves: ["全套早餐", "鲑鱼晚餐"],       location: "亚历克斯家", marriageable: true, desc: "热爱运动的网格球选手。" },
  { id: "harvey",    name: "哈维",       birthday: "冬 14", loves: ["咖啡", "泡菜", "松露油"],     location: "诊所",     marriageable: true,  desc: "镇上的医生，关心每位村民的健康。" },
  { id: "elliott",   name: "艾利欧特",   birthday: "秋 5",  loves: ["龙虾", "石榴", "墨鱼"],       location: "海滩小屋", marriageable: true,  desc: "住在海滩的浪漫作家。" },
  { id: "shane",     name: "谢恩",       birthday: "春 20", loves: ["啤酒", "辣椒", "披萨"],       location: "玛妮牧场", marriageable: true,  desc: "在超市打工的青年，喜欢鸡与啤酒。" },
  { id: "robin",     name: "罗宾",       birthday: "秋 21", loves: ["山羊奶酪", "桃子", "意大利面"], location: "木匠店",  marriageable: false, desc: "木匠，负责农场的房屋建造与升级。" },
  { id: "clint",     name: "克林特",     birthday: "冬 26", loves: ["宝石", "金锭", "铱锭"],       location: "铁匠铺",   marriageable: false, desc: "铁匠，帮助升级工具。" },
  { id: "marnie",    name: "玛妮",       birthday: "秋 18", loves: ["钻石", "粉红蛋糕", "南瓜派"], location: "牧场",     marriageable: false, desc: "经营牧场的老板娘，出售家禽与饲料。" },
  { id: "pierre",    name: "皮埃尔",     birthday: "春 26", loves: ["金枪鱼", "油炸鱿鱼"],         location: "杂货店",   marriageable: false, desc: "杂货店老板，出售种子与商品。" },
  { id: "willy",     name: "威利",       birthday: "夏 24", loves: ["鲶鱼", "南瓜", "钻石"],       location: "鱼店",     marriageable: false, desc: "老渔夫，出售钓竿与鱼饵。" },
  { id: "lewis",     name: "刘易斯",     birthday: "春 7",  loves: ["辣椒", "椰子", "秋季蔬菜"],   location: "镇长宅",   marriageable: false, desc: "星露谷的镇长。" },
];

/* ---------- 节日 ---------- */
const FESTIVALS = [
  { id: "egg-festival",   name: "蛋蛋节",       season: "春", day: 13, location: "广场", time: "09:00-14:00", desc: "寻找隐藏彩蛋的比赛，找到最多彩蛋获胜。" },
  { id: "flower-dance",   name: "花舞节",       season: "春", day: 24, location: "森林", time: "09:00-14:00", desc: "向心仪的村民发出舞伴邀请，共跳花之舞。" },
  { id: "luau",           name: "夏威夷宴",     season: "夏", day: 11, location: "海滩", time: "09:00-14:00", desc: "往汤锅里加入食材，食材品质决定州长评价。" },
  { id: "moonlight",      name: "月光水母节",   season: "夏", day: 28, location: "海滩", time: "22:00",       desc: "与村民一起观赏迁徙的月光水母。" },
  { id: "fair",           name: "星露谷展览会", season: "秋", day: 16, location: "广场", time: "09:00-15:00", desc: "展示你的农产品参与评比，还可玩小游戏赢星币。" },
  { id: "spirits-eve",    name: "灵之夜",       season: "秋", day: 27, location: "广场", time: "22:00",       desc: "迷宫冒险与南瓜主题庆典，可获得金南瓜。" },
  { id: "festival-of-ice",name: "冰钓节",       season: "冬", day: 8,  location: "森林", time: "09:00-14:00", desc: "限时冰钓比赛，比拼谁钓的鱼最多。" },
  { id: "winter-star",    name: "冬季之星宴会", season: "冬", day: 25, location: "广场", time: "09:00-14:00", desc: "与指定村民互赠礼物，共度温馨的冬日盛宴。" },
];

/* ---------- 事件 ---------- */
const EVENTS = [
  { id: "fairy",        name: "仙子来访",     type: "随机事件", trigger: "夜晚随机",   desc: "小仙子飞过农场，让附近的一小片作物瞬间成熟。" },
  { id: "witch",        name: "女巫来访",     type: "随机事件", trigger: "夜晚随机",   desc: "女巫飞过鸡舍，可能会把蛋变成虚空蛋，或留下礼物。" },
  { id: "meteorite",    name: "陨石坠地",     type: "随机事件", trigger: "夜晚随机",   desc: "农场掉落陨石，可用金镐开采，获得铱矿石。" },
  { id: "stone-owl",    name: "猫头鹰雕像",   type: "随机事件", trigger: "夜晚随机",   desc: "农场凭空出现一尊石猫头鹰雕像（稀有）。" },
  { id: "capsule",      name: "外星胶囊",     type: "随机事件", trigger: "夜晚随机",   desc: "出现一个神秘的胶囊，几天后可能破碎（稀有）。" },
  { id: "mushroom-tree",name: "蘑菇树",       type: "随机事件", trigger: "秋季",       desc: "农场的一棵树可能长成巨大的蘑菇树，可采集蘑菇。" },
  { id: "earthquake",   name: "地震",         type: "随机事件", trigger: "夏季第 3 天", desc: "夜里地震打通了去往温泉与火车站的障碍。" },
  { id: "heart-abigail2",name: "阿比盖尔 2 心", type: "心事件", trigger: "阿比盖尔 2 心", desc: "在皮埃尔家与她一起玩电子游戏，增进感情。" },
  { id: "heart-leah2",  name: "莉亚 2 心",    type: "心事件", trigger: "莉亚 2 心",   desc: "拜访莉亚的木屋，欣赏她的雕塑作品。" },
  { id: "heart-seb4",   name: "塞巴斯蒂安 4 心", type: "心事件", trigger: "塞巴斯蒂安 4 心", desc: "在地下室与他共度骑机车的夜晚。" },
  { id: "heart-shane6", name: "谢恩 6 心",    type: "心事件", trigger: "谢恩 6 心",   desc: "在他情绪低落时给予支持，逐渐打开心扉。" },
  { id: "heart-penny8", name: "潘妮 8 心",    type: "心事件", trigger: "潘妮 8 心",   desc: "陪伴潘妮进行她的课外教学活动。" },
];
