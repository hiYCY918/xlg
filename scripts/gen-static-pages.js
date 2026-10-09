/* 静态页生成器（预渲染试点，第三十轮）
 *
 * 背景与决策依据见 docs/ROADMAP.md 第五节：实测整页快照 982 KB/页（964 页 ≈ 924 MB）不可行，
 * 而**只取详情片段只有 1.5~2.6 KB/条**；真正的成本在「渲染层要能输出可爬的真链接」——
 * 渲染结果里 `<a href>` 是 0 个，564 处交叉引用全靠 data-goto-* 交给 JS 委托，
 * 所以静态快照对爬虫等于没有链接图。
 *
 * 本脚本的做法：**复用站点自己的渲染函数**（DETAIL_RENDERERS，与页面所见完全同源，
 * 不另写一套模板），在 Node 里用最小 DOM 模拟加载 main.js，然后：
 *   1. 取某模块每条目的详情 HTML
 *   2. 把 JS 驱动的 chip（data-goto-*）**转成真 `<a href>`**（这是本脚本存在的核心理由）
 *   3. 套上带 title / description / canonical / OG 的外壳，落盘到 static/<模块>/
 * 顺带由它生成 sitemap.xml——站点地图是"内容清单"，手写必然与内容脱节。
 *
 * 为什么先只做一个模块（试点）：真正的未知数不是"能不能生成"，而是"搜索引擎收不收、来不来量"。
 * 先拿一个模块验证，再决定是否铺开（见 ROADMAP 的方案 D）。
 *
 * 用法：
 *   node scripts/gen-static-pages.js            # 生成
 *   node scripts/gen-static-pages.js --check    # 只校验产物是否与数据同步（CI 用，不写盘）
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "static");
const SITE = "https://hiycy918.github.io/xlg/";
/* 试点模块：钓鱼。理由——「传说之鱼怎么钓」这类长尾查询正是攻略站的主场。 */
const PILOT_MODULES = ["fishing"];
const CHECK_ONLY = process.argv.indexOf("--check") >= 0;

/* ---------- 最小 DOM 模拟 ----------
 * 只够把 main.js 加载进来并调用它的渲染函数：DOMContentLoaded 永不触发，
 * 初始化整段不执行，因此不需要布局/事件/存储的真实行为。
 * （test/check.js 那套完整模拟是为了**交互**断言，这里用不上，也不该复制它。） */
function makeElement(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    children: [], attributes: {},
    setAttribute(k, v) { this.attributes[k] = v; },
    getAttribute(k) { return this.attributes[k]; },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener() {}, removeEventListener() {},
    querySelector: () => null, querySelectorAll: () => [],
    closest: () => null, remove() {}, focus() {},
  };
  return el;
}
const documentMock = {
  addEventListener() {},
  createElement: makeElement,
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  body: makeElement("body"),
  documentElement: makeElement("html"),
};
globalThis.document = documentMock;
globalThis.window = { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.location = { hash: "", href: SITE, pathname: "/xlg/" };
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(String(k)) ? store.get(String(k)) : null),
  setItem: (k, v) => store.set(String(k), String(v)),
  removeItem: (k) => store.delete(String(k)),
  clear: () => store.clear(),
};

/* ---------- 加载站点代码 ---------- */
const src =
  fs.readFileSync(path.join(ROOT, "js/data.js"), "utf8") + "\n" +
  fs.readFileSync(path.join(ROOT, "js/icons.js"), "utf8") + "\n" +
  fs.readFileSync(path.join(ROOT, "js/main.js"), "utf8") + "\n" +
  "; return {REGISTRY,MODULE_DATA,MODULES,DETAIL_RENDERERS,esc};";

let api;
try {
  api = new Function(src)();
} catch (e) {
  console.error("站点代码加载失败：" + e.message);
  process.exit(1);
}
const { REGISTRY, MODULE_DATA, MODULES, DETAIL_RENDERERS, esc } = api;

/* 样式版本号跟 index.html 走：两处不一致会让静态页与新样式的缓存行为分叉 */
const cssVersion = (() => {
  const m = /style\.css\?v=(\d+)/.exec(fs.readFileSync(path.join(ROOT, "index.html"), "utf8"));
  return m ? m[1] : "1";
})();

/* ---------- 工具 ---------- */
const stripTags = (html) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/* 按**码点**截断。用 String.slice 会在代理对中间下刀，切出孤立代理——
 * 写盘时被替换成 U+FFFD，于是"内存里的内容"与"盘上的内容"永远不相等，
 * `--check` 会天天报同一个文件漂移，而文件看起来又没错（本项目真实踩过：
 * 沙丁鱼的描述正好在第 110 个码点处切到了 emoji）。 */
