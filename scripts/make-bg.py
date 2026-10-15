#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""把源图加工成内容区背景，输出 img/bg/background.jpg。

用法：
    python scripts/make-bg.py            # 生成
    python scripts/make-bg.py --check    # 只核对产物在不在
    python scripts/make-bg.py --report   # 顺带打印产物路径
    python scripts/make-bg.py --blur 16  # 试别的虚化档位（不改配置，直接出图）

源图是 scripts/bg-source.jpg（289×202 的卡通画），**提交在仓库里**，
所以这一步在全新克隆上也能重跑——不像上一版要靠 .bgraw/ 里 11.7 MB 的地点截图缓存。

为什么这么加工：
  ① **放大到 1280 宽**：源图只有 289 宽，cover 铺满视口必须放大；用 LANCZOS，
     不用最近邻——原图是平滑的卡通画而非像素画，最近邻会出锯齿。
  ② **虚化 blur 4**：实测各档 —— 9 太糊（只剩色带，用户要求「再清晰一点」）、
     **4 能看清飞鸟 / 飘叶 / 山脊且仍柔和**、2 更锐、0 完全不虚化（源图只有 289 宽，
     放大到 1280 的痕迹会露出来）。档位只是配置里的一个数。
  ③ **JPEG q60**：画面本来就虚，画质损失看不出来；约 30 KB。

上一版是「26 个模块各一张游戏地点截图」（bg-map.json + fetch-bg-raw.js + 26 张图）。
用户改用这一张之后那套机制成了死代码，已整套移除；需要时可从 git 历史取回。
"""
import argparse
import json
import os
import sys

try:
    from PIL import Image, ImageFilter
except ImportError:
    sys.exit("需要 Pillow：pip install Pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONF = os.path.join(ROOT, "scripts", "bg-config.json")
OUT_DIR = os.path.join(ROOT, "img", "bg")


def build(conf, blur_override=None):
    src = os.path.join(ROOT, conf["source"])
    if not os.path.exists(src):
        sys.exit("找不到源图：" + src)
    t = conf["treat"]
    width = int(t["width"])
    blur = int(blur_override if blur_override is not None else t["blur"])
    quality = int(t["quality"])

    im = Image.open(src).convert("RGB")
    w0, h0 = im.size
    im = im.resize((width, max(1, round(h0 * width / w0))), Image.LANCZOS)
    # 太高就裁中间一条：背景是 cover 铺满视口，16:9 够用，裁掉能少传一半像素
    target_h = round(width * 9 / 16)
    if im.height > target_h:
        top = (im.height - target_h) // 2
        im = im.crop((0, top, width, top + target_h))
    if blur:
        im = im.filter(ImageFilter.GaussianBlur(blur))

    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, conf["output"])
    im.save(out, "JPEG", quality=quality, optimize=True, progressive=True)
    color = im.resize((1, 1), Image.LANCZOS).getpixel((0, 0))
    return w0, h0, im.size, blur, color, os.path.getsize(out), out


def main():
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--report", action="store_true")
    ap.add_argument("--blur", type=int, default=None, help="临时试别的虚化档位")
    ap.add_argument("--scrim", type=float, default=None, help="只用来算对比度，取值同 CSS 的洗白系数")
    args = ap.parse_args()

    conf = json.load(open(CONF, encoding="utf-8"))
    out = os.path.join(OUT_DIR, conf["output"])

    if args.check:
        if not os.path.exists(out):
            print("缺少背景图：" + out)
            sys.exit(1)
        print("背景图就位：%s  %.1f KB" % (conf["output"], os.path.getsize(out) / 1024))
        return

    w0, h0, (w, h), blur, color, size, path = build(conf, args.blur)
    print("源图 %dx%d → 输出 %dx%d（blur %d）" % (w0, h0, w, h, blur))
    print("平均色 rgb(%d,%d,%d)   体积 %.1f KB" % (color[0], color[1], color[2], size / 1024))

    # 可读性：正文压在背景上的对比度。洗白系数必须与 CSS 里的一致（默认取配置值）。
    scrim = args.scrim if args.scrim is not None else float(conf["treat"].get("scrim", 0.70))
    SCRIM = (253, 246, 232)
    bg = tuple(round(SCRIM[i] * scrim + color[i] * (1 - scrim)) for i in range(3))
    TEXT = (67, 53, 42)   # --text: #43352a

    def lum(c):
        def f(v):
            v = v / 255.0
            return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
        r, g, b = (f(x) for x in c)
        return 0.2126 * r + 0.7152 * g + 0.0722 * b

    la, lb = lum(TEXT), lum(bg)
    ratio = (max(la, lb) + 0.05) / (min(la, lb) + 0.05)
    print("洗白 %.2f 后背景约 rgb(%d,%d,%d)，正文对比度 %.1f:1  %s" %
          (scrim, bg[0], bg[1], bg[2], ratio, "OK（AA 要求 4.5）" if ratio >= 4.5 else "**低于 AA**"))
    if args.report:
        print("产物：" + path)


if __name__ == "__main__":
    main()
