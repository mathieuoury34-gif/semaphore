"""Génère les icônes Android (android-shell/res) à partir des icônes de la PWA (public/icons) et du pictogramme.
Lancer : python3 scripts/tools/android-icons.py  (Pillow requis)."""
from PIL import Image, ImageDraw
import os

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
ICONS = os.path.join(ROOT, 'public', 'icons')
RES = os.path.join(ROOT, 'android-shell', 'res')
BG = (43, 33, 53, 255)  # #2B2135

maskable = Image.open(os.path.join(ICONS, 'icon-512-maskable.png')).convert('RGBA')
rounded = Image.open(os.path.join(ICONS, 'icon-512.png')).convert('RGBA')

def sized(img, px): return img.resize((px, px), Image.LANCZOS)

# --- icônes de lanceur : dpi -> (taille ic_launcher, taille couche adaptative 108 dp)
DENS = {'mdpi': (48, 108), 'hdpi': (72, 162), 'xhdpi': (96, 216), 'xxhdpi': (144, 324), 'xxxhdpi': (192, 432)}
for d, (px, layer) in DENS.items():
    out = os.path.join(RES, 'mipmap-' + d); os.makedirs(out, exist_ok=True)
    sized(rounded, px).save(os.path.join(out, 'ic_launcher.png'))
    # rond : l'illustration plein cadre recadrée en disque
    big = sized(maskable, px * 4)
    mask = Image.new('L', (px * 4, px * 4), 0); ImageDraw.Draw(mask).ellipse((0, 0, px * 4 - 1, px * 4 - 1), fill=255)
    big.putalpha(mask)
    big.resize((px, px), Image.LANCZOS).save(os.path.join(out, 'ic_launcher_round.png'))
    # couche adaptative : l'illustration à 75 % sur fond uni (la zone visible, 61 %, reste à l'intérieur)
    fg = Image.new('RGBA', (layer, layer), BG)
    art = int(layer * 0.75)
    fg.paste(sized(maskable, art), ((layer - art) // 2, (layer - art) // 2))
    fg.save(os.path.join(out, 'ic_launcher_foreground.png'))

# --- pictogramme (écran de lancement) : même dessin que Picto dans src/ui/icons.tsx, viewBox 48
S = 8  # suréchantillonnage
def picto(canvas=512, fill=0.80, color=(238, 232, 247), coral=(226, 88, 62)):
    k = canvas * S / 48 * fill
    off = canvas * S * (1 - fill) / 2
    big = Image.new('RGBA', (canvas * S, canvas * S), (0, 0, 0, 0))
    def P(x, y): return (off + x * k, off + y * k)
    def layer(draw_fn, alpha=255):
        l = Image.new('RGBA', big.size, (0, 0, 0, 0)); draw_fn(ImageDraw.Draw(l))
        if alpha != 255:
            a = l.getchannel('A').point(lambda v: v * alpha // 255); l.putalpha(a)
        big.alpha_composite(l)
    layer(lambda d: d.polygon([P(24, 12.5), P(2, 6), P(2, 19)], fill=coral + (255,)), 140)
    c = color + (255,)
    layer(lambda d: d.polygon([P(19.5, 40), P(28.5, 40), P(27.2, 18), P(20.8, 18)], fill=c))
    layer(lambda d: d.rounded_rectangle([*P(17.5, 15.5), *P(30.5, 19)], radius=1 * k, fill=c))
    layer(lambda d: d.rounded_rectangle([*P(19.8, 9.5), *P(28.2, 16)], radius=1.2 * k, fill=coral + (255,)))
    def roof(d):
        d.polygon([P(18.8, 10), P(29.2, 10), P(24, 5)], fill=c)
        d.line([P(18.8, 10), P(29.2, 10), P(24, 5), P(18.8, 10)], fill=c, width=int(1.6 * k), joint='curve')
        for x, y in [(18.8, 10), (29.2, 10), (24, 5)]:
            r = 0.8 * k; X, Y = P(x, y); d.ellipse((X - r, Y - r, X + r, Y + r), fill=c)
    layer(roof)
    layer(lambda d: d.polygon([P(31.5, 40), P(31.5, 31.5), P(37, 27), P(42.5, 31.5), P(42.5, 40)], fill=c))
    layer(lambda d: d.rounded_rectangle([*P(4, 40), *P(46, 44)], radius=2 * k, fill=c))
    return big.resize((canvas, canvas), Image.LANCZOS)

os.makedirs(os.path.join(RES, 'drawable-nodpi'), exist_ok=True)
picto(512, 0.62).save(os.path.join(RES, 'drawable-nodpi', 'splash_icon.png'))
print('Icônes Android générées dans', RES)