const clip = (s, n) => (Array.from(String(s)).slice(0, n).join(""));

/* 详情片段 → 静态页正文：修正相对路径 + 把 JS chip 换成真链接。
 * 这是整件事的关键一步：不转的话爬虫在页面里找不到任何可跟随的链接。 */
function toStaticBody(frag, moduleId, itemId) {
  let html = frag;
  /* 1) 图片/资源改成本页相对根目录的路径（页面在 static/<模块>/ 下，退两级） */
  html = html.replace(/(src|href)="(?!https?:|\/\/|#|\.\.\/)([^"]+)"/g, (m, attr, url) => `${attr}="../../${url}"`);
  /* 2) chip → <a>。渲染层产出的是 <span class="chip chip-link" data-goto-module data-goto-id role tabindex title>，
   *    换成 a 之后样式不变（.chip-link 本就是链接外观），但爬虫能跟。 */
  html = html.replace(/<span class="chip chip-link"([^>]*)>([^<]*)<\/span>/g, (m, attrs, text) => {
    const mod = /data-goto-module="([^"]*)"/.exec(attrs);
    const id = /data-goto-id="([^"]*)"/.exec(attrs);
    const title = /title="([^"]*)"/.exec(attrs);
    if (!mod || !id) return m;
    const t = title ? ` title="${title[1]}"` : "";
    /* 目标页只在已生成的模块里存在；否则回落到完整攻略站的深链接（仍是可用链接，不是死链） */
    const target = generated.has(mod[1] + "/" + id[1])
      ? `../../${mod[1]}/${id[1]}.html`
      : `../../index.html#${mod[1]}/${id[1]}`;
    return `<a class="chip chip-link" href="${target}"${t}>${text}</a>`;
  });
  /* 3) 详情片段自带 role/tabindex 等交互语义，静态页里没有意义，留着反而误导读屏 */
  html = html.replace(/\s(role="button"|tabindex="\d+")/g, "");
  return html;
}

