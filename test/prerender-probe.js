/* 预渲染可行性探针（headless Chrome + CDP，零依赖）
 *
 * 用途：在不改动任何渲染代码的前提下，把一个深链接（如 `#fish/legend`）**渲染后的 DOM**
 * 落盘，用来回答「静态快照到底能不能当预渲染产物」这个问题：
 *   1. 快照里有没有条目正文（爬虫拿到静态 HTML 时能不能读到内容）
 *   2. 单页快照多大 → 折算 964 个页面会让仓库涨多少
 *   3. 只取详情（方案 A 的条目页）与取整个模块列表（现状）各是多大
 *
 * 这是**决策用的实验**，不是产物：跑完把数字抄进 docs/ROADMAP.md 的方案表即可。
 *
 * 用法：
 *   node test/prerender-probe.js https://hiycy918.github.io/xlg/ <outDir> "#fish/legend" "#fish" "#crops/parsnip"
 *
 * 依赖：Node 18+（fetch / WebSocket）、本机 Chrome（CHROME_PATH 可覆盖）
 */
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 快照内容从运行时的 DOM 里取。同时返回几段的长度，好在同一页里区分
 * 「模块列表」与「条目详情」各占多少——这正是方案 A / B 的成本差。 */
const DUMP_EXPR = `(() => {
  const html = document.documentElement.outerHTML;
  const page = document.querySelector('#page');
  const modal = document.querySelector('#modalContent');
  const title = document.querySelector('.page-title, .module-title, h2');
  return JSON.stringify({
    html: html,
    pageHtml: page ? page.outerHTML : '',
    modalHtml: modal ? modal.outerHTML : '',
    title: title ? title.textContent.trim().slice(0, 60) : null,
    textLen: (document.body.innerText || '').length,
    cards: document.querySelectorAll('#page .card, #page .item-card, #page .cell').length,
    links: document.querySelectorAll('a[href]').length,
  });
})()`;

async function waitReady(send, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 20000);
  while (Date.now() < deadline) {
    const r = await send("Runtime.evaluate", {
      expression: "document.querySelectorAll('#nav .nav-item').length",
      returnByValue: true,
    });
    if (r && r.result && r.result.value > 0) return r.result.value;
    await sleep(250);
  }
  return 0;
}

async function connect(url, W, H) {
  const PORT = 9800 + Math.floor(Math.random() * 200);
  const profile = path.join(os.tmpdir(), "prerender-" + PORT);
  const chrome = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run", "--disable-extensions",
    "--force-device-scale-factor=1", "--hide-scrollbars",
    "--remote-debugging-port=" + PORT, "--user-data-dir=" + profile,
    "--window-size=" + W + "," + H, "about:blank",
  ], { stdio: "ignore" });

  let wsUrl = null;
  for (let i = 0; i < 40 && !wsUrl; i++) {
    await sleep(250);
    try {
      const list = await (await fetch("http://127.0.0.1:" + PORT + "/json/list")).json();
      const page = list.find((t) => t.type === "page");
      if (page) wsUrl = page.webSocketDebuggerUrl;
    } catch (e) { /* 浏览器还没起来 */ }
  }
  if (!wsUrl) { chrome.kill(); throw new Error("连不上 CDP，检查 CHROME_PATH"); }

  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params) => new Promise((res) => {
    const msgId = ++id;
    pending.set(msgId, res);
    ws.send(JSON.stringify({ id: msgId, method, params: params || {} }));
  });
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  });
  await new Promise((r) => ws.addEventListener("open", r));
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  return { send, chrome, profile, ws };
}

const kb = (n) => (n / 1024).toFixed(1) + " KB";

(async () => {
  const [, , base, outDir, ...hashes] = process.argv;
  if (!base || !outDir || !hashes.length) {
    console.log("用法: node test/prerender-probe.js <baseUrl> <outDir> \"#fish/legend\" \"#fish\" ...");
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });

  const { send, chrome, profile, ws } = await connect(base, 1280, 900);
  const rows = [];
  try {
    for (const h of hashes) {
      const url = base.replace(/#.*$/, "") + h;
      await send("Page.navigate", { url });
      await sleep(1500);
      const navCount = await waitReady(send);
      /* 深链接要等详情弹窗渲染完（打开弹窗是跳转后的第二步），否则量到的是"还没打开"的状态 */
      await sleep(1200);
      const r = await send("Runtime.evaluate", { expression: DUMP_EXPR, returnByValue: true });
      if (!r || !r.result || !r.result.value) { rows.push({ hash: h, error: "求值失败" }); continue; }
      const d = JSON.parse(r.result.value);
      const name = h.replace(/^#/, "").replace(/\//g, "_").replace(/[^\w-]/g, "") || "root";
      fs.writeFileSync(path.join(outDir, name + ".html"), d.html);
      if (d.modalHtml) fs.writeFileSync(path.join(outDir, name + ".detail.html"), d.modalHtml);

      /* 爬虫视角：把 <script> 全部剥掉后，条目正文还在不在快照里。
       * 这是预渲染的全部意义所在——若内容仍只由 JS 生成，落盘就等于没落。 */
      const stripped = d.html.replace(/<script[\s\S]*?<\/script>/gi, "");
      rows.push({
        hash: h,
        navItems: navCount,
        full: d.html.length,
        noScript: stripped.length,
        page: d.pageHtml.length,
        detail: d.modalHtml.length,
        textLen: d.textLen,
        cards: d.cards,
        title: d.title,
        contentSurvives: /[\u4e00-\u9fff]{2,}/.test(stripped) && d.textLen > 200,
      });
    }
  } finally {
    ws.close(); chrome.kill(); await sleep(300);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }
  }

  console.log("\n深链接".padEnd(26) + "整页".padEnd(12) + "去脚本".padEnd(12) + "模块列表".padEnd(12) + "详情".padEnd(12) + "正文可见");
  for (const r of rows) {
    if (r.error) { console.log(r.hash.padEnd(26) + r.error); continue; }
    console.log(r.hash.padEnd(26) + kb(r.full).padEnd(12) + kb(r.noScript).padEnd(12) +
      kb(r.page).padEnd(12) + kb(r.detail).padEnd(12) + (r.contentSurvives ? "是" : "否") +
      "  卡片 " + r.cards + " 文字 " + r.textLen);
  }
  const ok = rows.filter((r) => !r.error);
  if (ok.length) {
    const avgFull = ok.reduce((n, r) => n + r.full, 0) / ok.length;
    const avgDetail = ok.reduce((n, r) => n + r.detail, 0) / ok.length;
    console.log("\n平均整页 " + kb(avgFull) + " · 平均详情 " + kb(avgDetail));
    console.log("折算 964 条目页（只存详情）：约 " + (avgDetail * 964 / 1024 / 1024).toFixed(1) + " MB");
    console.log("折算 964 条目页（存整页）：约 " + (avgFull * 964 / 1024 / 1024).toFixed(1) + " MB");
    console.log("折算 23 模块页（存整页）：约 " + (avgFull * 23 / 1024 / 1024).toFixed(1) + " MB");
    console.log("快照已写入 " + outDir);
  }
})();
