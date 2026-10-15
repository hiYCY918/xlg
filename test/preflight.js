/* 开工前置体检（一条命令回答「现在能不能干活、起点正不正常」）
 *
 * 为什么要有它：2026-10-09 那轮在沙箱写盘上白花了约 15 个工具调用，而答案其实**早就写在工作区
 * README 里**——只是没人会在动手前想起来去翻。把「临场发现」变成「开工前一条命令」，
 * 这类弯路就不会再发生（R64：让流程产出它，别指望谁记得）。
 *
 * 用法：
 *   node test/preflight.js          # 体检
 *   node test/preflight.js --quiet  # 只输出结论行
 *
 * 检查项：沙箱写盘能力 / 网络可达 / 基线自检 / 静态页同步 / git 状态 / 本地与线上版本
 * 退出码：0 可开工；1 有阻塞项（阻塞项会写明怎么解）
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const QUIET = process.argv.indexOf("--quiet") >= 0;
const SITE = "https://hiycy918.github.io/xlg/";

const results = [];
const add = (ok, label, detail, blocking) => results.push({ ok, label, detail, blocking: blocking !== false });

function say(s) { if (!QUIET) console.log(s); }

/* ---- 1. 沙箱能不能写仓库 ----
 * 这是最贵的一课：受限模式下 node / python 写 game-guide 会被拒，而 DSH 文件工具可以写。
 * 探测方式就是真的写一个文件再删掉，不靠猜。 */
function checkSandbox() {
  const probe = path.join(ROOT, "_preflight-probe.tmp");
  try {
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
    add(true, "脚本可写仓库", "沙箱已放开（完全权限）");
    return true;
  } catch (e) {
    add(false, "脚本可写仓库",
      "被沙箱挡住：派生进程写不了仓库目录。**先把本会话切到完全权限**再开工" +
      "（受限模式下 deploy / 生成器 / 自检里的写盘步骤都会失败）", true);
    return false;
  }
}

/* ---- 2. 网络 ----
 * 只探「开工要用到的」两个目标：站点自身与 Wiki（内容工作要用）。 */
async function checkNetwork() {
  const targets = [
    ["本站", SITE],
    ["Wiki", "https://zh.stardewvalleywiki.com/"],
  ];
  for (const [name, url] of targets) {
    try {
      const r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(12000) });
      const reachable = r.status >= 200 && r.status < 400;
      const soft = name === "Wiki";   /* Wiki 被 Cloudflare 挡是已知情况，不算阻塞 */
      add(reachable, "网络 · " + name,
        reachable ? "HTTP " + r.status
          : "HTTP " + r.status + (soft ? "（Cloudflare 挡直连；联网工具会自动落到 headless Chrome，功能不受影响）" : ""),
        !soft);
    } catch (e) {
      const soft = name === "Wiki";
      add(false, "网络 · " + name,
        soft ? "直连不通（已知情况）；联网工具会自动落到 headless Chrome"
             : "不通：" + e.message.slice(0, 60), !soft);
    }
  }
}

/* ---- 3. 基线自检 + 4. 静态页同步 ----
 * 这两条直接复用现成脚本，不重复实现；受限沙箱下 spawn 可能 EPERM，要判存。 */
function runNode(rel, args) {
  try {
    const out = execFileSync(process.execPath, [path.join(ROOT, rel)].concat(args || []),
      { encoding: "utf8", timeout: 120000, stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, out };
  } catch (e) {
    /* 非零退出也会走到这里：把它的输出带回去（自检失败时输出才是有用信息） */
    return { ok: false, out: String((e.stdout || "") + (e.stderr || "")), msg: e.message };
  }
}

function checkBaseline(canSpawn) {
  if (!canSpawn) {
    add(false, "基线自检", "沙箱受限，无法派生 node 子进程；切到完全权限后再跑", true);
    return;
  }
  const r = runNode(path.join("test", "check.js"));
  const info = /\[INFO\] 自检规模：(\d+) 节 \/ (\d+) 处断言/.exec(r.out);
  const fails = (r.out.match(/^\[FAIL\].*$/gm) || []).length;
  if (r.ok && info) {
    add(true, "基线自检", info[1] + " 节 / " + info[2] + " 处断言，全过");
  } else {
    add(false, "基线自检", fails + " 处断言失败 —— 先修基线再动手（`node test/check.js` 看详情）", true);
  }

  const s = runNode(path.join("scripts", "gen-static-pages.js"), ["--check"]);
  const sDetail = /（([^）]*)）/.exec(s.out);   /* 取「（N 个文件）」里的内容，别把标签重复一遍 */
  add(s.ok, "静态页同步", sDetail ? sDetail[1] : (s.out.trim().split("\n").pop() || "").slice(0, 80), false);
}

/* ---- 5. git 状态 ---- */
function checkGit(canSpawn) {
  if (!canSpawn) return;
  let porcelain = "";
  try {
    porcelain = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8", timeout: 30000 });
  } catch (e) {
    add(false, "git 状态", "取不到（git 不可用？）", false);
    return;
  }
  const lines = porcelain.trim() ? porcelain.trim().split("\n") : [];
  add(true, "git 工作区", lines.length ? lines.length + " 处未提交改动（开工前心里有数）" : "干净", false);
}

/* ---- 6. 本地与线上版本 ----
 * 版本号不一致本身不是错误（本地改完还没部署就会不一致），但**必须让人看见**：
 * 否则会像历史上那样，把「部署没生效」误判成别的。 */
async function checkVersion() {
  let local = null;
  try {
    const m = /style\.css\?v=(\d+)/.exec(fs.readFileSync(path.join(ROOT, "index.html"), "utf8"));
    local = m ? m[1] : null;
  } catch (e) { /* 忽略 */ }
  let online = null;
  try {
    const h = await (await fetch(SITE + "index.html", { signal: AbortSignal.timeout(15000) })).text();
    const m = /\?v=(\d+)/.exec(h);
    online = m ? m[1] : null;
  } catch (e) { /* 忽略 */ }
  if (local && online) {
    add(true, "版本号", local === online ? "本地 = 线上 = v" + local : "本地 v" + local + " / 线上 v" + online + "（未部署的改动？）", false);
  } else {
    add(false, "版本号", "读不到（本地 " + local + " / 线上 " + online + "）", false);
  }
}

(async () => {
  say("=== 开工前置体检 ===");
  const canWrite = checkSandbox();
  await checkNetwork();
  checkBaseline(canWrite);
  checkGit(canWrite);
  await checkVersion();

  say("");
  for (const r of results) {
    console.log((r.ok ? "[OK]   " : "[!]    ") + r.label.padEnd(16) + r.detail);
  }
  const blocking = results.filter((r) => !r.ok && r.blocking);
  say("");
  if (blocking.length) {
    console.log("[FAIL] 有 " + blocking.length + " 项阻塞，先解决再开工：");
    blocking.forEach((r) => console.log("   · " + r.label + " —— " + r.detail));
    process.exit(1);
  }
  console.log("[OK] 可以开工（" + results.length + " 项检查，" +
    results.filter((r) => !r.ok).length + " 项提示、0 项阻塞）");
  process.exit(0);
})();