function pageShell(opts) {
  const { title, desc, canonical, body, crumb, spaHash } = opts;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${canonical}" />
<link rel="icon" href="../../favicon.ico" sizes="any" />
<link rel="apple-touch-icon" href="../../apple-touch-icon.png" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="星露谷物语 · 攻略站" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${SITE}og-cover.png" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="stylesheet" href="../../css/style.css?v=${cssVersion}" />
</head>
<body>
<header class="static-head">
  <a class="static-brand" href="../../index.html">星露谷物语 · 攻略站</a>
  <nav class="static-crumb" aria-label="面包屑">${crumb}</nav>
</header>
<main class="static-main">
${body}
  <p class="static-back"><a href="../../index.html#${spaHash}">在完整攻略站中打开（搜索 / 筛选 / 记录进度）→</a></p>
</main>
<footer class="footer">
  <p>本站为<strong>非官方粉丝攻略</strong>，与 ConcernedApe 无隶属关系；游戏素材、名称与数据的版权归 <strong>ConcernedApe</strong> 所有（Stardew Valley © ConcernedApe）</p>
  <p>攻略数据对应游戏版本 <strong>1.6</strong> · 欢迎在 <code>js/data.js</code> 中补充修改</p>
</footer>
</body>
</html>
`;
}

/* ---------- 生成 ---------- */
const generated = new Set();
const pages = [];   // { rel, content }
const urls = [];    // sitemap 条目

for (const moduleId of PILOT_MODULES) {
  const sec = REGISTRY.find((s) => s.id === moduleId);
  if (!sec) { console.error("模块不存在：" + moduleId); process.exit(1); }
  const items = MODULE_DATA[sec.dataRef] || [];
  for (const it of items) generated.add(moduleId + "/" + it.id);
}

for (const moduleId of PILOT_MODULES) {
  const sec = REGISTRY.find((s) => s.id === moduleId);
  const items = MODULE_DATA[sec.dataRef] || [];
  const modLabel = sec.label;

  /* 模块索引页 */
  const listHtml = items.map((it) => {
    const note = it.note || it.source || "";
    return `    <li><a href="./${it.id}.html">${esc(it.name)}</a>` +
      (note ? ` <span class="muted">${esc(clip(note, 40))}</span>` : "") + `</li>`;
  }).join("\n");
  const modDesc = `星露谷物语「${modLabel}」全部 ${items.length} 条的详细数据速查：` +
    items.slice(0, 8).map((x) => x.name).join("、") + " 等。";
  pages.push({
    rel: `${moduleId}/index.html`,
    content: pageShell({
      title: `${modLabel} · 全部 ${items.length} 条数据 · 星露谷物语攻略站`,
      desc: modDesc,
      canonical: `${SITE}${moduleId}/`,
      crumb: `<span>${esc(modLabel)}</span>`,
      spaHash: moduleId,
      body: `  <h1 class="static-title">${esc(modLabel)}</h1>
  <p class="static-lead">共 ${items.length} 条。下面是全部条目，点进去看完整数据。</p>
  <ul class="static-list">
${listHtml}
  </ul>`,
    }),
  });
  urls.push({ loc: `${SITE}${moduleId}/` });

  /* 条目页 */
  for (const it of items) {
    let frag;
    try {
      frag = String(DETAIL_RENDERERS[moduleId](it.id));
    } catch (e) {
      console.error(`渲染失败 ${moduleId}/${it.id}：${e.message}`);
      process.exit(1);
    }
    const body = toStaticBody(frag, moduleId, it.id);
    /* 描述取自真实渲染出来的正文（不是另写一句模板文案）：
     * 正文开头就是条目名，先把它去掉，免得 title 与 description 里同一个词出现两次。 */
    let plain = stripTags(frag);
    if (plain.indexOf(it.name) === 0) plain = plain.slice(it.name.length).trim();
    const desc = `${it.name}（${modLabel}）：${clip(plain, 110)}`;
    pages.push({
      rel: `${moduleId}/${it.id}.html`,
      content: pageShell({
        title: `${it.name} · ${modLabel} · 星露谷物语攻略站`,
        desc,
        canonical: `${SITE}${moduleId}/${it.id}.html`,
        crumb: `<a href="./index.html">${esc(modLabel)}</a> / <span>${esc(it.name)}</span>`,
        spaHash: `${moduleId}/${it.id}`,
        body: `  <article class="static-detail">\n${body}\n  </article>`,
      }),
    });
    urls.push({ loc: `${SITE}${moduleId}/${it.id}.html` });
  }
}

/* sitemap 由内容清单生成，不手写（手写必然与内容脱节）。
 * 刻意不写 <lastmod>：生成器不记日期才能保证 --check 可重复（否则每天都会"漂移"）。 */
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!-- 由 scripts/gen-static-pages.js 生成，请勿手改 -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE}</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
${urls.map((u) => `  <url>\n    <loc>${u.loc}</loc>\n  </url>`).join("\n")}
</urlset>
`;
pages.push({ rel: "../sitemap.xml", content: sitemap, isSitemap: true });

/* ---------- 写盘 / 校验 ---------- */
let written = 0;
const drift = [];
for (const p of pages) {
  const full = path.join(OUT_DIR, p.rel);
  const old = fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null;
  if (CHECK_ONLY) {
    if (old !== p.content) drift.push(p.isSitemap ? "sitemap.xml" : "static/" + p.rel);
    continue;
  }
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, p.content);
  written++;
}

/* 生成器不再产出的旧文件要清掉（否则删掉一个条目后，静态页会留在站上成为孤儿） */
if (!CHECK_ONLY && fs.existsSync(OUT_DIR)) {
  const expected = new Set(pages.filter((p) => !p.isSitemap).map((p) => p.rel.replace(/\\/g, "/")));
  for (const moduleId of fs.readdirSync(OUT_DIR)) {
    const dir = path.join(OUT_DIR, moduleId);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!expected.has(moduleId + "/" + f)) {
        fs.unlinkSync(path.join(dir, f));
        console.log("  清理孤儿页 " + moduleId + "/" + f);
      }
    }
  }
}

if (CHECK_ONLY) {
  if (drift.length) {
    console.error("静态页与数据不同步（" + drift.length + " 个文件）：" + drift.slice(0, 8).join(", "));
    console.error("请运行 node scripts/gen-static-pages.js 重新生成并提交。");
    process.exit(1);
  }
  console.log("静态页与数据同步（" + pages.length + " 个文件）");
} else {
  console.log("生成 " + written + " 个文件（" + PILOT_MODULES.join(",") + "，" +
    pages.length + " 个含 sitemap）");
  console.log("  static/<模块>/… 条目页 " + (pages.length - PILOT_MODULES.length - 1) +
    " 个 + 模块页 " + PILOT_MODULES.length + " 个；sitemap " + (urls.length + 1) + " 条 URL");
}
