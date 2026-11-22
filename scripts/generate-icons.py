#!/usr/bin/env python3
"""Genera los iconos de la PWA en public/icons/.

No se versionan binarios generados a mano: este script es la fuente. Dibuja el
sobre de FacBuzMoa (solapa que forma una F y check de aceptado) sobre el azul
petróleo de la marca. Para el icono maskable el contenido va dentro de la zona
segura (80% central) porque Android recorta el borde a la forma del lanzador.

Uso: python3 scripts/generate-icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

AZUL = (14, 79, 107, 255)          # #0e4f6b (azul petróleo, theme-color)
AZUL_CLARO = (26, 127, 168, 255)   # #1a7fa8
ESMERALDA = (16, 185, 129, 255)    # #10b981
CIAN = (34, 211, 238, 255)         # #22d3ee
BLANCO = (255, 255, 255, 255)

SALIDA = Path(__file__).resolve().parent.parent / "public" / "icons"

# Se dibuja a 4x y se reduce con LANCZOS para bordes suaves.
ESCALA = 4


def _sobre(draw, x0, y0, x1, y1, grosor):
    """Sobre minimalista: cuerpo, solapa con forma de F y check de aceptado."""
    r = (x1 - x0) * 0.10

    # Cuerpo del sobre.
    draw.rounded_rectangle([x0, y0, x1, y1], radius=r, outline=BLANCO, width=grosor)

    # Solapa: baja de las esquinas superiores al centro.
    cx = (x0 + x1) / 2
    y_solapa = y0 + (y1 - y0) * 0.52
    draw.line([(x0, y0 + grosor), (cx, y_solapa)], fill=BLANCO, width=grosor, joint="curve")
    draw.line([(cx, y_solapa), (x1, y0 + grosor)], fill=BLANCO, width=grosor, joint="curve")

    # La "F": trazo vertical + brazo superior, dentro de la mitad izquierda.
    fx = x0 + (x1 - x0) * 0.30
    fy0 = y0 + (y1 - y0) * 0.26
    fy1 = y0 + (y1 - y0) * 0.62
    draw.line([(fx, fy0), (fx, fy1)], fill=CIAN, width=grosor)
    draw.line([(fx, fy0), (fx + (x1 - x0) * 0.16, fy0)], fill=CIAN, width=grosor)
    draw.line([(fx, fy0 + (fy1 - fy0) * 0.45), (fx + (x1 - x0) * 0.11, fy0 + (fy1 - fy0) * 0.45)],
              fill=CIAN, width=grosor)

    # Check de aceptado, en la mitad derecha inferior.
    chx = x0 + (x1 - x0) * 0.52
    chy = y0 + (y1 - y0) * 0.70
    u = (x1 - x0)
    draw.line([(chx, chy), (chx + u * 0.10, chy + u * 0.10)], fill=ESMERALDA, width=grosor)
    draw.line([(chx + u * 0.10, chy + u * 0.10), (chx + u * 0.28, chy - u * 0.14)],
              fill=ESMERALDA, width=grosor)


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

    # El sobre es más ancho que alto: se centra en el lienzo cuadrado.
    ancho = px - 2 * margen
    alto = ancho * 0.74
    x0 = margen
    y0 = (px - alto) / 2
    _sobre(draw, x0, y0, x0 + ancho, y0 + alto, grosor=max(2, int(px * 0.030)))

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
