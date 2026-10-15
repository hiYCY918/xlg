# -*- coding: utf-8 -*-
"""把贴图按**整数倍**缩小到指定图标位以内。

为什么需要它：
  `.icon-img` 上挂着全局 `image-rendering: pixelated`，非整数缩放会丢行丢列（R23/R83）。
  站点的图标位分四档，新入库的截图要先按整数倍落到其中一档：

      48   普通物品（默认）
      64   .icon-md  技能图标
      96   .icon-lg  建筑截图、地点截图
      128  NPC 立绘（按 1/2 显示成 64px）

  注意：**没有「全局统一尺寸」这回事**——img/ 里合法的 128×128 NPC 立绘、
  112×112 的怪物精灵都超过 96。这也是本脚本要求**显式指定文件**、不做全局扫描的原因
  —— 全局扫描会把它们全报成超格（试过一次，54 个误报）。

用法：
    python scripts/scale-images.py --slot 96 img/ginger-island.png img/cave.png
    python scripts/scale-images.py --slot 96 --check img/*.png    # 只报告，不改文件

缩放系数 k = max(ceil(w/slot), ceil(h/slot))，结果按 (w//k, h//k) 落地，
所以两边都 ≤slot 且**比例恰为 1/k**。已经是合法尺寸的文件会被跳过（可重复执行）。
"""
import os
import sys
import math
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXTS = (".png", ".jpg", ".jpeg")

args = sys.argv[1:]
CHECK = "--check" in args
SLOT = 96
if "--slot" in args:
    i = args.index("--slot")
    SLOT = int(args[i + 1])
    del args[i:i + 2]
files = [a for a in args if not a.startswith("--")]

if not files:
    print(__doc__)
    sys.exit(2)

over, scaled, failed, skipped = [], [], [], 0
for raw in files:
    p = raw if os.path.isabs(raw) else os.path.join(ROOT, raw)
    if not os.path.exists(p):
        failed.append("%s 不存在" % raw)
        continue
    try:
        im = Image.open(p)
    except Exception as e:                      # 坏文件要说出来，不能静默跳过
        failed.append("%s 打不开：%s" % (raw, e))
        continue
    w, h = im.size
    if w <= SLOT and h <= SLOT:
        skipped += 1
        continue
    if CHECK:
        over.append("%s %dx%d" % (os.path.basename(p), w, h))
        continue
    k = max(math.ceil(w / SLOT), math.ceil(h / SLOT), 1)
    nw, nh = w // k, h // k
    if nw < 1 or nh < 1:
        failed.append("%s 缩完没有像素了" % raw)
        continue
    # 统一成 RGBA 存 PNG（JPG 没有 alpha），与站内其余贴图一致
    dest = os.path.splitext(p)[0] + ".png"
    im.convert("RGBA").resize((nw, nh), Image.LANCZOS).save(dest, "PNG", optimize=True)
    if dest != p and os.path.exists(p):
        os.remove(p)
    scaled.append("%-28s %dx%d → 1/%-3d → %dx%d" % (os.path.basename(p), w, h, k, nw, nh))

for line in scaled:
    print(line)
if CHECK:
    if over:
        print("[!] %d 张超过 %d 格：" % (len(over), SLOT))
        for o in over:
            print("    " + o)
        sys.exit(1)
    print("[OK] 指定的 %d 张都不超过 %d 格（另有 %d 张本来就合格）" % (len(files), SLOT, skipped))
else:
    print("缩放 %d 张，跳过 %d 张（本来就合格）" % (len(scaled), skipped))
if failed:
    print("!! 失败 %d 个：" % len(failed))
    for f in failed:
        print("    " + f)
    sys.exit(1)
