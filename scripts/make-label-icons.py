#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""把「行内标签小图标」规范到 16px 网格上（R23/R83：像素画必须整数倍缩放，否则会糊）。

背景：卡片上的行内标签（生日 / 地点 / 礼物 / 售价 / 时间 / 天气…）原先用 emoji，
现在换成游戏贴图。这些图标统一按 **16px** 显示，所以素材尺寸必须能整数倍除到 16：

    48×48  ÷3 = 16    ✓ 多数界面图标与物品贴图都是这个尺寸，直接可用
    64×68  按宽度 16 → 16×17，两轴同比 1/4   ✓ 不需要处理（CSS 用 width:16px; height:auto）
    36×36  ÷? 除不尽  ✗ 本脚本处理：÷3 → 12×12，再补白到 16×16（居中，不缩放内容）

用法：
    python scripts/make-label-icons.py           # 规范化
    python scripts/make-label-icons.py --check   # 只核对是否已落在网格上
"""
import argparse
import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("需要 Pillow：pip install Pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "img")

# 需要规范的素材 →（整数除数，目标画布）
# 只登记**除不尽**的那些；48×48 与 64×68 不需要处理。
FIX = {
    "weather-icon": (3, 16),    # 36×36 ÷3 = 12×12，补白到 16×16
}


def main():
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    bad = []
    for name, (k, canvas) in FIX.items():
        p = os.path.join(IMG, name + ".png")
        if not os.path.exists(p):
            bad.append(name + "（文件不存在）")
            continue
        im = Image.open(p)
        w, h = im.size
        on_grid = (w % canvas == 0 and h % canvas == 0)
        if args.check:
            print("  %-16s %dx%d  %s" % (name, w, h, "已在网格上" if on_grid else "**不在 %dpx 网格上**" % canvas))
            if not on_grid:
                bad.append(name)
            continue
        if on_grid:
            print("  %-16s %dx%d 已在网格上，跳过" % (name, w, h))
            continue
        nw, nh = w // k, h // k
        if nw > canvas or nh > canvas:
            print("  %-16s %dx%d ÷%d = %dx%d 仍大于画布 %d，跳过（需人工决定）" % (name, w, h, k, nw, nh, canvas))
            bad.append(name)
            continue
        small = im.resize((nw, nh), Image.NEAREST)          # 整数分之一，用 NEAREST 保住像素块
        out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
        out.paste(small.convert("RGBA"), ((canvas - nw) // 2, (canvas - nh) // 2))
        out.save(p, "PNG", optimize=True)
        print("  %-16s %dx%d ÷%d = %dx%d → 补白到 %dx%d（内容不变形，只加透明边）" %
              (name, w, h, k, nw, nh, canvas, canvas))

    if bad:
        print("\n有 %d 项需要处理：%s" % (len(bad), "、".join(bad)))
        sys.exit(1)
    print("\n全部落在 16px 网格上。")


if __name__ == "__main__":
    main()
