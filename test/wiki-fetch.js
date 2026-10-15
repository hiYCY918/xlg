/* 共用取数层：查中文星露谷 Wiki 的 MediaWiki API
 *
 * 为什么需要它（2026-10-15）：两个 Wiki 主机都上了 Cloudflare，普通 fetch 一律拿到
 * 403 + 挑战页。于是 verify-wiki.js 报错、audit-completeness.js **静默报「完整」**——
 * 「抓不到」被显示成了「没问题」，比报错危险得多。
 *
 * 策略：**先试普通 fetch，被挡了才落到 headless Chrome**。
 * 不全走浏览器，是因为一次 CDP 导航比 fetch 慢一个数量级，而全量核对要发几百次请求；
 * 将来 Wiki 若撤掉拦截，快路径会自动接管，这里不用改。
 *
 * 三态区分（这是本模块存在的核心理由）：
 *   - 拿到数据      → 返回解析后的 JSON
 *   - 请求/解析失败 → **抛异常**，绝不返回空值
 *   - 数据真的是空的 → 返回 { query: { categorymembers: [] } } 这样的真实响应
 * 调用方据此能把「没抓到」和「确实没有」分开——这正是审计原本丢掉的信息。
 *
 * 用法：
 *   const { fetchJson, closeBrowser, stats } = require("./wiki-fetch");
 *   const j = await fetchJson(url);      // 失败会抛
 *   await closeBrowser();                 // 必须调用，否则 Chrome 进程留着不退出
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const UA = "StardewGuideFanSite/1.0 (https://hiycy918.github.io/xlg/; 非官方粉丝攻略站)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const stats = { fast: 0, chrome: 0, failed: 0 };

/* Cloudflare 的挑战页长得一样，识别它比识别「不是 JSON」更准确，报错也更好懂 */
const CHALLENGE = /Just a moment|Verify you are human|Checking your browser|cf-browser-verification|challenge-platform/i;

let chromeProc = null;
let ws = null;
let msgId = 0;
let pending = null;

function cdp(method, params) {
  return new Promise((resolve) => {
    const id = ++msgId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
}

async function ensureBrowser() {
  if (ws) return true;
  if (!fs.existsSync(CHROME)) return false;
  const port = 9700 + Math.floor(Math.random() * 200);
  const profile = path.join(os.tmpdir(), "wikifetch-" + port);
  chromeProc = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run", "--disable-extensions",
    "--remote-debugging-port=" + port, "--user-data-dir=" + profile, "about:blank",
  ], { stdio: "ignore" });

  let wsUrl = null;
  for (let i = 0; i < 40 && !wsUrl; i++) {
    await sleep(250);
    try {
      const list = await (await fetch("http://127.0.0.1:" + port + "/json/list")).json();
      const page = list.find((t) => t.type === "page");
      if (page) wsUrl = page.webSocketDebuggerUrl;
    } catch (e) { /* 还没起来 */ }
  }
  if (!wsUrl) return false;

  ws = new WebSocket(wsUrl);
  pending = new Map();
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  });
  await new Promise((r) => ws.addEventListener("open", r));
  await cdp("Page.enable");
  return true;
}

async function closeBrowser() {
  if (ws) { try { ws.close(); } catch (e) { /* 忽略 */ } ws = null; }
  if (chromeProc) { try { chromeProc.kill(); } catch (e) { /* 忽略 */ } chromeProc = null; }
  await sleep(150);
}

/* 走浏览器取一次。
 *
 * 关键优化：**先过一次 Cloudflare 挑战，之后就改在页面内用 fetch 取数**。
 * 每次请求都 `Page.navigate` 的话，一次导航约 3 秒，而审计要发几十个分类请求——慢到没法用。
 * 过完挑战后浏览器的 clearance cookie 就在 profile 里，页内 fetch 同源、带 cookie，
 * 单次约 200 毫秒，比导航快一个数量级。
 */
let primedOrigin = null;

