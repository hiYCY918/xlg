#!/usr/bin/env node
/**
 * 抓「内容区背景」的源图（游戏地点截图），存到 .bgraw/ 供 make-bg.py 加工。
 *
 * 为什么不直接放仓库：31 张原图合计 11.7 MB，而且 `img/` 是会被发布到站点的目录
 * （CI 里 `cp -r img dist/`），原图放进去等于平白多推 11.7 MB 给每个访客。
 * 所以原图只做**本地缓存**，进仓库的是加工后的 img/bg/*.jpg（每张 6~19 KB）。
 *
 * 为什么要单独一步：两个 Wiki 主机都上了 Cloudflare，直连一律 403，
 * 必须走 test/wiki-fetch.js 的无头 Chrome（与 fetch-images.js 同一套）。
 *
 * 用法：
 *   node scripts/fetch-bg-raw.js            # 只抓 bg-map.json 用到的那几张
 *   node scripts/fetch-bg-raw.js --all      # 抓 download-images.ps1 里全部 31 张地点图
 *   node scripts/fetch-bg-raw.js --check    # 只报告缺哪几张，不下载
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { fetchJson, fetchBinary, closeBrowser, stats } = require("../test/wiki-fetch.js");

const ROOT = path.join(__dirname, "..");
const RAW_DIR = path.join(ROOT, ".bgraw");
const MAP_PS1 = path.join(__dirname, "download-images.ps1");
const BG_MAP = path.join(__dirname, "bg-map.json");
const API = "https://stardewvalleywiki.com/mediawiki/api.php";   /* 图片在共享库上，走英文站接口 */

/* download-images.ps1 的 $items 是文件名映射的唯一来源（与 fetch-images.js 同一口径） */
function readImageMap() {
  const src = fs.readFileSync(MAP_PS1, "utf8");
  const map = new Map();
  for (const m of src.matchAll(/"([a-z0-9-]+)"\s*=\s*"([^"]+\.(?:png|jpe?g))"/gi)) map.set(m[1], m[2]);
  return map;
}
/* 找缓存里已有的原图（扩展名可能是 png 或 jpg） */
function findRaw(name) {
  for (const ext of [".png", ".jpg", ".jpeg"]) {
    const p = path.join(RAW_DIR, name + ext);
    if (fs.existsSync(p) && fs.statSync(p).size > 1000) return p;
  }
  return null;
}
async function resolveUrls(files) {
  const out = new Map();
  for (let i = 0; i < files.length; i += 50) {
    const batch = files.slice(i, i + 50);
    const j = await fetchJson(API + "?action=query&titles=" +
      encodeURIComponent(batch.map((f) => "File:" + f).join("|")) +
      "&prop=imageinfo&iiprop=url&format=json&formatversion=2&redirects=1");
    for (const p of (j.query && j.query.pages) || []) {
      if (p.imageinfo && p.imageinfo[0]) {
        const t = String(p.title).replace(/^File:/, "");
        /* 空格与下划线两种写法都存，否则带空格的图名会查不到（fetch-images.js 踩过一次） */
        out.set(t, p.imageinfo[0].url);
        out.set(t.replace(/ /g, "_"), p.imageinfo[0].url);
        out.set(t.replace(/_/g, " "), p.imageinfo[0].url);
      }
    }
  }
  return out;
}

(async () => {
  const ALL = process.argv.indexOf("--all") >= 0;
  const CHECK_ONLY = process.argv.indexOf("--check") >= 0;
  const imageMap = readImageMap();
  const bgMap = JSON.parse(fs.readFileSync(BG_MAP, "utf8"));

  /* 需要的源图：背景映射用到的；--all 时算上全部地点图（download-images.ps1 里名字带连字符的那批） */
  const needed = ALL
    ? [...imageMap.keys()].filter((k) => /^[a-z]+(-[a-z]+)*$/.test(k) && imageMap.get(k).length > 0)
    : [...new Set(bgMap.modules.map((m) => m.source))];

  const missing = needed.filter((n) => !findRaw(n));
  console.log("需要的源图 " + needed.length + " 张；本地已有 " + (needed.length - missing.length) + " 张" +
    (missing.length ? "，缺 " + missing.length + " 张：" + missing.join("、") : "（无缺失）"));
  if (CHECK_ONLY) return;

  if (!missing.length) { console.log("无需下载。"); return; }
  fs.mkdirSync(RAW_DIR, { recursive: true });

  const files = missing.map((n) => imageMap.get(n)).filter(Boolean);
  const unknown = missing.filter((n) => !imageMap.has(n));
  if (unknown.length) { console.error("映射表里没有这些名字：" + unknown.join("、")); process.exitCode = 1; }
  const urls = await resolveUrls(files);

  let ok = 0, bad = [];
  for (const name of missing) {
    const file = imageMap.get(name);
    if (!file) continue;
    const url = urls.get(file) || urls.get(file.replace(/ /g, "_")) || urls.get(file.replace(/_/g, " "));
    if (!url) { bad.push(name + "（解析不到直链）"); continue; }
    try {
      const buf = await fetchBinary(url);
      const ext = /\.jpe?g$/i.test(url) ? ".jpg" : ".png";
      fs.writeFileSync(path.join(RAW_DIR, name + ext), buf);
      console.log("  ✓ " + name.padEnd(22) + Math.round(buf.length / 1024) + " KB");
      ok++;
    } catch (e) {
      bad.push(name + "（" + e.message + "）");
    }
  }
  console.log("完成：成功 " + ok + " 张" + (bad.length ? "，失败 " + bad.length + " 张：" + bad.join("、") : ""));
  console.log("取数健康：" + stats());
  if (bad.length) process.exitCode = 1;
  await closeBrowser();
})();
