/* 滚动截图 / 几何量测（headless Chrome + CDP，零依赖）
 *
 * 为什么需要它：`chrome --screenshot` 只截**视口顶部**，而 sticky 侧栏、
 * 吸顶元素、独立滚动容器的问题**只有滚到特定位置才看得出来**——
 * 本轮"滚到页面最底时侧栏下方露出一条空白"就是这么发现的。
 *
 * 用法：
 *   node test/scroll-shot.js <url> <out.png> [width] [height] [scrollY|bottom]
 *   node test/scroll-shot.js <url> measure [width] [height]     # 只量侧栏几何，不出图
 *
 * 依赖：Node 18+（全局 fetch / WebSocket）、本机 Chrome（路径写在下面，可改环境变量覆盖）
 */
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 侧栏几何量测表达式：把条目位置换算成**内容坐标**（视觉位置 + scrollTop）。
 * ⚠️ 必须补回 scrollTop：滚动量一般不是行距的整数倍，用视口坐标比会误报错位。 */
const MEASURE_EXPR = `(() => {
  const nav = document.querySelector('#nav');
  const title = nav.querySelector('.nav-title');
  const items = [...nav.querySelectorAll('.nav-item')];
  const navTop = nav.getBoundingClientRect().top;
  const off = (el) => Math.round(el.getBoundingClientRect().top - navTop + nav.scrollTop);
  const cs = getComputedStyle(nav);
  const last = items[items.length - 1];
  return JSON.stringify({
    navPadTop: cs.paddingTop, navGap: cs.rowGap || cs.gap,
    navScrollTop: nav.scrollTop, navScrollH: nav.scrollHeight, navClientH: nav.clientHeight,
    titleTop: title ? off(title) : null,
    titleH: title ? Math.round(title.getBoundingClientRect().height) : null,
    items: items.map((e) => ({ m: e.dataset.module, top: off(e), h: Math.round(e.getBoundingClientRect().height) })),
    lastItem: { m: last.dataset.module, top: off(last), h: Math.round(last.getBoundingClientRect().height) },
    layoutBottom: Math.round(document.querySelector('.layout').getBoundingClientRect().bottom + window.scrollY),
    docH: document.documentElement.scrollHeight,
  });
})()`;

async function connect(url, W, H) {
  const PORT = 9433 + Math.floor(Math.random() * 200);
  const profile = path.join(os.tmpdir(), "shot-" + PORT);
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
  await send("Page.navigate", { url });
  await sleep(2500);

  const close = async () => { ws.close(); chrome.kill(); await sleep(300); try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} };
  return { send, close };
}

(async () => {
  const [, , url, out, a4, a5, a6] = process.argv;
  if (!url || !out) {
    console.log("用法: node test/scroll-shot.js <url> <out.png|measure> [width] [height] [scrollY|bottom]");
    process.exit(1);
  }
  const W = parseInt(a4, 10) || 1440;
  const H = parseInt(a5, 10) || 900;

  if (out === "measure") {
    const { send, close } = await connect(url, W, H);
    /* 先把侧栏自身滚到底，验证"滚动后缝仍与条目对齐"（背景 local 的意义所在） */
    const sc = await send("Runtime.evaluate", { expression: "document.querySelector('#nav').scrollTop = 99999; document.querySelector('#nav').scrollTop", returnByValue: true });
    const r = await send("Runtime.evaluate", { expression: MEASURE_EXPR, returnByValue: true });
    const d = JSON.parse(r.result.value);
    const PITCH = (d.items[0] ? d.items[0].h : 42) + (parseInt(d.navGap, 10) || 2);
    console.log("侧栏几何 @ " + W + "x" + H + "（已把侧栏自身滚到底 scrollTop=" + sc.result.value + "）");
    console.log("  上内边距 " + d.navPadTop + "，间距 " + d.navGap + "，标题高 " + d.titleH + "，行距 " + PITCH);
    let bad = 0;
    for (const it of d.items) {
      const k = Math.round(it.top / PITCH);
      const exp = k * PITCH;
      const ok = Math.abs(it.top - exp) <= 1 && it.h * 1 === (it.h | 0);
      if (!ok) bad++;
    }
    console.log("  条目落在整格边界上：" + (d.items.length - bad) + " / " + d.items.length + (bad ? "  ← 有 " + bad + " 项错位" : "  ✓"));
    console.log("  侧栏可独立滚动：" + (d.navScrollH > d.navClientH ? "是（" + d.navScrollH + " > " + d.navClientH + "）" : "否（内容未超出一屏）"));
    console.log("  sticky 粘附范围覆盖到文档底：" + (Math.abs(d.layoutBottom - d.docH) <= 2 ? "是 ✓（滚到底不露白）" : "否 ✗ 差 " + (d.docH - d.layoutBottom) + "px"));
    await close();
    process.exit(bad ? 1 : 0);
  }

  const { send, close } = await connect(url, W, H);
  const expr = a6 === "bottom"
    ? "window.scrollTo(0, document.documentElement.scrollHeight); 'ok'"
    : "window.scrollTo(0, " + (parseInt(a6, 10) || 0) + "); 'ok'";
  await send("Runtime.evaluate", { expression: expr, returnByValue: true });
  await sleep(600);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(out, Buffer.from(shot.data, "base64"));
  console.log("[OK] " + out + "  (" + fs.statSync(out).size + " B)");
  await close();
  process.exit(0);
})();