async function primeBrowser(origin) {
  if (primedOrigin === origin) return;
  await cdp("Page.navigate", { url: origin + "/" });
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    await sleep(500);
    const r = await cdp("Runtime.evaluate", { expression: "document.title", returnByValue: true });
    const t = (r && r.result && r.result.value) || "";
    if (t && !CHALLENGE.test(t)) { primedOrigin = origin; return; }
  }
  throw new Error("取数失败：等待 45 秒仍未通过 Cloudflare 挑战页");
}

async function viaChrome(url, timeoutMs) {
  if (!(await ensureBrowser())) throw new Error("取数失败：缺少可用的 Chrome（可用 CHROME_PATH 指定）");
  const origin = new URL(url).origin;
  await primeBrowser(origin);

  /* 页内 fetch：同源 + 带 clearance cookie，失败时报错而不是静默返回空 */
  const expr = "fetch(" + JSON.stringify(url) + ", {credentials:'include'})" +
    ".then(function(r){ if(!r.ok) return 'HTTP ' + r.status; return r.text(); })" +
    ".catch(function(e){ return 'FETCH_ERR ' + e.message; })";
  const r = await cdp("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  const txt = (r && r.result && r.result.value) || "";
  if (!txt) throw new Error("取数失败：页内 fetch 没有返回内容");
  if (txt.indexOf("FETCH_ERR") === 0 || txt.indexOf("HTTP ") === 0) {
    throw new Error("取数失败：" + txt.slice(0, 80));
  }
  if (CHALLENGE.test(txt.slice(0, 400))) {
    primedOrigin = null;   /* 挑战又来了，下次重新过一遍 */
    throw new Error("取数失败：又撞上 Cloudflare 挑战页");
  }
  return JSON.parse(txt);
}

/* 取二进制（贴图）。图片同样被 Cloudflare 挡：直连拿到的是挑战页 HTML 而不是 PNG，
 * 所以这里**只走浏览器**，并且要在页面内转 base64 才能从 CDP 带出来。
 * 有了它，换贴图这条链路才不依赖 PowerShell 的 Invoke-WebRequest（那条路已被 Cloudflare 断掉）。 */
async function fetchBinary(url, opts) {
  if (!(await ensureBrowser())) throw new Error("取图失败：缺少可用的 Chrome（可用 CHROME_PATH 指定）");
  const origin = new URL(url).origin;
  await primeBrowser(origin);
  const expr = "fetch(" + JSON.stringify(url) + ", {credentials:'include'})" +
    ".then(function(r){ if(!r.ok) return 'HTTP ' + r.status; return r.arrayBuffer(); })" +
    ".then(function(b){ if(typeof b === 'string') return b;" +
    " var u=new Uint8Array(b), s='';" +
    " for(var i=0;i<u.length;i+=8192){ s+=String.fromCharCode.apply(null,u.subarray(i,i+8192)); }" +
    " return btoa(s); })" +
    ".catch(function(e){ return 'FETCH_ERR ' + e.message; })";
  const r = await cdp("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  const txt = (r && r.result && r.result.value) || "";
  if (!txt) throw new Error("取图失败：页内 fetch 没有返回内容");
  if (txt.indexOf("FETCH_ERR") === 0 || txt.indexOf("HTTP ") === 0) throw new Error("取图失败：" + txt.slice(0, 80));
  const buf = Buffer.from(txt, "base64");
  stats.chrome++;
  return buf;
}

/* 对外唯一入口：拿不到就抛，绝不返回空值 */
async function fetchJson(url, opts) {
  const timeoutMs = (opts && opts.timeoutMs) || 25000;
  /* 快路径 */
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { "User-Agent": UA } });
    const txt = await r.text();
    if (!CHALLENGE.test(txt.slice(0, 400))) {
      try {
        const j = JSON.parse(txt);
        stats.fast++;
        return j;
      } catch (e) { /* 不是 JSON，落到浏览器路径 */ }
    }
  } catch (e) { /* 网络层失败，落到浏览器路径 */ }

  /* 慢路径 */
  try {
    const j = await viaChrome(url, (opts && opts.chromeTimeoutMs) || 45000);
    stats.chrome++;
    return j;
  } catch (e) {
    stats.failed++;
    throw e;
  }
}

module.exports = { fetchJson, fetchBinary, closeBrowser, stats };
