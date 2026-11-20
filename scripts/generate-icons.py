#!/usr/bin/env python3
"""Genera los iconos de la PWA en public/icons/.

No se versionan binarios generados a mano: este script es la fuente. Dibuja un
documento (comprobante) sobre el azul de la marca. Para el icono maskable el
contenido va dentro de la zona segura (80% central) porque Android recorta el
borde a la forma del lanzador.

Uso: python3 scripts/generate-icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

AZUL = (37, 99, 235, 255)          # #2563eb (theme-color)
AZUL_OSCURO = (30, 64, 175, 255)   # #1e40af
BLANCO = (255, 255, 255, 255)
LINEA = (191, 219, 254, 255)       # #bfdbfe

SALIDA = Path(__file__).resolve().parent.parent / "public" / "icons"

# Se dibuja a 4x y se reduce con LANCZOS para bordes suaves.
ESCALA = 4


def _documento(draw, x0, y0, x1, y1, grosor):
    """Dibuja un comprobante con esquina doblada y tres renglones."""
    doblez = (x1 - x0) * 0.28

    draw.rounded_rectangle([x0, y0, x1, y1], radius=(x1 - x0) * 0.06, fill=BLANCO)

    # Esquina superior derecha doblada (triángulo del color de fondo).
    draw.polygon(
        [(x1 - doblez, y0), (x1, y0 + doblez), (x1 - doblez, y0 + doblez)],
        fill=AZUL,
    )

    margen = (x1 - x0) * 0.18
    ancho = (x1 - x0) - 2 * margen
    alto_linea = grosor
    y = y0 + (y1 - y0) * 0.42
    for i, factor in enumerate((1.0, 0.75, 0.55)):
        draw.rounded_rectangle(
            [x0 + margen, y, x0 + margen + ancho * factor, y + alto_linea],
            radius=alto_linea / 2,
            fill=LINEA if i else AZUL_OSCURO,
        )
        y += alto_linea * 2.4


def generar(tamano, destino, maskable=False):
    px = tamano * ESCALA
    img = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    if maskable:
        draw.rectangle([0, 0, px, px], fill=AZUL)
        margen = px * 0.22
    else:
        radio = px * 0.22
        draw.rounded_rectangle([0, 0, px - 1, px - 1], radius=radio, fill=AZUL)
        margen = px * 0.26

    _documento(draw, margen, margen, px - margen, px - margen, grosor=px * 0.045)

    img = img.resize((tamano, tamano), Image.LANCZOS)
    img.save(destino, "PNG")
    print(f"  {destino.name} ({tamano}x{tamano})")


def main():
    SALIDA.mkdir(parents=True, exist_ok=True)
    print(f"Generando iconos en {SALIDA}")
    generar(192, SALIDA / "icon-192.png")
    generar(512, SALIDA / "icon-512.png")
    generar(512, SALIDA / "icon-maskable-512.png", maskable=True)
    generar(180, SALIDA / "apple-touch-icon.png")


if __name__ == "__main__":
    main()
