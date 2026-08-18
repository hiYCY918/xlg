// 抓取新增条目的中文Wiki数据（infobox 解析）
const fs = require("fs");
const q = (url) =>
  fetch(url, { signal: AbortSignal.timeout(60000), headers: { "User-Agent": "Mozilla/5.0" } }).then((r) => r.json());
const base = "https://zh.stardewvalleywiki.com/mediawiki/api.php?";

// 新增条目：module, id, zh标题, eng
const NEW = [
  // 农作物
  ["crops", "rice", "未碾米", "Rice"], ["crops", "carrot", "胡萝卜", "Carrot"], ["crops", "garlic", "蒜", "Garlic"],
  ["crops", "summer-spangle", "夏季亮片", "Summer Spangle"], ["crops", "radish", "萝卜", "Radish"], ["crops", "taro", "芋头", "Taro"],
  ["crops", "fairy-rose", "玫瑰仙子", "Fairy Rose"], ["crops", "sweet-gem-berry", "宝石甜莓", "Sweet Gem Berry"],
  ["crops", "broccoli", "西蓝花", "Broccoli"], ["crops", "powder-melon", "霜瓜", "Powder Melon"],
  ["crops", "tea-leaves", "茶叶", "Tea Leaves"], ["crops", "mango", "芒果", "Mango"], ["crops", "pineapple", "菠萝", "Pineapple"],
  ["crops", "qi-fruit", "齐瓜", "Qi Fruit"],
  // 收集物
  ["collect", "morel", "羊肚菌", "Morel"], ["collect", "salmonberry", "美洲大树莓", "Salmonberry"],
  // 钓鱼
  ["fish", "slimejack", "史莱姆鱼", "Slimejack"], ["fish", "radioactive-carp", "放射性鲤鱼", "Radioactive Carp"], ["fish", "goby", "虾虎鱼", "Goby"],
  // 采矿（矿物/资源）
  ["minerals", "celestine", "天青石", "Celestine"], ["minerals", "malachite", "孔雀石", "Malachite"],
  ["minerals", "ghost-crystal", "幽灵水晶", "Ghost Crystal"], ["minerals", "calcite", "方解石", "Calcite"],
  ["minerals", "fluorapatite", "氟磷灰石", "Fluorapatite"], ["minerals", "mudstone", "泥石", "Mudstone"],
  ["minerals", "soapstone", "皂石", "Soapstone"], ["minerals", "jasper", "碧玉", "Jasper"],
  ["minerals", "kyanite", "蓝晶石", "Kyanite"], ["minerals", "hematite", "赤铁矿", "Hematite"],
  ["minerals", "baryte", "重晶石", "Baryte"], ["minerals", "orpiment", "雌黄", "Orpiment"],
  ["minerals", "pyrite", "黄铁矿", "Pyrite"], ["minerals", "hardwood", "硬木", "Hardwood"],
  ["minerals", "stone", "石头", "Stone"], ["minerals", "fiber", "纤维", "Fiber"],
  ["minerals", "moss", "苔藓", "Moss"], ["minerals", "bone-fragment", "骨头碎片", "Bone Fragment"],
  ["minerals", "refined-quartz", "精炼石英", "Refined Quartz"],
  // 战斗
  ["monsters", "truffle-crab", "松露蟹", "Truffle Crab"], ["monsters", "magma-duggy", "熔岩掘地虫", "Magma Duggy"],
  ["monsters", "royal-serpent", "皇家飞蛇", "Royal Serpent"], ["monsters", "dwarvish-sentry", "矮人哨兵", "Dwarvish Sentry"],
  ["monsters", "stone-golem", "石魔", "Stone Golem"], ["monsters", "spider", "蜘蛛", "Spider"],
  ["monsters", "blue-squid", "蓝鱿鱼", "Blue Squid"], ["monsters", "squid-kid", "鱿鱼娃", "Squid Kid"],
  ["monsters", "skeleton-mage", "骷髅法师", "Skeleton Mage"], ["monsters", "iridium-golem", "铱石魔", "Iridium Golem"],
  ["monsters", "false-magma-cap", "假熔岩菇", "False Magma Cap"],
  // NPC
  ["npc", "linus", "莱纳斯", "Linus"], ["npc", "morris", "莫里斯", "Morris"], ["npc", "dwarf", "矮人", "Dwarf"],
  ["npc", "grandpa", "爷爷", "Grandpa"], ["npc", "junimo", "祝尼魔", "Junimo"], ["npc", "leo", "雷欧", "Leo"],
  ["npc", "qi", "齐先生", "Mr. Qi"],
  // 节日
  ["festivals", "desert-festival", "沙漠节", "Desert Festival"], ["festivals", "trout-derby", "鳟鱼大赛", "Trout Derby"],
  ["festivals", "squid-fest", "鱿鱼节", "SquidFest"], ["festivals", "night-market", "夜市", "Night Market"],
];

async function getWt(title) {
  const j = await q(base + "action=query&titles=" + encodeURIComponent(title) + "&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2&redirects=1");
  const p = (j.query.pages || [])[0];
  return p && !p.missing && p.revisions ? p.revisions[0].slots.main.content : null;
}

function field(wt, name) {
  const m = wt.match(new RegExp("^\\|\\s*" + name + "\\s*=\\s*([^|\\n]+)", "m"));
  return m ? m[1].trim() : null;
}

(async () => {
  const out = {};
  for (const [mod, id, zh, eng] of NEW) {
    let wt;
    try { wt = await getWt(zh); } catch (e) { console.log("抓取失败:", zh, e.message); continue; }
    if (!wt) { console.log("❌ 页面缺失:", zh, "(" + eng + ")"); continue; }
    const rec = { eng, zh };
    if (mod === "crops") {
      rec.growth = field(wt, "growth");
      rec.season = field(wt, "season");
      rec.sellprice = field(wt, "sellprice");
      const seed = field(wt, "seed");
      rec.seedLink = seed;
      // 抓种子页价格
      if (seed) {
        const seedTitle = (seed.match(/\[\[([^\]|]+)/) || [])[1] || seed;
        const swt = await getWt(seedTitle.replace(/^File:/, ""));
        if (swt) rec.seedprice = field(swt, "price") || field(swt, "sellprice");
      }
    } else if (mod === "collect" || mod === "minerals") {
      rec.sellprice = field(wt, "sellprice");
    } else if (mod === "fish") {
      rec.sellprice = field(wt, "sellprice");
    } else if (mod === "monsters") {
      rec.hp = field(wt, "hp");
      rec.dmg = field(wt, "dmg");
    } else if (mod === "npc") {
      rec.birthday = field(wt, "birthday");
      const fav = field(wt, "favorites");
      rec.favorites = fav ? fav.replace(/{{name\|/g, "").replace(/\}\}/g, "").split(/[\n}]/).map((s) => s.trim()).filter(Boolean).slice(0, 6).join("、") : null;
    } else if (mod === "festivals") {
      const j2 = await q(base + "action=query&titles=" + encodeURIComponent(zh) + "&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2");
      // 节日日期在正文里，取正文第一段含"日"的句子
    }
    (out[mod] ||= {})[id] = rec;
    console.log("✓", mod, zh, JSON.stringify(rec));
  }
  fs.writeFileSync("D:/deepseek/game-guide/_newdata.json", JSON.stringify(out, null, 1), "utf8");
  console.log("\n已保存 _newdata.json");
})();
