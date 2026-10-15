/* ============================================================
 * 攻略完备性审计（需要网络）
 * 用法：node test/audit-completeness.js
 *
 * 与 verify-wiki.js 的分工：
 *   verify-wiki.js       —— 存在性：我们收录的条目是否真实存在（防编造）
 *   audit-completeness.js —— 完备性：游戏里有的内容我们是否漏收（防遗漏）
 *
 * 口径：以中文星露谷 Wiki 的分类成员为「全集」，与 data.js 做双向差集。
 * 输出：
 *   ① 逐模块完备度表（本站 / Wiki 全集 / 缺口）
 *   ② 缺口明细（已排除分类页与跨模块重复项）
 *   ③ 整块未覆盖的游戏系统
 *   ④ **取数健康检查**（末尾）—— 结论行必须由它背书
 *
 * 取数走 test/wiki-fetch.js：直连被 Cloudflare 挡时自动落到 headless Chrome。
 *
 * ⚠️ 反向验证（改这段代码后必做一次，确认审计真的会报红而不是报「完整」）：
 *     WIKI_API=https://zh.stardewvalleywiki.com/mediawiki/index.php node test/audit-completeness.js
 *   预期：3 秒内以「已有 3 个分类取数失败，提前中止」退出，**退出码 1**。
 *   2026-10-15 之前，同样的场景会打印每个模块「Wiki 0 / ✓ 完整」并汇总「缺口合计 0 项」。
 * ============================================================ */
"use strict";

const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
/* 接口地址可用环境变量覆盖：反向验证（指向一个坏地址，确认审计会报红而不是报「完整」）需要它 */
const ZH = process.env.WIKI_API || "https://zh.stardewvalleywiki.com/mediawiki/api.php";
const { fetchJson, closeBrowser, stats } = require("./wiki-fetch");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/* 归一化：去括号补充、去分隔符、统一大小写，便于跨来源匹配 */
const norm = (s) => String(s).replace(/[（(].*?[)）]/g, "").replace(/[\s·・,，、]/g, "").toLowerCase();

/* 取数失败的分类一律记下来，最后汇总成一条判据。
 *
 * 为什么必须有这个（2026-10-15）：原先 catMembers 用 `catch (e) { return []; }` 吞掉错误，
 * 于是 Wiki 被 Cloudflare 挡住时，每个模块都显示「Wiki 0 / ✓ 完整」，结论是「缺口合计 0 项」——
 * **「没抓到」被显示成了「没问题」**，而上一轮同一项是 532 条待补。
 * 这条经验在本项目已反复出现（R94 / R97）：静默失败比报错危险得多。 */
const fetchFails = [];

async function catMembers(c, type) {
  /* 连错三个就没必要再跑：要么接口地址不对、要么又被挡了。
   * 早停是为了别让一次坏掉的审计卡几十分钟——但**绝不能因此改成静默通过**。 */
  if (fetchFails.length >= 3) {
    console.error("\n[FAIL] 已有 " + fetchFails.length + " 个分类取数失败，提前中止（继续跑没有意义）：");
    fetchFails.slice(0, 3).forEach((f) => console.error("   · " + f));
    console.error("  这「不是」内容已完整，而是「根本没抓到」。");
    await closeBrowser();
    process.exit(1);
  }
  const url = ZH + "?action=query&list=categorymembers&cmtitle=" + encodeURIComponent("Category:" + c) +
    "&cmlimit=500&cmtype=" + type + "&format=json&formatversion=2";
  let j;
  try {
    j = await fetchJson(url);
  } catch (e) {
    fetchFails.push("Category:" + c + " —— " + e.message.slice(0, 70));
    throw e;
  }
  if (!j || !j.query) {
    const msg = "响应里没有 query 字段（多半不是这个接口的正常返回）";
    fetchFails.push("Category:" + c + " —— " + msg);
    throw new Error(msg);
  }
  const ms = j.query.categorymembers || [];
  return type === "page" ? ms.filter((m) => m.ns === 0).map((m) => m.title)
                         : ms.map((m) => m.title.replace(/^Category:/, ""));
}

