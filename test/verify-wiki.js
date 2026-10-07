/* ============================================================
 * Wiki 存在性审计工具（需要网络，用 Node fetch 直连星露谷 Wiki）
 * 用法：node test/verify-wiki.js
 *
 * 双轮核对：
 *   第一轮 中文名 → 中文 Wiki（zh.stardewvalleywiki.com）
 *          —— 全量覆盖 313 条，无需映射表，实测命中率 ~90%
 *   第二轮 英文名 → 英文 Wiki（stardewvalleywiki.com）
 *          —— 仅覆盖 EN 表内的条目，用于交叉验证英文页名
 *   两轮都未命中的条目单列，供人工判断是「真缺失」还是「wiki 无独立页」
 *
 * 背景（见 docs/PROBLEMS.md #30）：
 *   早期只做英文轮，且 QUESTS/EVENTS 完全未纳入 —— 实际只有 231/313 条
 *   （73.8%）被核对过，82 条从未验证。中文轮把覆盖率提到 89.5%，
 *   且新增数据时无需再手工维护映射表。
 * ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

const EN_API = "https://stardewvalleywiki.com/mediawiki/api.php";
const ZH_API = "https://zh.stardewvalleywiki.com/mediawiki/api.php";

const q = (url) =>
  fetch(url, { signal: AbortSignal.timeout(30000), headers: { "User-Agent": "StardewGuide/1.0" } }).then((r) => r.json());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* id -> 英文条目名（第二轮交叉验证用；未覆盖的条目由中文轮兜底） */
