/* 把 「文档里的数字」按 check.js 的真实结果自动写回
 *
 * 为什么需要它：check.js 第 25 节断言「README 里的数字必须等于真实值」，方向是对的
 * （R60：文档里的数字是数据），但**加一条断言就要手改一次 README**——2026-10-09 那轮
 * 为此来回改了 4 次。断言该留，手工同步该去掉，所以补这个工具。
 *
 * 真实值**不在这里重算**，而是从 check.js 的输出里读：
 *   · `[INFO] 自检规模：N 节 / M 处断言`
 *   · `[OK] 农作物 数据 46 条`（第 2 节，逐模块）
 *   · 第 25 节的断言文案里带 `== <真实值> <单位>`（成功与失败两种情况下都在）
 * 单一事实来源仍是 check.js，本工具只负责把结果写进文档——两边各算一遍必然走偏。
 *
 * 用法：
 *   node scripts/sync-doc-counts.js          # 空跑，列出将要修改的内容
 *   node scripts/sync-doc-counts.js --apply  # 写入
 *
 * ⚠️ **只自动同步 README.md**。跨会话接手说明（工作区那份）里同样有「N 个模块」「N 节 M 处断言」，
 * 但那些多半是**历史叙述**（「第十四轮…详情弹窗 10→14 模块」「自检 7 节 98→12 节 172」），
 * 按句式无法与现状描述区分——自动替换会把历史改烂（R90：别写出会误报的断言）。
 * 那几处继续人工核对，本工具会在末尾把候选行号列出来供参考，但不动手。
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const APPLY = process.argv.indexOf("--apply") >= 0;
const README = path.join(ROOT, "README.md");
/* 跨会话接手文档在工作区（刻意不在仓库里）：只做**只读提示**，不自动改 */
const HANDOVER = "D:\\deepseek\\游戏攻略站-接手说明.md";

function runCheck() {
  try {
    return execFileSync(process.execPath, [path.join(ROOT, "test", "check.js")],
      { encoding: "utf8", timeout: 120000, stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    /* 断言失败时 check.js 退出码非零，但**输出正是我们要的**（失败文案里同样带真实值） */
    const out = String((e.stdout || "") + (e.stderr || ""));
    if (!out) throw new Error("跑不动 check.js：" + e.message);
    return out;
  }
}

const out = runCheck();

/* ---- 从输出里取真实值 ---- */
const facts = {};
const scale = /\[INFO\] 自检规模：(\d+) 节 \/ (\d+) 处断言/.exec(out);
if (scale) { facts.sections = scale[1]; facts.assertions = scale[2]; }

const take = (re) => { const m = re.exec(out); return m ? m[1] : null; };
facts.items = take(/README 条目总数（全 N 条） == (\d+) 条/);
facts.images = take(/README 贴图张数（真实游戏贴图 N 张） == (\d+) 张/);
facts.gifts = take(/README 礼物可跳转数（N 个礼物可直接跳转） == (\d+) 个/);
facts.machines = take(/README 工匠产出机器数（N 类产出机器） == (\d+) 类/);
facts.modules = take(/README 模块列表数量 == 模块数（\d+\/(\d+)）/);

/* 逐模块条目数：第 2 节的 `[OK] 农作物 数据 46 条` */
facts.moduleCounts = {};
for (const m of out.matchAll(/^\[OK\] (\S+) 数据 (\d+) 条$/gm)) facts.moduleCounts[m[1]] = m[2];

const missing = Object.keys(facts).filter((k) => k !== "moduleCounts" && !facts[k]);
if (missing.length) {
  console.error("取不到这些真实值：" + missing.join(", "));
  console.error("多半是 check.js 的输出格式变了——本工具依赖那些行，改格式时记得同步这里。");
  process.exit(1);
}

/* ---- 逐条替换规则：只在「描述现状」的句式上动手（历史叙述不碰，R90） ---- */
function plan(text) {
  const edits = [];
  const sub = (label, re, to) => {
    const before = text;
    text = text.replace(re, (...args) => {
      const whole = args[0];
      const next = typeof to === "function" ? to(...args) : to;
      if (next !== whole) edits.push({ label, from: whole, to: next });
      return next;
    });
    return text;
  };

  sub("自检规模", /(\d+) 节 (\d+) 处断言/g, () => facts.sections + " 节 " + facts.assertions + " 处断言");
  sub("贴图张数", /真实游戏贴图 (\d+) 张/g, () => "真实游戏贴图 " + facts.images + " 张");
  sub("条目总数", /全 (\d+) 条/g, () => "全 " + facts.items + " 条");
  sub("模块数", /(\d+)(\s*(?:个|大)?模块)/g, (whole, _n, tail) => facts.modules + tail);
  sub("礼物可跳转数", /(\d+) 个礼物可直接跳转/g, () => facts.gifts + " 个礼物可直接跳转");
  sub("产出机器数", /(\d+) 类产出机器/g, () => facts.machines + " 类产出机器");
  /* 逐模块：只改 README 里 `**<标签>（N 量词）**` 这种写法 */
  for (const [label, n] of Object.entries(facts.moduleCounts)) {
    sub("模块条目数 · " + label, new RegExp("(\\*\\*" + label + "（)(\\d+)(\\s*[^）]*）\\*\\*)", "g"),
      (whole, head, _num, tail) => head + n + tail);
  }
  return { text, edits };
}

const targets = [["README.md", README]];

let totalEdits = 0;
const pending = [];
for (const [name, file] of targets) {
  const src = fs.readFileSync(file, "utf8");
  const { text, edits } = plan(src);
  totalEdits += edits.length;
  console.log("【" + name + "】" + (edits.length ? edits.length + " 处需同步" : "已是最新"));
  edits.forEach((e) => console.log("   " + e.label + "：" + e.from.trim().slice(0, 48) + "  →  " + e.to.trim().slice(0, 48)));
  if (APPLY && edits.length) pending.push([file, text]);
}

console.log("\n真实值：模块 " + facts.modules + " / 条目 " + facts.items + " / 贴图 " + facts.images +
  " / 礼物可跳转 " + facts.gifts + " / 产出机器 " + facts.machines + " / 自检 " + facts.sections + " 节 " + facts.assertions + " 处");

/* 接手说明只提示、不改：里面的数字大部分是历史叙述 */
if (fs.existsSync(HANDOVER)) {
  const lines = fs.readFileSync(HANDOVER, "utf8").split("\n");
  const cand = [];
  lines.forEach((l, i) => {
    if (/(\d+)\s*(?:个|大)?模块|(\d+) 节 \d+ 处断言/.test(l)) cand.push(i + 1);
  });
  console.log("\n【游戏攻略站-接手说明.md】不自动改（含历史叙述）。以下 " + cand.length +
    " 行含易过期数字，请人工确认哪些是「现状」：");
  console.log("   行号 " + cand.slice(0, 20).join(", ") + (cand.length > 20 ? " …" : ""));
  console.log("   现状项通常只有：开头版本行、接手三步的自检行、状态表的「自检断言 / 线上版本 / 提交历史」。");
}

if (!APPLY) {
  console.log(totalEdits ? "\n（空跑。加 --apply 写入）" : "\n文档与代码已一致。");
  process.exit(0);
}
for (const [file, text] of pending) {
  fs.writeFileSync(file, text, "utf8");
  console.log("已写入 " + file);
}
console.log(totalEdits ? "\n同步完成，建议再跑一次 node test/check.js 确认全绿。" : "");
