#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""生成 SEO 用图：favicon.ico / apple-touch-icon.png / og-cover.png

为什么要留这个脚本：这三个文件是**产物**，产物本身能提交，但"怎么来的"不写下来就没人能重生成
（R64：只修产物不改生产线，下次还会以同样的方式卡住）。改站点配色或换 logo 时重跑即可。

依赖：Pillow。站点是纯静态、无构建步骤，所以这个脚本**不参与部署流程**，
只在需要重新生成图时手动跑一次：
    python scripts/gen-seo-assets.py

缩放口径（R83）：像素素材一律用**最近邻**，不做双线性/双三次——
非整数比下的插值才会把像素画"糊"掉，最近邻在任何比例下都保持硬边。
"""
import os
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("需要 Pillow：pip install Pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "img", "npc-junimo.png")

# 站点配色（与 css/style.css 的变量保持一致，改配色时两边一起改）
WOOD = "#6b4526"
BORDER = "#d7c19a"
BG = "#f4ead7"
PANEL = "#fdf6e8"
TEXT = "#43352a"
MUTED = "#9a8567"
ACCENT = "#5f9e3f"

FONT_BOLD = r"C:\Windows\Fonts\msyhbd.ttc"
FONT_REG = r"C:\Windows\Fonts\msyh.ttc"


def load_sprite():
    """取 GIF 的第一帧并转 RGBA（原图是 48x48 的四帧动画 GIF，扩展名却是 .png）"""
    im = Image.open(SRC)
    im.seek(0)
    return im.convert("RGBA")


def scaled(sprite, size):
    """最近邻缩放，并打印「原尺寸 → 缩放比 → 新尺寸」（R83 要求，否则缩成 1x1 也没人发现）"""
    w, h = sprite.size
    out = sprite.resize((size, size), Image.NEAREST)
    print("  {0}x{1} -> {2}x{2}  (比例 {3:.3f}x, 最近邻)".format(w, h, size, size / float(w)))
    return out


def font(path, size):
    # .ttc 是字体集合，index=0 取第一个字面
    return ImageFont.truetype(path, size, index=0)


def make_icons(sprite):
    # 浏览器标签页 16/32、书签与桌面 48；一并在 ICO 里存多档，让系统自己挑
    sizes = [16, 32, 48]
    frames = [scaled(sprite, s) for s in sizes]
    ico = os.path.join(ROOT, "favicon.ico")
    frames[-1].save(ico, format="ICO", sizes=[(s, s) for s in sizes])
    print("  写出 favicon.ico（{0}）".format(", ".join("{0}x{0}".format(s) for s in sizes)))

    # iOS 主屏图标：180x180，最近邻放大保持像素风
    touch = scaled(sprite, 180)
    touch.save(os.path.join(ROOT, "apple-touch-icon.png"))
    print("  写出 apple-touch-icon.png（180x180）")


def make_og(sprite):
    """1200x630 社交卡片（微信/QQ/Twitter 的推荐尺寸）。

    刻意**不写任何会过期的数字**（模块数、条目数…）——图片里的数字没法被自检核对，
    写上去就等于埋一处必然腐化的文案（R60）。"""
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # 木框 + 内衬羊皮纸，复刻站点的木框质感
    d.rectangle([0, 0, W - 1, H - 1], outline=WOOD, width=16)
    d.rectangle([16, 16, W - 17, H - 17], outline=BORDER, width=2)
    d.rectangle([30, 30, W - 31, H - 31], fill=PANEL)

    # 左侧：祝尼魔 4 倍放大（48 -> 192）
    jun = scaled(sprite, 192)
    img.paste(jun, (96, 219), jun)

    f_title = font(FONT_BOLD, 76)
    f_sub = font(FONT_REG, 36)
    f_url = font(FONT_REG, 30)

    x = 368
    d.text((x, 214), "星露谷物语 · 攻略站", font=f_title, fill=TEXT)
    d.rectangle([x + 4, 312, x + 320, 319], fill=ACCENT)
    d.text((x, 344), "像素风中文攻略 · 模块速查", font=f_sub, fill=MUTED)
    d.text((x, 396), "收集包与博物馆进度可勾选留存", font=f_sub, fill=MUTED)
    d.text((x, 470), "hiycy918.github.io/xlg", font=f_url, fill=ACCENT)

    out = os.path.join(ROOT, "og-cover.png")
    img.save(out, optimize=True)
    print("  写出 og-cover.png（{0}x{1}）".format(W, H))


def main():
    if not os.path.exists(SRC):
        sys.exit("找不到源图：" + SRC)
    sprite = load_sprite()
    print("源图 img/npc-junimo.png：{0}x{1} {2}".format(sprite.size[0], sprite.size[1], sprite.mode))
    make_icons(sprite)
    make_og(sprite)
    print("完成。")


if __name__ == "__main__":
    main()
