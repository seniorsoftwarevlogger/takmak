"""Reconstruct the photographed ZMK status UI as a 128x32 monochrome bitmap.

Usage: python3 scripts/prepare-oled.py /path/to/lvgl
Uses uncompressed 4bpp LVGL Montserrat 16/12 glyphs (including its symbols).
The photograph is a visual reference, not a texture to filter or stretch.
"""
from pathlib import Path
import json, re, sys, zlib, struct

root = Path(__file__).resolve().parents[1]
lvgl = Path(sys.argv[1])

def font(size):
    source = (lvgl / f'src/font/lv_font_montserrat_{size}.c').read_text()
    def array(name):
        raw = re.search(r'\b' + name + r'\[\]\s*=\s*\{(.*?)\};', source, re.S)[1]
        return re.sub(r'/\*.*?\*/', '', raw, flags=re.S)
    bitmap = [int(v, 16) for v in re.findall(r'0x[0-9a-fA-F]+', array('glyph_bitmap'))]
    desc = [dict((k, int(v)) for k, v in re.findall(r'\.(\w+)\s*=\s*(-?\d+)', row))
            for row in re.findall(r'\{(.*?)\}', array('glyph_dsc'), re.S)]
    sparse = [int(v, 0) for v in re.findall(r'0x[0-9a-fA-F]+|\d+', array('unicode_list_1'))]
    def glyph(char):
        cp = ord(char)
        index = cp - 32 + 1 if 32 <= cp < 127 else 96 + sparse.index(cp - 176)
        return desc[index]
    return bitmap, glyph

pixels = [[0] * 128 for _ in range(32)]

def label(text, size, x, baseline, right=False):
    bitmap, glyph = font(size)
    advance = lambda d: (d['adv_w'] + 8) // 16
    if right:
        x -= sum(advance(glyph(c)) for c in text)
    for char in text:
        d = glyph(char)
        for y in range(d['box_h']):
            for xx in range(d['box_w']):
                bit = y * d['box_w'] + xx
                byte = bitmap[d['bitmap_index'] + bit // 2]
                value = (byte >> (4 if bit % 2 == 0 else 0)) & 15
                px, py = x + d['ofs_x'] + xx, baseline - d['ofs_y'] - d['box_h'] + y
                if value >= 8:
                    assert 0 <= px < 128 and 0 <= py < 32, (char, px, py)
                    pixels[py][px] = 1
        x += advance(d)

label('\uf287', 16, 0, 15)  # USB output
label('\uf0e7 100%', 16, 128, 15, right=True)
label('\uf11c Base', 12, 0, 29)
label('0', 16, 128, 29, right=True)  # WPM

out = root / 'public/textures'
out.mkdir(exist_ok=True)
rows = [''.join(map(str, row)) for row in pixels]
(out / 'oled-status.json').write_text(json.dumps({'width':128, 'height':32, 'rows':rows}, indent=2)+'\n')
rects = ''.join(f'<rect x="{x}" y="{y}" width="1" height="1"/>'
                for y, row in enumerate(pixels) for x, value in enumerate(row) if value)
(out / 'oled-status.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="256" viewBox="0 0 128 32" shape-rendering="crispEdges"><rect width="128" height="32" fill="#08151c"/><g fill="#79e8ff">'+rects+'</g></svg>\n')
# A native-resolution, reusable PNG; no external imaging dependencies.
def chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
raw = b''.join(b'\0' + bytes(channel for pixel in row for channel in ((121,232,255) if pixel else (8,21,28))) for row in pixels)
(out / 'oled-status.png').write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR', struct.pack('>IIBBBBB',128,32,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b''))
(out / 'LVGL-LICENSE.txt').write_text((lvgl / 'LICENCE.txt').read_text())
print('OLED: 128x32,', sum(map(sum,pixels)), 'lit pixels; JSON, SVG and PNG written.')