/* 把一组分类并成一个集合；单个分类失败不中断整轮审计（其余部分仍要出报告），
 * 但失败会被记进 fetchFails，最后统一判红。 */
async function bagOf(cats, type) {
  const bag = new Set();
  for (const c of cats) {
    try {
      (await catMembers(c, type)).forEach((t) => bag.add(t));
    } catch (e) { /* 已记入 fetchFails */ }
    await sleep(110);
  }
  return bag;
}

/* 各模块对应的 Wiki 分类全集（主分类 + 需并入的子分类） */
const UNIVERSE = [
  ["农作物", ["春季作物", "夏季作物", "秋季作物", "冬季作物"], [], "CROPS"],
  ["收集物", ["采集"], ["春季采集", "夏季采集", "秋季采集", "冬季采集", "岛屿采集"], "COLLECTIBLES"],
  ["钓鱼", ["鱼"], [], "FISH"],
  ["采矿", ["宝石", "资源"], ["晶球矿物"], "MINERALS"],
  ["战斗", ["怪物"], [], "MONSTERS"],
  ["NPC", ["NPC"], [], "NPCS"],
  ["节日", ["春季节日", "夏季节日", "秋季节日", "冬季节日"], [], "FESTIVALS"],
  ["种子", ["种子"], [], "SEEDS"],
  ["果树", ["果树"], [], "FRUIT_TREES"],
  ["树木", ["树"], [], "TREES"],
  ["动物", ["动物"], [], "ANIMALS"],
  ["动物制品", ["动物制品"], [], "ANIMAL_PRODUCTS"],
  ["工具", ["工具"], [], "TOOLS"],
  ["建筑", ["建筑"], [], "BUILDINGS"],
  ["武器", ["武器"], [], "WEAPONS"],
  ["戒指", ["戒指"], [], "RINGS"],
  /* 第二十八轮补：ARTISAN 一直有数据，但这个分类从未进过审计（碰巧才发现） */
  ["工匠物品", ["工匠物品"], [], "ARTISAN"],
  /* 2026-10-15 补：这两个模块同样一直没被审计过（「打造」没有可用的 Wiki 分类，见下）。 */
  ["古物", ["古物"], [], "ARTIFACTS"],
  ["料理", ["烹饪"], [], "COOKING"],
  /* 「打造」查过 Category:打造 只有 2 个页面（汇总页 + 蟹笼）——配方不在分类里，
   * 所以 CRAFTING 无法用分类全集来审计。它的完整性靠打造模块自己的断言守（材料/分类/反向索引）。 */
];

/* 分类/导航页而非内容条目，比对时排除 */
const HUB_PAGES = new Set(["鱼", "怪物", "矿石", "晶球", "采集", "矿物", "节日", "NPC",
  "古物", "资源", "种子", "工具", "建筑", "树木", "树", "果树", "动物", "武器", "戒指", "工匠物品", "打造", "地点", "资源",
  /* 2026-10-15：补上「料理」模块后，其分类汇总页「烹饪」也要排除 */
  "烹饪",
  /* 2026-10-15：肥料分类里剩的「肥料」是汇总页（具体 11 种肥料早已在「打造」里），不是缺口 */
  "肥料"].map(norm));