const EN = {
  crops: {
    parsnip: "Parsnip", potato: "Potato", greenbean: "Green Bean", cauliflower: "Cauliflower",
    strawberry: "Strawberry", kale: "Kale", blueberry: "Blueberry", melon: "Melon", tomato: "Tomato",
    hotpepper: "Hot Pepper", wheat: "Wheat", corn: "Corn", sunflower: "Sunflower", pumpkin: "Pumpkin",
    cranberry: "Cranberries", eggplant: "Eggplant", yam: "Yam", amaranth: "Amaranth", artichoke: "Artichoke",
    tulip: "Tulip", "blue-jazz": "Blue Jazz", "coffee-bean": "Coffee Bean", rhubarb: "Rhubarb",
    hops: "Hops", starfruit: "Starfruit", "red-cabbage": "Red Cabbage", poppy: "Poppy",
    "summer-squash": "Summer Squash", "grape-crop": "Grape", beet: "Beet", "bok-choy": "Bok Choy",
    "ancient-fruit": "Ancient Fruit",
  },
  collect: {
    "wild-horseradish": "Wild Horseradish", daffodil: "Daffodil", leek: "Leek", dandelion: "Dandelion",
    "spring-onion": "Spring Onion", "spice-berry": "Spice Berry", grape: "Grape", "sweet-pea": "Sweet Pea",
    "fiddlehead-fern": "Fiddlehead Fern", "common-mushroom": "Common Mushroom", "wild-plum": "Wild Plum",
    hazelnut: "Hazelnut", blackberry: "Blackberry", chanterelle: "Chanterelle", "winter-root": "Winter Root",
    "crystal-fruit": "Crystal Fruit", "snow-yam": "Snow Yam", crocus: "Crocus", holly: "Holly",
    "red-mushroom": "Red Mushroom", coral: "Coral", "sea-urchin": "Sea Urchin", "rainbow-shell": "Rainbow Shell",
    "nautilus-shell": "Nautilus Shell", coconut: "Coconut", "cactus-fruit": "Cactus Fruit",
  },
  fish: {
    carp: "Carp", largemouth: "Largemouth Bass", rainbow: "Rainbow Trout", sturgeon: "Sturgeon",
    bullhead: "Bullhead", chub: "Chub", lingcod: "Lingcod", legend: "Legend", sunfish: "Sunfish",
    smallmouth: "Smallmouth Bass", walleye: "Walleye", perch: "Perch", bream: "Bream", shad: "Shad",
    salmon: "Salmon", tiger: "Tiger Trout", catfish: "Catfish", pike: "Pike", dorado: "Dorado",
    angler: "Angler", glacierfish: "Glacierfish", anchovy: "Anchovy", sardine: "Sardine", tuna: "Tuna",
    "red-snapper": "Red Snapper", squid: "Squid", "sea-cucumber": "Sea Cucumber", herring: "Herring",
    eel: "Eel", octopus: "Octopus", pufferfish: "Pufferfish", halibut: "Halibut", "red-mullet": "Red Mullet",
    tilapia: "Tilapia", albacore: "Albacore", flounder: "Flounder", "super-cucumber": "Super Cucumber",
    crimsonfish: "Crimsonfish", "midnight-squid": "Midnight Squid", "spook-fish": "Spook Fish",
    blobfish: "Blobfish", lobster: "Lobster", crab: "Crab", clam: "Clam", oyster: "Oyster", mussel: "Mussel",
    cockle: "Cockle", shrimp: "Shrimp", crayfish: "Crayfish", snail: "Snail", periwinkle: "Periwinkle",
    stonefish: "Stonefish", ghostfish: "Ghostfish", "ice-pip": "Ice Pip", "lava-eel": "Lava Eel",
    sandfish: "Sandfish", "scorpion-carp": "Scorpion Carp", woodskip: "Woodskip", "mutant-carp": "Mutant Carp",
    "void-salmon": "Void Salmon", stingray: "Stingray", lionfish: "Lionfish", "blue-discus": "Blue Discus",
    "midnight-carp": "Midnight Carp", "son-of-crimsonfish": "Son of Crimsonfish", "legend-2": "Legend II",
    "glacierfish-jr": "Glacierfish Jr.", "ms-angler": "Ms. Angler",
  },
  npc: {
    abigail: "Abigail", leah: "Leah", penny: "Penny", maru: "Maru", emily: "Emily", haley: "Haley",
    sam: "Sam", sebastian: "Sebastian", alex: "Alex", harvey: "Harvey", elliott: "Elliott", shane: "Shane",
    robin: "Robin", clint: "Clint", marnie: "Marnie", pierre: "Pierre", willy: "Willy", lewis: "Lewis",
    jodi: "Jodi", pam: "Pam", gus: "Gus", caroline: "Caroline", demetrius: "Demetrius", george: "George",
    evelyn: "Evelyn", vincent: "Vincent", jas: "Jas", kent: "Kent", sandy: "Sandy",
    rasmodius: "Wizard", marlon: "Marlon", gunther: "Gunther", krobus: "Krobus",
  },
  minerals: {
    copper: "Copper Ore", iron: "Iron Ore", "gold-ore": "Gold Ore", iridium: "Iridium Ore", coal: "Coal",
    quartz: "Quartz", amethyst: "Amethyst", topaz: "Topaz", emerald: "Emerald", ruby: "Ruby",
    diamond: "Diamond", prismatic: "Prismatic Shard", aquamarine: "Aquamarine", jade: "Jade", opal: "Opal",
    "fire-opal": "Fire Opal", "earth-crystal": "Earth Crystal", "frozen-tear": "Frozen Tear",
    "fire-quartz": "Fire Quartz", obsidian: "Obsidian", clay: "Clay", marble: "Marble", granite: "Granite",
    slate: "Slate", sandstone: "Sandstone", limestone: "Limestone", basalt: "Basalt", dolomite: "Dolomite",
    "thunder-egg": "Thunder Egg", "tigers-eye": "Tigerseye", "star-shard": "Star Shards",
    "petrified-slime": "Petrified Slime",
  },
  monsters: {
    "green-slime": "Green Slime", "blue-slime": "Blue Slime", "rock-crab": "Rock Crab",
    "cave-fly": "Cave Fly", bat: "Bats", duggy: "Duggy", skeleton: "Skeleton", ghost: "Ghost",
    "shadow-brute": "Shadow Brute", "purple-slime": "Purple Slime", serpent: "Serpent", mummy: "Mummy",
    "lava-crab": "Lava Crab", "cave-grub": "Cave Grub", "dust-sprite": "Dust Sprite",
    "frost-bat": "Frost Bat", "lava-bat": "Lava Bat", "shadow-shaman": "Shadow Shaman",
    "red-slime": "Red Slime", "copper-slime": "Copper Slime", "iron-slime": "Iron Slime",
    "metal-head": "Metal Head", "magma-sprite": "Magma Sprite", "wilderness-golem": "Wilderness Golem",
    "mutant-grub": "Mutant Grub", "mutant-fly": "Mutant Fly", "tiger-slime": "Tiger slime",
    "iridium-bat": "Iridium Bat", "iridium-crab": "Iridium Crab", "magma-sparker": "Magma Sparker",
    "gold-slime": "Gold Slime", "iridium-slime": "Iridium Slime",
  },
  festivals: {
    "egg-festival": "Egg Festival", "flower-dance": "Flower Dance", luau: "Luau",
    moonlight: "Dance of the Moonlight Jellies", fair: "Stardew Valley Fair",
    "spirits-eve": "Spirit's Eve", "festival-of-ice": "Festival of Ice", "winter-star": "Feast of the Winter Star",
  },
};

const MODULES = [
  ["crops", "CROPS", "农作物"],
  ["collect", "COLLECTIBLES", "收集物"],
  ["fish", "FISH", "钓鱼"],
  ["minerals", "MINERALS", "采矿"],
  ["monsters", "MONSTERS", "战斗"],
  ["npc", "NPCS", "NPC"],
  ["festivals", "FESTIVALS", "节日"],
];

