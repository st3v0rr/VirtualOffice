"""Render the office map to a PNG, the same way the game draws it.

Usage: uv run --with pillow python tools/map/render_map.py [map.json] [out.png] [--zones]
"""

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ASSETS = Path(__file__).resolve().parents[2] / 'client' / 'public' / 'assets'
TILE = 32

# spritesheets as loaded by the game (see client/src/scenes/Bootstrap.ts)
SHEETS = {
    'FloorAndGround': ('map/FloorAndGround.png', 32, 32),
    'chair': ('items/chair.png', 32, 64),
    'Modern_Office_Black_Shadow': ('tileset/Modern_Office_Black_Shadow.png', 32, 32),
    'Generic': ('tileset/Generic.png', 32, 32),
    'computer': ('items/computer.png', 96, 64),
    'whiteboard': ('items/whiteboard.png', 64, 64),
    'Basement': ('tileset/Basement.png', 32, 32),
    'vendingmachine': ('items/vendingmachine.png', 48, 72),
    'Classroom_and_library': ('tileset/Classroom_and_library.png', 32, 32),
}

ZONE_COLORS = {
    'meeting': (66, 234, 203),
    'focus': (66, 140, 234),
    'quiet': (120, 200, 90),
    'auditorium': (234, 170, 66),
    'stage': (234, 90, 66),
}


def render(map_path: Path, out_path: Path, show_zones: bool):
    data = json.loads(map_path.read_text())
    image = Image.new('RGBA', (data['width'] * TILE, data['height'] * TILE), (147, 203, 238, 255))
    tilesets = sorted(data['tilesets'], key=lambda t: t['firstgid'])
    cache = {}

    def frame(gid):
        tileset = [t for t in tilesets if t['firstgid'] <= gid][-1]
        file, width, height = SHEETS[tileset['name']]
        sheet = cache.setdefault(file, Image.open(ASSETS / file).convert('RGBA'))
        columns = sheet.width // width
        index = gid - tileset['firstgid']
        x, y = (index % columns) * width, (index // columns) * height
        return sheet.crop((x, y, x + width, y + height))

    objects = []
    for layer in data['layers']:
        if layer['type'] == 'tilelayer':
            for i, gid in enumerate(layer['data']):
                if gid:
                    image.alpha_composite(
                        frame(gid), ((i % layer['width']) * TILE, (i // layer['width']) * TILE)
                    )
        else:
            objects += [o for o in layer['objects'] if o.get('gid')]

    # the game sorts objects by their center y
    for obj in sorted(objects, key=lambda o: o['y'] - o['height'] / 2):
        sprite = frame(obj['gid'])
        x = int(obj['x'] + obj['width'] / 2 - sprite.width / 2)
        y = int(obj['y'] - obj['height'] / 2 - sprite.height / 2)
        image.alpha_composite(sprite, (x, y))

    if show_zones:
        overlay = Image.new('RGBA', image.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        for layer in data['layers']:
            if layer['name'] == 'Zones':
                for zone in layer['objects']:
                    color = ZONE_COLORS.get(zone.get('type'), (255, 255, 255))
                    box = (zone['x'], zone['y'], zone['x'] + zone['width'], zone['y'] + zone['height'])
                    draw.rectangle(box, fill=color + (50,), outline=color + (255,), width=3)
                    draw.text((zone['x'] + 6, zone['y'] + 4), zone['name'], fill=(0, 0, 0, 255))
            if layer['name'] == 'Spawn':
                for spawn in layer['objects']:
                    x, y = spawn['x'], spawn['y']
                    draw.ellipse((x - 10, y - 10, x + 10, y + 10), fill=(255, 0, 0, 255))
        image.alpha_composite(overlay)

    image.save(out_path)
    print(f'{out_path} {image.size[0]}x{image.size[1]}')


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    map_path = Path(args[0]) if args else ASSETS / 'map' / 'map.json'
    out_path = Path(args[1]) if len(args) > 1 else Path('map.png')
    render(map_path, out_path, '--zones' in sys.argv)