/* 有意不收录：经核对后判定不属于对应模块范围。明确记录，避免每次审计重复排查。 */
const EXCLUDED = new Map(Object.entries({
  "咖啡豆": "同一物品已由「农作物」收录——它既是种子又是作物，重复收录会让名称索引产生二义（R53/R57）",
  "杂草": "农场杂物、不可出售，不是采集物",
  "草": "需用草籽种植，属作物类",
  "树液": "砍树的副产品，不是野外采集物",
  "史莱姆（怪物）": "Wiki 的消歧义页，不是独立怪物",
  "孩子": "泛指分类，不是具体 NPC",
  "居民": "泛指分类，不是具体 NPC",
  "大圆木": "可砍伐的资源节点，不是树本身（属「树木」分类但不产出种子/树液）",
  "大树桩": "可砍伐的资源节点，不是树本身（同上）",
  "鸭子": "重定向页（#重定向 → 鸭），不是独立动物",
  "加工动物制品的收益": "攻略页而非物品",
  /* 工匠物品分类里的"生产力"页：讲的是收益计算公式，不是物品 */
  "小桶生产力": "攻略页而非物品", "小桶生产力 - 农耕人": "同上", "小桶生产力 - 工匠": "同上",
  "罐头瓶生产力": "攻略页而非物品", "罐头瓶生产力 - 农耕人": "同上", "罐头瓶生产力 - 工匠": "同上",
  "矿石": "汇总页而非具体资源",
  "蟹笼": "已由「工匠制品」收录（R53 已有模块优先）",
  "鸵鸟孵化器": "已由「打造」收录（R53 已有模块优先）",
  "社区中心": "名字已由「任务」收录（id=community），站内名字不能重复（R53/R57）",
  "爆炸弹丸": "是弹弓的弹药而非武器，且名字已由「打造」收录（R53）",
  "镰刀": "已由「工具」收录（R53 已有模块优先）",
  "金色的镰刀": "同上",
  "铱镰刀": "同上",
  "战士戒指": "可打造的戒指，已由「打造」收录（那边有配方与材料）",
  "由巴的戒指": "同上",
  "结实戒指": "同上",
  "荆棘戒指": "同上",
  "铱环": "同上",
  "辉石戒指": "同上",
}));

/* 整块系统盘点：**只列本站还没有对应模块的系统**（已收录的从本表移除，
 * 否则报告会永远显示「本站均无对应模块」，与事实不符）。 */
/* 整块未覆盖的游戏系统：全部收录完毕。
 * 保留空数组而不是删掉这个机制 —— 将来发现新的整块系统（如"技能""成就"）时直接往里加即可。 */
/* 观察清单：这些分类**没有对应的数据模块**，或只有一部分有落点。
 * 第二十八轮系统性排查过一次（此前只碰巧发现过「工匠物品」）——写进代码里，
 * 让"还差什么"每次审计都自动报出来，而不是依赖某次会话的记忆。
 * 只报告、不断言：它们是**待办内容**，不是缺陷（未收录不等于错误）。 */
const WATCH_CATS = [
  ["家具", "整块未覆盖"],
  ["帽子", "整块未覆盖"],
  ["成就", "整块未覆盖"],
  ["技能", "整块未覆盖"],
  ["秘密", "整块未覆盖"],
  ["地点", "部分覆盖（地名与区域）"],
  /* 2026-10-15 移出清单：肥料 与 鱼饵 已经收干净了
   * ——「针对性鱼饵」补进工匠制品；肥料那 11 种一直在「打造」里，只剩汇总页，已进 HUB_PAGES。
   * 清单里留着已覆盖的分类，会让报告永远挂着一条不存在的问题。 */
];

const SYSTEMS = [];