/* 已知 wiki 无独立页、但内容真实存在（挂在汇总页下），不计入异常 */
const KNOWN_HUB_ONLY = /史莱姆|蝙蝠|^星碎$/;

/* 批量按标题核对页面是否存在 */
async function checkTitles(api, titles) {
  const found = new Set();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    try {
      const j = await q(api + "?action=query&titles=" + encodeURIComponent(batch.join("|")) +
        "&prop=info&redirects=1&format=json&formatversion=2");
      (j.query.pages || []).forEach((p) => { if (!p.missing) found.add(p.title); });
      (j.query.redirects || []).forEach((r) => found.add(r.from));
      (j.query.normalized || []).forEach((n) => { if (found.has(n.to)) found.add(n.from); });
    } catch (e) {
      console.log("  ✗ 批次查询失败：" + e.message);
    }
    await sleep(150);
  }
  return found;
}

(async () => {
  const src = fs.readFileSync(path.join(root, "js/data.js"), "utf8");
  const data = new Function(
    src + "; return {CROPS,COLLECTIBLES,FISH,MINERALS,MONSTERS,QUESTS,NPCS,FESTIVALS,EVENTS};"
  )();

  /* 全部条目（含 QUESTS/EVENTS —— 此前完全未纳入审计） */
  const all = [];
  for (const [mod, key, label] of MODULES) {
    data[key].forEach((x) => all.push({ mod, label, id: x.id, name: x.name }));
  }
  data.QUESTS.forEach((x) => all.push({ mod: "quests", label: "任务", id: x.id, name: x.name }));
  data.EVENTS.forEach((x) => all.push({ mod: "events", label: "事件", id: x.id, name: x.name }));

  console.log("待核对：" + all.length + " 条\n");

  /* ---------- 第一轮：中文名 → 中文 Wiki（全量） ---------- */
  console.log("=== 第一轮：中文名 → 中文 Wiki（全量 " + all.length + " 条）===");
  const zhFound = await checkTitles(ZH_API, all.map((x) => x.name));
  const zhMiss = all.filter((x) => !zhFound.has(x.name));
  console.log("命中 " + (all.length - zhMiss.length) + " / " + all.length +
    "（覆盖率 " + (((all.length - zhMiss.length) / all.length) * 100).toFixed(1) + "%）");

  /* ---------- 第二轮：英文名 → 英文 Wiki（仅 EN 表覆盖的条目） ---------- */
  const withEn = [];
  for (const [mod, , label] of MODULES) {
    const key = MODULES.find((m) => m[0] === mod)[1];
    data[key].forEach((x) => { if (EN[mod] && EN[mod][x.id]) withEn.push({ mod, label, id: x.id, name: x.name, en: EN[mod][x.id] }); });
  }
  console.log("\n=== 第二轮：英文名 → 英文 Wiki（" + withEn.length + " 条有映射，交叉验证）===");
  const enFound = await checkTitles(EN_API, withEn.map((x) => x.en));
  const enMiss = withEn.filter((x) => !enFound.has(x.en));
  console.log("命中 " + (withEn.length - enMiss.length) + " / " + withEn.length);
  const noEn = all.length - withEn.length;
  console.log("（另有 " + noEn + " 条无英文映射，仅由第一轮覆盖 —— 这正是旧版审计的盲区）");

  /* ---------- 汇总 ---------- */
  const bothMiss = zhMiss.filter((x) => {
    const e = withEn.find((w) => w.id === x.id && w.mod === x.mod);
    return e && enMiss.some((m) => m.id === x.id && m.mod === x.mod);
  });
  const onlyZhMiss = zhMiss.filter((x) => !bothMiss.includes(x));
  const suspicious = onlyZhMiss.filter((x) => !KNOWN_HUB_ONLY.test(x.name));

  console.log("\n=== 需要人工确认的条目 ===");
  console.log("两轮均未命中（最可疑）：" + bothMiss.length +
    (bothMiss.length ? "\n  " + bothMiss.map((x) => x.label + "/" + x.name + "(" + x.id + ")").join("、") : ""));
  console.log("\n仅中文轮未命中、且非已知汇总页条目（" + suspicious.length + "）：");
  const byLabel = {};
  suspicious.forEach((x) => (byLabel[x.label] ||= []).push(x.name));
  for (const [l, list] of Object.entries(byLabel)) console.log("  " + l + "：" + list.join("、"));
  console.log("\n提示：史莱姆/蝙蝠变体、任务、心事件在中文 Wiki 无独立页（挂在「史莱姆」「任务」「随机事件」汇总页下），属已知情况。");
})();
