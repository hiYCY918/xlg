/* ============================================================
 * Wiki 存在性审计工具（需要网络，用 Node fetch 直连星露谷 Wiki）
 * 用法：node test/verify-wiki.js
 * 作用：把 data.js 所有条目映射为英文条目名，批量核对 Wiki 页面存在性，
 *       防止凭记忆编造/错名（R12/R13 的自动化）
 * 说明：某些怪物（蓝/红/铜/铁/金/铱史莱姆、洞穴蛴螬等）游戏内真实存在
 *       但 Wiki 无独立页面，属已知情况，输出会列出供人工判断
 * ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

const q = (url) =>
  fetch(url, { signal: AbortSignal.timeout(30000), headers: { "User-Agent": "Mozilla/5.0" } }).then((r) => r.json());

/* id -> 英文条目名（新增数据时必须同步补充此表！） */
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

const MODULE_KEY = {
  crops: "CROPS", collect: "COLLECTIBLES", fish: "FISH", npc: "NPCS",
  minerals: "MINERALS", monsters: "MONSTERS", festivals: "FESTIVALS",
};
const MODULE_LABEL = { crops: "农作物", collect: "收集物", fish: "钓鱼", npc: "NPC", minerals: "采矿", monsters: "战斗", festivals: "节日" };

(async () => {
  const src = fs.readFileSync(path.join(root, "js/data.js"), "utf8");
  const data = new Function(src + "; return {CROPS,COLLECTIBLES,FISH,NPCS,MINERALS,MONSTERS,FESTIVALS};")();
  const checks = [];
  for (const [mod, key] of Object.entries(MODULE_KEY)) {
    for (const item of data[key]) {
      const en = EN[mod][item.id];
      if (!en) { console.log("⚠️ 缺少英文映射（请补充 test/verify-wiki.js 的 EN 表）:", mod, item.id, item.name); continue; }
      checks.push({ module: mod, id: item.id, cn: item.name, en });
    }
  }
  console.log("待核对:", checks.length, "项（Wiki 存在性）\n");

  const missingByModule = {};
  for (let i = 0; i < checks.length; i += 50) {
    const batch = checks.slice(i, i + 50);
    const j = await q(
      "https://stardewvalleywiki.com/mediawiki/api.php?action=query&titles=" +
        encodeURIComponent(batch.map((c) => c.en).join("|")) +
        "&prop=info&format=json&formatversion=2&redirects=1"
    );
    const pages = j.query.pages || [];
    const redirects = new Map((j.query.redirects || []).map((r) => [r.from.toLowerCase(), r.to]));
    for (const c of batch) {
      const found =
        pages.some((p) => !p.missing && p.title.toLowerCase() === c.en.toLowerCase()) ||
        redirects.has(c.en.toLowerCase());
      if (!found) (missingByModule[c.module] ||= []).push(c.cn + "(" + c.en + ")");
    }
  }

  let total = 0;
  for (const [mod, list] of Object.entries(missingByModule)) {
    console.log("❌ " + MODULE_LABEL[mod] + " 疑似缺失 (" + list.length + "):");
    console.log("   " + list.join("、"));
    total += list.length;
  }
  if (total === 0) console.log("✅ 全部条目在 Wiki 上存在");
  console.log("\n合计疑似缺失:", total);
  console.log("提示：史莱姆变体/洞穴蛴螬等无独立页面的怪物属已知情况（收录于 Slimes/Cave Insects 汇总页）");
})();
