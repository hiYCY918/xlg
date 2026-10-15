/* 贴图下载（走 headless Chrome）
 *
 * 为什么重写：2026-10-15 起两个 Wiki 主机都上了 Cloudflare，`download-images.ps1` 用的
 * `Invoke-RestMethod` 一律拿到 403 挑战页——它在每次部署时打印 12 行红色失败、退出码 1，
 * 而 deploy.ps1 并不检查它，于是「贴图下载」这条路等于断了却没人当回事。
 *
 * **映射表仍以 scripts/download-images.ps1 的 $items 为唯一来源**（本脚本只解析它，不另存一份，
 * 避免两处映射各改一半）。取数走 test/wiki-fetch.js，图片同样要在页面内转 base64 才带得出来。
 *
 * 用法：
 *   node scripts/fetch-images.js           # 只补缺失的
 *   node scripts/fetch-images.js --all     # 全部重下（覆盖已有）
 *   node scripts/fetch-images.js --check   # 只报告缺哪些，不下载
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { fetchJson, fetchBinary, closeBrowser, stats } = require("../test/wiki-fetch.js");

const ROOT = path.join(__dirname, "..");
const IMG = path.join(ROOT, "img");
const MAP_PS1 = path.join(__dirname, "download-images.ps1");
const API = "https://stardewvalleywiki.com/mediawiki/api.php";   /* 图片在共享库上，走英文站接口 */
const ALL = process.argv.indexOf("--all") >= 0;
const CHECK_ONLY = process.argv.indexOf("--check") >= 0;

/* 从 PowerShell 映射表里解析 id → Wiki 文件名（唯一来源，不复制） */
function readMap() {
  const src = fs.readFileSync(MAP_PS1, "utf8");
  const map = new Map();
  for (const m of src.matchAll(/"([a-z0-9-]+)"\s*=\s*"([^"]+\.png)"/g)) map.set(m[1], m[2]);
  return map;
}

/* 批量取图片直链（MediaWiki 的 titles 单次上限 50） */
async function resolveUrls(files) {
  const out = new Map();
  for (let i = 0; i < files.length; i += 50) {
    const batch = files.slice(i, i + 50);
    const url = API + "?action=query&titles=" +
      encodeURIComponent(batch.map((f) => "File:" + f).join("|")) +
      "&prop=imageinfo&iiprop=url&format=json&formatversion=2&redirects=1";
    const j = await fetchJson(url);
    for (const p of (j.query && j.query.pages) || []) {
      if (p.imageinfo && p.imageinfo[0]) {
        out.set(String(p.title).replace(/^File:/, "").replace(/ /g, "_"), p.imageinfo[0].url);
      }
    }
  }
  return out;
}

/* R83：像素素材落库前要能看出「原尺寸 → 比例 → 目标尺寸」，否则缩成 1×1 也没人发现 */
function reportSize(id, buf) {
  if (buf.length < 24 || buf.slice(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    return { ok: false, why: "不是 PNG（多半又拿到挑战页了）" };
  }
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  /* 站点在用的三档图标位：48（普通）、96（建筑截图）、128（NPC 立绘） */
  const slot = w <= 48 ? 48 : (w <= 96 ? 96 : 128);
  const ratio = slot / w;
  return { ok: true, w, h, slot, ratio };
}

(async () => {
  const map = readMap();
  const ids = [...map.keys()];
  const missing = ids.filter((id) => !fs.existsSync(path.join(IMG, id + ".png")));
  const todo = ALL ? ids : missing;
  const onDisk = fs.readdirSync(IMG).filter((f) => f.endsWith(".png")).length;

  console.log("映射表 " + ids.length + " 条；映射覆盖的已入库 " + (ids.length - missing.length) +
    " 张；缺 " + missing.length + " 张" + (missing.length ? "（" + missing.slice(0, 8).join(",") + (missing.length > 8 ? " …" : "") + "）" : ""));
  /* 这两句必须分开说：映射表**不是** img/ 的全部来源——料理/打造等模块的贴图是早先按别的方式入库的，
   * 只报「贴图齐全」会让人以为整个目录都受这张表管。 */
  console.log("  （img/ 目录共 " + onDisk + " 张；映射表之外的 " + (onDisk - (ids.length - missing.length)) +
    " 张是历史入库的，本脚本不管）");
  if (CHECK_ONLY) {
    console.log(missing.length ? "\n[!] 映射表内有缺图，跑 node scripts/fetch-images.js 补齐" : "\n[OK] 映射表内无缺图");
    process.exit(missing.length ? 1 : 0);
  }
  if (!todo.length) { console.log("没有要下载的。"); process.exit(0); }

  /* 只解析待下载那部分的直链 */
  const files = todo.map((id) => map.get(id)).filter(Boolean);
  const urls = await resolveUrls(files);
  console.log("解析到 " + urls.size + " / " + files.length + " 个图片地址\n");

  let ok = 0;
  const fails = [];
  const warnings = [];
  for (const id of todo) {
    const file = map.get(id);
    const url = urls.get(file) || urls.get(file.replace(/_/g, " "));
    if (!url) { fails.push(id + "(无直链：" + file + ")"); continue; }
    try {
      const buf = await fetchBinary(url);
      const r = reportSize(id, buf);
      if (!r.ok) { fails.push(id + "(" + r.why + ")"); continue; }
      fs.writeFileSync(path.join(IMG, id + ".png"), buf);
      ok++;
      const line = "  " + id.padEnd(20) + r.w + "x" + r.h + " → " + r.slot + "px 位（比例 " +
        r.ratio.toFixed(3) + "x）" + (Number.isInteger(r.ratio) ? " 整数倍 ✓" : " **非整数倍，需人工确认**");
      console.log(line);
      if (!Number.isInteger(r.ratio)) warnings.push(id + " " + r.w + "x" + r.h);
    } catch (e) {
      fails.push(id + "(" + e.message.slice(0, 40) + ")");
    }
  }

  console.log("\n完成：" + ok + " 张写入，失败 " + fails.length + " 张");
  if (warnings.length) {
    console.log("⚠ 非整数倍缩放的 " + warnings.length + " 张（R83：像素画会糊，需人工确认是否换图源）：");
    warnings.slice(0, 10).forEach((w) => console.log("   " + w));
  }
  if (fails.length) { console.log("失败项：" + fails.slice(0, 10).join(", ")); }
  console.log("取数路径：" + JSON.stringify(stats));
  await closeBrowser();
  process.exit(fails.length ? 1 : 0);
})();