(async () => {
  /* ⚠️ 这里的数组清单**必须覆盖全部有名字的模块**，否则那个模块的物品不计入 ALL_NAMES，
   * 于是「站内明明有」也会被报成缺口。
   * 2026-10-15 发现：原先漏了 CRAFTING / COOKING / ARTIFACTS 三个——
   * 「肥料 11 条」里有 10 条、「鱼饵 8 条」里有 7 条其实早就以打造配方的形式在站内，
   * 却年年被报成「整块未覆盖」。待补总数因此被灌水（修正后见输出）。
   * 判据：往 REGISTRY 里加了模块，这里和下面的 UNIVERSE 都要同步——否则审计会**安静地多报**。 */
  const data = new Function(
    fs.readFileSync(path.join(root, "js/data.js"), "utf8") +
    "; return {CROPS,COLLECTIBLES,FISH,MINERALS,MONSTERS,QUESTS,NPCS,FESTIVALS,EVENTS,SEEDS,FRUIT_TREES,TREES,ANIMALS,ANIMAL_PRODUCTS,TOOLS,BUILDINGS,WEAPONS,RINGS,ARTISAN,CRAFTING,COOKING,ARTIFACTS};"
  )();

  /* 跨全部模块的全局名称集合：同一物品出现在多个模块不算缺失 */
  const ALL_NAMES = new Set();
  Object.values(data).forEach((arr) => arr.forEach((x) => ALL_NAMES.add(norm(x.name))));

  console.log("=== 逐模块完备度（对照中文 Wiki 分类全集） ===");
  console.log("模块      本站   Wiki   缺口");
  const results = [];
  for (const [label, mainCats, subCats, key] of UNIVERSE) {
    const bag = new Set();
    (await bagOf(mainCats, "page")).forEach((t) => bag.add(t));
    (await bagOf(subCats, "page")).forEach((t) => bag.add(t));

    const missing = [];
    const excluded = [];
    for (const t of bag) {
      if (HUB_PAGES.has(norm(t))) continue;
      if (EXCLUDED.has(t)) { excluded.push(t); continue; }
      if (ALL_NAMES.has(norm(t))) continue;
      missing.push(t);
    }
    results.push({ label, mine: data[key].length, wiki: bag.size, missing, excluded });
    console.log(
      label.padEnd(8) + String(data[key].length).padStart(4) + String(bag.size).padStart(7) +
      String(missing.length).padStart(6) +
      (missing.length === 0 ? "   ✓ 完整" + (excluded.length ? "（另有意排除 " + excluded.length + " 项）" : "") : "")
    );
  }

  console.log("\n=== 缺口明细（已排除分类页与跨模块重复项） ===");
  let totalGap = 0;
  for (const r of results) {
    if (!r.missing.length) continue;
    totalGap += r.missing.length;
    console.log("\n【" + r.label + "】缺 " + r.missing.length + " 项");
    console.log("  " + r.missing.join("、"));
  }
  console.log("\n逐模块缺口合计：" + totalGap + " 项" +
    (totalGap === 0 ? "（全部模块已对齐 Wiki 全集）" : ""));

  const exclTotal = results.reduce((n, r) => n + (r.excluded ? r.excluded.length : 0), 0);
  if (exclTotal) {
    console.log("\n=== 有意排除（已核对，不属于对应模块范围） ===");
    for (const r of results) {
      if (!r.excluded || !r.excluded.length) continue;
      r.excluded.forEach((t) => console.log("  " + r.label + " · " + t + " —— " + EXCLUDED.get(t)));
    }
  }

  console.log("\n=== 整块未覆盖的游戏系统 ===");
  let sysTotal = 0;
  for (const [c, label] of SYSTEMS) {
    let pages = null;
    let subs = [];
    try {
      pages = await catMembers(c, "page");
      subs = await catMembers(c, "subcat");
    } catch (e) { console.log("  " + label.padEnd(30) + "✗ 取数失败（已记入健康检查）"); continue; }
    if (!pages.length) { console.log("  " + label.padEnd(30) + "（分类「" + c + "」确实为空，跳过）"); continue; }
    sysTotal += pages.length;
    console.log("  " + label.padEnd(30) + "Wiki " + String(pages.length).padStart(4) + " 条" +
      (subs.length ? "（+子分类 " + subs.length + "）" : ""));
    await sleep(110);
  }
  console.log("\n整块系统条目合计：" + sysTotal + " 项（本站均无对应模块）");
  console.log("\n=== 观察清单：未覆盖 / 部分覆盖的分类（待办内容，非缺陷） ===");
  let watchTotal = 0;
  let watchCatsOk = 0;
  {
    for (const [c, kind] of WATCH_CATS) {
      let pages = null;
      try {
        pages = await catMembers(c, "page");
      } catch (e) {
        /* 关键区别：这里以前写的是「（分类不存在，跳过）」，而真相是「没抓到」。
         * 一个词之差，读报告的人会得出完全相反的结论。 */
        console.log("  " + c.padEnd(10) + "✗ 取数失败（不是「分类不存在」，是根本没抓到）");
        continue;
      }
      if (!pages.length) { console.log("  " + c.padEnd(10) + "（分类确实为空，跳过）"); continue; }
      watchCatsOk++;
      const miss = pages.filter((n) => !ALL_NAMES.has(norm(n)) && !HUB_PAGES.has(norm(n)) && !EXCLUDED.has(n));
      watchTotal += miss.length;
      console.log("  " + c.padEnd(10) + String(miss.length).padStart(4) + " / " + String(pages.length).padEnd(4) +
        "  " + kind + (miss.length && miss.length <= 12 ? "：" + miss.join("、") : ""));
    }
    console.log("  合计待补条目：" + watchTotal + " 条");
  }

  console.log("\n提示：种子与农作物、工匠制品与农作物存在重叠，合计值有重复计数，仅用于衡量量级。");

  /* ============================================================
   * 取数健康检查 —— 本脚本最重要的一段输出
   *
   * 上面的「缺口 0 项」只有在**确实取到了数据**时才成立。2026-10-15 的教训：
   * Wiki 被 Cloudflare 挡住后，每个模块都打印「Wiki 0 / ✓ 完整」，合计「0 项」，
   * 而真相是什么都没抓到。所以结论行必须由这一段来背书。
   * ============================================================ */
  console.log("\n=== 取数健康检查 ===");
  const wikiMembers = results.reduce((n, r) => n + r.wiki, 0);
  const emptyModules = results.filter((r) => r.wiki === 0).map((r) => r.label);
  const catsQueried = UNIVERSE.reduce((n, [, m, s]) => n + m.length + s.length, 0) + SYSTEMS.length * 2 + WATCH_CATS.length;
  const catsOk = catsQueried - fetchFails.length;
  console.log("  分类请求：" + catsOk + " / " + catsQueried + " 个成功" +
    (fetchFails.length ? "，**" + fetchFails.length + " 个失败**" : ""));
  console.log("  取回成员：合计 " + wikiMembers + " 条（逐模块表里的 Wiki 列之和）");
  console.log("  观察清单：" + watchCatsOk + " / " + WATCH_CATS.length + " 个分类取到数据");
  console.log("  取数路径：直连 " + stats.fast + " 次 / 浏览器兜底 " + stats.chrome + " 次 / 失败 " + stats.failed + " 次");
  if (fetchFails.length) {
    console.log("  ✗ 失败清单（前 8 条）：");
    fetchFails.slice(0, 8).forEach((f) => console.log("      " + f));
  }

  const problems = [];
  if (fetchFails.length) problems.push(fetchFails.length + " 个分类取数失败");
  if (wikiMembers === 0) problems.push("一条 Wiki 成员都没取到");
  if (emptyModules.length) problems.push("以下模块的 Wiki 全集为 0（要么分类改过名，要么又没抓到）：" + emptyModules.join("、"));
  if (watchCatsOk === 0) problems.push("观察清单一个分类都没取到");

  await closeBrowser();
  if (problems.length) {
    console.log("\n[FAIL] 取数不健康 —— 上面所有「✓ 完整 / 缺口 0」都不可信：");
    problems.forEach((p) => console.log("   · " + p));
    console.log("  处置：先确认 Wiki 是否可达（本次走的是 headless Chrome 兜底），修好取数再重跑本审计。");
    process.exit(1);
  }
  console.log("\n[OK] 取数健康：本报告的「缺口 N 项」是在真实取到数据的前提下得出的。");
  process.exit(0);
})();
