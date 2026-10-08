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
  if (!nav) return JSON.stringify({ error: 'no #nav' });
  const title = nav.querySelector('.nav-title');
  const items = [...nav.querySelectorAll('.nav-item')];
  const navTop = nav.getBoundingClientRect().top;
  const off = (el) => Math.round(el.getBoundingClientRect().top - navTop + nav.scrollTop);
  const cs = getComputedStyle(nav);
  const last = items[items.length - 1];
  return JSON.stringify({
    /* 侧栏是竖排还是横排：横排（≤640 手机端）时"木板缝对齐"不适用，不该判错位 */
    navDir: cs.flexDirection,
    navPadTop: cs.paddingTop, navGap: cs.rowGap || cs.gap,
    navScrollTop: nav.scrollTop, navScrollH: nav.scrollHeight, navClientH: nav.clientHeight,
    navScrollW: nav.scrollWidth, navClientW: nav.clientWidth,
    titleTop: title ? off(title) : null,
    titleH: title ? Math.round(title.getBoundingClientRect().height) : null,
    items: items.map((e) => ({ m: e.dataset.module, top: off(e), h: Math.round(e.getBoundingClientRect().height) })),
    lastItem: last ? { m: last.dataset.module, top: off(last), h: Math.round(last.getBoundingClientRect().height) } : null,
    layoutBottom: Math.round(document.querySelector('.layout').getBoundingClientRect().bottom + window.scrollY),
    docH: document.documentElement.scrollHeight,
  });
})()`;

/* 等到页面真正渲染出导航再操作：线上首次加载（CDN 冷）比本地慢得多，
 * 固定 sleep 会偶发地在 #nav 还没建好时就求值，表达式抛错、量测返回 undefined。
 * 轮询"导航条目数 > 0"比加长 sleep 更稳，也更快。 */
async function waitReady(send, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 15000);
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
    const n = await waitReady(send);
    if (!n) { console.error("[FAIL] 页面没有渲染出导航（等不到 #nav .nav-item）"); await close(); process.exit(1); }
    /* 先把侧栏自身滚到底，验证"滚动后缝仍与条目对齐"（背景 local 的意义所在） */
    const sc = await send("Runtime.evaluate", { expression: "document.querySelector('#nav').scrollTop = 99999; document.querySelector('#nav').scrollTop", returnByValue: true });
    const r = await send("Runtime.evaluate", { expression: MEASURE_EXPR, returnByValue: true });
    if (!r || !r.result || typeof r.result.value !== "string") {
      console.error("[FAIL] 量测表达式未返回结果：" + JSON.stringify(r && r.result));
      await close(); process.exit(1);
    }
    const d = JSON.parse(r.result.value);
    const isColumn = d.navDir === "column";
    const PITCH = (d.items[0] ? d.items[0].h : 42) + (parseInt(d.navGap, 10) || 2);
    console.log("侧栏几何 @ " + W + "x" + H + "（" + (isColumn ? "竖排侧栏" : "横排导航") +
      "，已把导航自身滚到底 scrollTop=" + sc.result.value + "）");
    if (!isColumn) {
      /* 横排（≤640 手机端）用的是"竖向拼缝"的另一套背景，周期对齐不适用 */
      console.log("  横排模式：木板缝对齐不适用，跳过该项校验");
    } else {
      console.log("  上内边距 " + d.navPadTop + "，间距 " + d.navGap + "，标题高 " + d.titleH + "，行距 " + PITCH);
      let bad = 0;
      for (const it of d.items) {
        const exp = Math.round(it.top / PITCH) * PITCH;
        if (Math.abs(it.top - exp) > 1 || it.h !== PITCH - (parseInt(d.navGap, 10) || 2)) bad++;
      }
      console.log("  条目落在整格边界上：" + (d.items.length - bad) + " / " + d.items.length + (bad ? "  ← 有 " + bad + " 项错位" : "  ✓"));
      if (bad) { await close(); process.exit(1); }
    }
    /* 看轴向：竖排看高度溢出，横排看宽度溢出 */
    const overflow = isColumn ? (d.navScrollH > d.navClientH) : (d.navScrollW > d.navClientW);
    const dims = isColumn ? (d.navScrollH + " > " + d.navClientH) : (d.navScrollW + " > " + d.navClientW);
    console.log("  导航可独立滚动：" + (overflow ? "是（" + dims + "）" : "否（内容未超出一屏）"));
    const noGap = Math.abs(d.layoutBottom - d.docH) <= 2;
    console.log("  sticky 粘附范围覆盖到文档底：" + (noGap ? "是 ✓（滚到底不露白）" : "否 ✗ 差 " + (d.docH - d.layoutBottom) + "px"));
    await close();
    process.exit(noGap ? 0 : 1);
  }

  const { send, close } = await connect(url, W, H);
  await waitReady(send);
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
