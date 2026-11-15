# -*- coding: utf-8 -*-
"""生成 PWA 所需图标（无需联网、无需设计稿）。

用法：
    python scripts/make-icons.py

产出 icons/ 下：
    icon-192.png / icon-512.png           普通图标（带圆角）
    icon-maskable-192/512.png             安卓自适应图标（满版底色，安全区内排版）
    apple-touch-icon.png                  180x180，iOS 添加到主屏幕
"""
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "icons")
BG = (22, 64, 91)          # #16405B 与界面主色一致
FG = (255, 255, 255)
ACCENT = (233, 168, 74)    # 一点暖色点缀，小尺寸下仍有辨识度

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyhbd.ttc",
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
    "/System/Library/Fonts/PingFang.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
]


def load_font(size):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    raise SystemExit("未找到中文字体，请手动指定字体路径")


def draw_glyph(img, box, font_size, rounded):
    """在 img 中心绘制『安』字与底部横线；box 为安全区边长。"""
    d = ImageDraw.Draw(img)
    w = img.size[0]
    font = load_font(font_size)
    text = "安"
    # 文字居中（用 textbbox 校正视觉重心）
    bbox = d.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(
        ((w - tw) / 2 - bbox[0], (w - th) / 2 - bbox[1] - font_size * 0.04),
        text,
        font=font,
        fill=FG,
    )
    # 底部横线：呼应"标准/条文"的视觉，48px 下也不会糊成一片
    line_w = int(box * 0.30)
    line_h = max(2, int(box * 0.032))
    y = int(w / 2 + font_size * 0.58)
    x0 = (w - line_w) // 2
    d.rounded_rectangle([x0, y, x0 + line_w, y + line_h], radius=line_h // 2, fill=ACCENT)


def make(size, rounded, maskable, name):
    img = Image.new("RGBA", (size, size), BG + (255,))
    if rounded and not maskable:
        # 圆角矩形 + 透明四角，桌面图标更精致
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        ImageDraw.Draw(img).rounded_rectangle(
            [0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=BG + (255,)
        )
    # maskable 需把内容压到中间 80% 安全区内
    box = int(size * (0.58 if maskable else 0.70))
    draw_glyph(img, box, int(box * 0.82), rounded)
    img.save(os.path.join(OUT, name))
    print("wrote", name, size)


def main():
    os.makedirs(OUT, exist_ok=True)
    make(192, True, False, "icon-192.png")
    make(512, True, False, "icon-512.png")
    make(192, True, True, "icon-maskable-192.png")
    make(512, True, True, "icon-maskable-512.png")
    make(180, False, True, "apple-touch-icon.png")


if __name__ == "__main__":
    main()
