#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""把游戏地点截图加工成「内容区背景」——每个模块一张，输出到 img/bg/<模块 id>.jpg。

用法：
    python scripts/make-bg.py                 # 按 bg-map.json 生成全部
    python scripts/make-bg.py --only crops    # 只重做某一个
    python scripts/make-bg.py --check         # 只核对产物是否齐全、是否与参数一致
    python scripts/make-bg.py --report        # 打印每张的平均色与体积（换图时用来挑色调）

源图从 .bgraw/ 读（用 scripts/fetch-bg-raw.js 抓，见那里的说明：原图 11.7 MB 不进仓库）。

为什么这么加工（三条都是实测出来的）：
  ① **缩小到 960 宽**：原图 1920~2878，背景用 cover 铺满视口，960 足够；
  ② **预模糊 blur=10**：背景最终被洗到 0.82，高频细节根本看不见，
     而模糊掉之后 JPEG 能压到 1/30（265 KB → 9 KB），顺带让压在文字下面的底纹更干净；
  ③ **JPEG q45**：同上，反正要洗白，画质损失看不出来。
  实测 26 张合计约 250 KB，而「不加工直接铺」是 265 KB **一张**。
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
RAW_DIR = os.path.join(ROOT, ".bgraw")
OUT_DIR = os.path.join(ROOT, "img", "bg")
MAP_JSON = os.path.join(ROOT, "scripts", "bg-map.json")


def find_raw(name):
    for ext in (".png", ".jpg", ".jpeg"):
        p = os.path.join(RAW_DIR, name + ext)
        if os.path.exists(p) and os.path.getsize(p) > 1000:
            return p
    return None


def make_one(src_path, out_path, width, blur, quality, tint=None, tint_amount=0.0):
    im = Image.open(src_path).convert("RGB")
    w0, h0 = im.size
    im = im.resize((width, max(1, round(h0 * width / w0))), Image.LANCZOS)
    # 太高就裁中间一条：背景是 cover 铺满视口，16:9 够用，裁掉能少传一半像素
    target_h = round(width * 9 / 16)
    if im.height > target_h:
        top = (im.height - target_h) // 2
        im = im.crop((0, top, width, top + target_h))
    # 色调偏移：**不是**为了好看，是为了让 26 个模块各有辨识度——
    # 游戏里那 5 张洞穴截图（骷髅洞穴 / 矿场 / 精通洞窟 / 矿车 / 火山）平均色几乎一样，
    # 洗到 0.82 之后色距只剩 1~3，换模块时肉眼完全看不出区别。
    # 混入少量色调后色距拉到 10 以上，而画面本身仍是真实游戏截图。
    if tint and tint_amount > 0:
        layer = Image.new("RGB", im.size, tuple(tint))
        im = Image.blend(im, layer, tint_amount)
    if blur:
        im = im.filter(ImageFilter.GaussianBlur(blur))
    im.save(out_path, "JPEG", quality=quality, optimize=True, progressive=True)
    small = im.resize((1, 1), Image.LANCZOS).getpixel((0, 0))
    return w0, h0, im.size, small, os.path.getsize(out_path)


def main():
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("--only", help="只处理指定的模块 id")
    ap.add_argument("--check", action="store_true", help="只核对产物是否存在")
    ap.add_argument("--report", action="store_true", help="打印每张的平均色与体积")
    args = ap.parse_args()

    cfg = json.load(open(MAP_JSON, encoding="utf-8"))
    treat = cfg.get("treat") or {}
    width = int(treat.get("width", 960))
    blur = int(treat.get("blur", 10))
    quality = int(treat.get("quality", 45))

    mods = cfg["modules"]
    if args.only:
        mods = [m for m in mods if m["id"] == args.only]
        if not mods:
            sys.exit("bg-map.json 里没有模块 " + args.only)

    if args.check:
        missing = [m["id"] for m in mods if not os.path.exists(os.path.join(OUT_DIR, m["id"] + ".jpg"))]
        if missing:
            print("缺少 %d 张背景：%s" % (len(missing), "、".join(missing)))
            sys.exit(1)
        total = sum(os.path.getsize(os.path.join(OUT_DIR, m["id"] + ".jpg")) for m in mods)
        print("背景齐全：%d 张，合计 %.1f KB" % (len(mods), total / 1024))
        return

    os.makedirs(OUT_DIR, exist_ok=True)
    rows, missing_raw = [], []
    for m in mods:
        raw = find_raw(m["source"])
        if not raw:
            missing_raw.append("%s（源图 %s 不在 .bgraw/）" % (m["id"], m["source"]))
            continue
        out = os.path.join(OUT_DIR, m["id"] + ".jpg")
        w0, h0, (w, h), color, size = make_one(
            raw, out, width, blur, quality,
            tint=m.get("tint"), tint_amount=float(m.get("tintAmount", 0) or 0))
        rows.append((m["id"], m["source"], w0, h0, w, h, color, size))

    if missing_raw:
        print("有 %d 个模块缺源图：" % len(missing_raw))
        for x in missing_raw:
            print("   " + x)
        print("先跑：node scripts/fetch-bg-raw.js")

    if rows:
        if args.report:
            print("%-14s %-18s %-12s %-10s %s" % ("模块", "源图", "原始", "输出", "平均色 / 体积"))
            for (mid, srcname, w0, h0, w, h, c, size) in rows:
                print("%-14s %-18s %-12s %-10s rgb(%3d,%3d,%3d)  %5.1f KB" %
                      (mid, srcname, "%dx%d" % (w0, h0), "%dx%d" % (w, h), c[0], c[1], c[2], size / 1024))
        total = sum(r[7] for r in rows)
        print("生成 %d 张，合计 %.1f KB（平均 %.1f KB/张）" % (len(rows), total / 1024, total / len(rows) / 1024))
        # 色调撞车检查：**按洗白后的颜色**算，那才是肉眼看到的。
        # 阈值 4：色距小于 4 时，两个模块的背景在屏幕上基本分不出来。
        SCRIM = (253, 246, 232)
        def washed(c, a=0.82):
            return tuple(round(SCRIM[i] * a + c[i] * (1 - a)) for i in range(3))
        def dist(a, b):
            return sum((a[i] - b[i]) ** 2 for i in range(3)) ** 0.5
        near = []
        for i in range(len(rows)):
            for j in range(i + 1, len(rows)):
                d = dist(washed(rows[i][6]), washed(rows[j][6]))
                if d < 4:
                    near.append("%s vs %s（洗白后色距 %.1f）" % (rows[i][0], rows[j][0], d))
        if near:
            print("警告：有 %d 对背景洗白后几乎一样，换模块时看不出区别 —— 给其中一张加 tint：" % len(near))
            for x in near:
                print("   " + x)
        else:
            print("色调检查通过：26 张背景两两色距都 >= 4（洗白后）")

    if missing_raw:
        sys.exit(1)


if __name__ == "__main__":
    main()
