"""Genera los iconos de Ahorra+ (logo premium negro + dorado) usando Pillow."""
import math
from PIL import Image, ImageDraw, ImageFilter

SS = 2048          # sup Sample: dibujamos en 2048 y bajamos a 1024
OUT = 1024
GOLD_L = (247, 220, 138)
GOLD_M = (232, 179, 75)
GOLD_D = (150, 104, 28)
GOLD_E = (110, 74, 18)
BG_T = (40, 40, 46)
BG_B = (7, 7, 9)
INK = (16, 16, 20)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def make_logo(maskable=False):
    S = SS
    img = Image.new("RGB", (S, S), BG_B)
    d = ImageDraw.Draw(img)

    # ---- Fondo: degradado vertical negro
    grad = Image.linear_gradient("L").rotate(180).resize((S, S))
    top_solid = Image.new("RGB", (S, S), BG_T)
    bot_solid = Image.new("RGB", (S, S), BG_B)
    img = Image.composite(top_solid, bot_solid, grad)
    d = ImageDraw.Draw(img)

    # ---- Halo radial dorado sutil detrás de la moneda
    halo = Image.new("L", (S, S), 0)
    hd = ImageDraw.Draw(halo)
    cx, cy, r = S // 2, int(S * 0.53), int(S * 0.42)
    hd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=70)
    halo = halo.filter(ImageFilter.GaussianBlur(S * 0.1))
    gold_layer = Image.new("RGB", (S, S), (120, 90, 30))
    img = Image.composite(gold_layer, img, halo.point(lambda p: p))
    d = ImageDraw.Draw(img)

    # ---- Moneda (degradado radial dorado)
    ccx, ccy, cr = S // 2, int(S * 0.54), int(S * 0.30)
    rg = Image.radial_gradient("L").resize((cr * 2, cr * 2))
    # invertir el degradado radial: claro en el centro-superior izquierda
    rg = rg.point(lambda p: 255 - p)
    coin_dark = Image.new("RGB", (cr * 2, cr * 2), GOLD_D)
    coin_light = Image.new("RGB", (cr * 2, cr * 2), GOLD_L)
    coin = Image.composite(coin_light, coin_dark, rg)
    #融合 intermedio: mezclar con dorado medio al 40%
    coin = Image.blend(coin, Image.new("RGB", (cr * 2, cr * 2), GOLD_M), 0.42)
    mask = Image.new("L", (cr * 2, cr * 2), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, cr * 2 - 1, cr * 2 - 1], fill=255)
    img.paste(coin, (ccx - cr, ccy - cr), mask)

    # borde / canto de la moneda
    d.ellipse([ccx - cr, ccy - cr, ccx + cr, ccy + cr], outline=GOLD_E, width=int(S * 0.014))
    # anillo interior con relieve
    d.ellipse([ccx - cr + S*0.052, ccy - cr + S*0.052, ccx + cr - S*0.052, ccy + cr - S*0.052],
              outline=(255, 245, 200, 255), width=int(S * 0.009))

    # Brillo tipo esmalte arriba-izquierda de la moneda
    glow = Image.new("L", (S, S), 0)
    gd = ImageDraw.Draw(glow)
    gd.ellipse([ccx - cr*0.75, ccy - cr*0.95, ccx + cr*0.35, ccy - cr*0.15], fill=110)
    glow = glow.filter(ImageFilter.GaussianBlur(S * 0.03))
    white = Image.new("RGB", (S, S), (255, 250, 230))
    img = Image.composite(white, img, glow)
    d = ImageDraw.Draw(img)

    # ---- Flecha de crecimiento (tinta negra) sobre la moneda
    w = int(S * 0.042)
    pts = [(ccx - cr*0.52, ccy + cr*0.42),
           (ccx - cr*0.05, ccy + cr*0.02),
           (ccx + cr*0.20, ccy + cr*0.22),
           (ccx + cr*0.52, ccy - cr*0.30)]
    # caps redondeadas
    for p in (pts[0], pts[1], pts[2]):
        d.ellipse([p[0]-w//2, p[1]-w//2, p[0]+w//2, p[1]+w//2], fill=INK)
    d.line(pts, fill=INK, width=w, joint="curve")
    # punta de flecha
    (x0, y0), (x1, y1) = pts[2], pts[3]
    ang = math.atan2(y1 - y0, x1 - x0)
    L, W = int(S*0.10), int(S*0.062)
    tip = (x1 + math.cos(ang)*L, y1 + math.sin(ang)*L)
    b1 = (x1 + math.cos(ang + math.pi*0.82)*W, y1 + math.sin(ang + math.pi*0.82)*W)
    b2 = (x1 + math.cos(ang - math.pi*0.82)*W, y1 + math.sin(ang - math.pi*0.82)*W)
    d.polygon([tip, b1, b2], fill=INK)
    d.ellipse([x1-w//2, y1-w//2, x1+w//2, y1+w//2], fill=INK)

    # ---- Monedas pequeñas apiladas abajo (referencia ahorro)
    eo = int(S*0.045)  # offset entre monedas apiladas
    er = int(S*0.075)
    eb_x, eb_y = ccx - cr*0.62, ccy + cr*0.98
    for i in range(2):
        yy = eb_y - i*eo
        d.ellipse([eb_x - er, yy - er*0.62, eb_x + er, yy + er*0.62], fill=GOLD_M, outline=GOLD_E, width=int(S*0.006))
        d.ellipse([eb_x - er + int(S*0.012), yy - er*0.62 + int(S*0.004),
                   eb_x + er - int(S*0.012), yy + er*0.62 - int(S*0.02)],
                  outline=(255, 240, 190), width=int(S*0.005))

    # ---- Destellos ✦ blancos
    def sparkle(x, y, s, alpha):
        layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        ld.polygon([(x, y - s), (x + s*0.28, y - s*0.28), (x + s, y), (x + s*0.28, y + s*0.28),
                    (x, y + s), (x - s*0.28, y + s*0.28), (x - s, y), (x - s*0.28, y - s*0.28)],
                   fill=(255, 252, 240, alpha))
        img.paste(layer, (0, 0), layer)

    sparkle(ccx + cr*0.95, ccy - cr*0.95, int(S*0.030), 230)
    sparkle(ccx - cr*1.02, ccy - cr*0.55, int(S*0.018), 160)
    sparkle(ccx + cr*0.85, ccy + cr*0.80, int(S*0.016), 140)

    # ---- Esquinas redondeadas (radio estilo iOS)
    if not maskable:
        radius = int(S * 0.22)
        m = Image.new("L", (S, S), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, S - 1, S - 1], radius=radius, fill=255)
        rgba = img.convert("RGBA")
        rgba.putalpha(m)
        return rgba.resize((OUT, OUT), Image.LANCZOS)
    # maskable: contenido centrado dentro de la zona segura
    scale = 0.82
    inner = img.resize((int(S * scale), int(S * scale)), Image.LANCZOS)
    pad = (S - inner.size[0]) // 2
    out = Image.new("RGB", (S, S), BG_B)
    out.paste(inner, (pad, pad))
    return out.resize((OUT, OUT), Image.LANCZOS)


logo = make_logo(maskable=False)
logo.save("icons/icon-1024.png")
logo.resize((512, 512), Image.LANCZOS).save("icons/icon-512.png")
logo.resize((192, 192), Image.LANCZOS).save("icons/icon-192.png")
logo.resize((180, 180), Image.LANCZOS).save("icons/icon-180.png")
logo = make_logo(maskable=True)
logo.resize((192, 192), Image.LANCZOS).save("icons/maskable-192.png")
logo.resize((512, 512), Image.LANCZOS).save("icons/maskable-512.png")
print("Iconos generados OK")
