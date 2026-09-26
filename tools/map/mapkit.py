"""Building blocks for generating the Tiled office map (walls, floors, furniture, zones)."""

import copy
import json
from pathlib import Path

TILE = 32
ASSETS = Path(__file__).resolve().parents[2] / 'client' / 'public' / 'assets'
TEMPLATE_MAP = Path(__file__).resolve().parent / 'template.json'


def gid(row, col, columns=64, firstgid=1):
    """gid of a tile in a tileset, by its row and column"""
    return firstgid + row * columns + col


# --- FloorAndGround tiles --------------------------------------------------------------

# white wall outline, a 3x3 frame
FRAME = {
    'tl': gid(1, 23), 't': gid(1, 24), 'tr': gid(1, 25),
    'l': gid(2, 23), 'r': gid(2, 25),
    'bl': gid(3, 23), 'b': gid(3, 24), 'br': gid(3, 25),
}  # fmt: skip

# wall faces, two tiles high: (upper, lower)
FACES = {
    'beige': (gid(22, 33), gid(23, 33)),
    'grey': (gid(30, 33), gid(31, 33)),
    'wood': (gid(26, 43), gid(27, 43)),
    'red': (gid(22, 43), gid(23, 43)),
    'blue': (gid(34, 43), gid(35, 43)),
    'kitchen': (gid(30, 55), gid(31, 55)),
    'green': (gid(26, 55), gid(27, 55)),
    'purple': (gid(36, 43), gid(37, 43)),
    'brick': (gid(9, 17), gid(10, 17)),
    'lounge': (gid(8, 33), gid(9, 33)),
}

FLOORS = {
    'office': gid(6, 27),
    'hall': gid(6, 30),
    'foyer': gid(31, 14),
    'carpet': gid(31, 10),
    'stage': gid(27, 14),
    'session': gid(35, 10),
    'meeting': gid(37, 14),
    'wood': gid(29, 2),
    'tiles': gid(29, 14),
    'lounge': gid(25, 6),
    'focus': gid(17, 10),
}

# chair frames in items/chair.png by the direction the player faces when sitting
CHAIR = {'down': 1, 'up': 5, 'left': 2, 'right': 3}

# decoration layers: collides or not (see LEGACY_COLLIDING_LAYERS / `collides` in Game.ts)
DECORATION = 'Decoration'
FURNITURE = 'Furniture'


class OfficeMap:
    def __init__(self, width, height):
        self.width = width
        self.height = height
        template = json.loads(TEMPLATE_MAP.read_text())
        self.tilesets = template['tilesets']
        # floor below the walls, so the transparent parts of wall tiles show floor
        self.floor = [0] * (width * height)
        self.ground = [0] * (width * height)
        self.layers = {
            name: []
            for name in [
                DECORATION,
                FURNITURE,
                'Chair',
                'Computer',
                'Whiteboard',
                'VendingMachine',
                'Spawn',
                'Zones',
            ]
        }
        self.next_id = 1

    # --- tilesets ---

    def firstgid(self, name):
        return next(t['firstgid'] for t in self.tilesets if t['name'] == name)

    def tileset_columns(self, name):
        tileset = next(t for t in self.tilesets if t['name'] == name)
        return tileset['columns']

    # --- ground ---

    def set_tile(self, x, y, tile):
        if 0 <= x < self.width and 0 <= y < self.height:
            self.ground[y * self.width + x] = tile

    def fill(self, x, y, w, h, tile):
        for ty in range(y, y + h):
            for tx in range(x, x + w):
                self.set_tile(tx, ty, tile)

    def fill_floor(self, x, y, w, h, tile):
        for ty in range(y, y + h):
            for tx in range(x, x + w):
                if 0 <= tx < self.width and 0 <= ty < self.height:
                    self.floor[ty * self.width + tx] = tile

    def room(self, x, y, w, h, floor, face):
        """A walled room. (x, y, w, h) is the outer rectangle in tiles, including the walls.
        The top wall is two tiles high (wall face), the other walls are one tile."""
        upper, lower = FACES[face]
        self.fill(x + 1, y + 2, w - 2, h - 3, FLOORS[floor])
        for tx in range(x + 1, x + w - 1):
            self.set_tile(tx, y, upper)
            self.set_tile(tx, y + 1, lower)
            self.set_tile(tx, y + h - 1, FRAME['b'])
        for ty in range(y + 1, y + h - 1):
            self.set_tile(x, ty, FRAME['l'])
            self.set_tile(x + w - 1, ty, FRAME['r'])
        self.set_tile(x, y, FRAME['tl'])
        self.set_tile(x + w - 1, y, FRAME['tr'])
        self.set_tile(x, y + h - 1, FRAME['bl'])
        self.set_tile(x + w - 1, y + h - 1, FRAME['br'])
        return (x, y, w, h)

    def door(self, x, y, w, h, floor):
        """An opening in a wall: the given tiles become floor."""
        self.fill(x, y, w, h, FLOORS[floor])

    # --- objects ---

    def add_object(self, layer, gid_, px, py, width, height, properties=None, **extra):
        obj = {
            'gid': gid_,
            'height': height,
            'id': self.next_id,
            'name': '',
            'rotation': 0,
            'type': '',
            'visible': True,
            'width': width,
            'x': px,
            'y': py,
        }
        if properties:
            obj['properties'] = properties
        obj.update(extra)
        self.next_id += 1
        self.layers[layer].append(obj)
        return obj

    def block(self, layer, tileset, row, col, w, h, tx, ty):
        """Place a w x h block of 32px tiles from a tileset with its top left corner at tile (tx, ty)."""
        first = self.firstgid(tileset)
        columns = self.tileset_columns(tileset)
        for dy in range(h):
            for dx in range(w):
                self.add_object(
                    layer,
                    gid(row + dy, col + dx, columns, first),
                    (tx + dx) * TILE,
                    (ty + dy + 1) * TILE,
                    TILE,
                    TILE,
                )

    def chair(self, tx, ty, direction):
        """A chair (32x64) whose lower tile is at (tx, ty)."""
        return self.add_object(
            'Chair',
            self.firstgid('chair') + CHAIR[direction],
            tx * TILE,
            (ty + 1) * TILE,
            32,
            64,
            [{'name': 'direction', 'type': 'string', 'value': direction}],
        )

    def computer(self, tx, ty, frame):
        """A computer desk (96x64), bottom left corner at tile (tx, ty + 1)."""
        return self.add_object(
            'Computer', self.firstgid('computer') + frame, tx * TILE, (ty + 1) * TILE, 96, 64
        )

    def whiteboard(self, tx, ty, frame=0):
        """A whiteboard (64x64), bottom left corner at tile (tx, ty + 1)."""
        return self.add_object(
            'Whiteboard', self.firstgid('whiteboard') + frame, tx * TILE, (ty + 1) * TILE, 64, 64
        )

    def vending_machine(self, px, py):
        return self.add_object(
            'VendingMachine', self.firstgid('vendingmachine'), px, py, 48, 72
        )

    def prefab(self, prefab, tx, ty):
        """Place a group of objects cut out of the original map (see Prefab)."""
        for layer, obj in prefab.objects:
            placed = copy.deepcopy(obj)
            placed['x'] += tx * TILE
            placed['y'] += ty * TILE
            placed['id'] = self.next_id
            self.next_id += 1
            self.layers[layer].append(placed)

    # --- zones ---

    def zone(self, name, zone_type, x, y, w, h):
        self.layers['Zones'].append(
            {
                'id': self.next_id,
                'name': name,
                'type': zone_type,
                'rotation': 0,
                'visible': True,
                'x': x * TILE,
                'y': y * TILE,
                'width': w * TILE,
                'height': h * TILE,
            }
        )
        self.next_id += 1

    def spawn(self, tx, ty):
        self.layers['Spawn'].append(
            {
                'id': self.next_id,
                'name': 'spawn',
                'point': True,
                'rotation': 0,
                'type': '',
                'visible': True,
                'width': 0,
                'height': 0,
                'x': tx * TILE + TILE / 2,
                'y': ty * TILE + TILE / 2,
            }
        )
        self.next_id += 1

    # --- output ---

    def to_json(self):
        layers = [
            {
                'data': data,
                'height': self.height,
                'id': index,
                'name': name,
                'opacity': 1,
                'type': 'tilelayer',
                'visible': True,
                'width': self.width,
                'x': 0,
                'y': 0,
            }
            for index, (name, data) in enumerate([('Floor', self.floor), ('Ground', self.ground)], 1)
        ]
        for index, (name, objects) in enumerate(self.layers.items(), start=3):
            layer = {
                'draworder': 'topdown',
                'id': index,
                'name': name,
                'objects': objects,
                'opacity': 1,
                'type': 'objectgroup',
                'visible': name != 'Zones',
                'x': 0,
                'y': 0,
            }
            if name in (DECORATION, FURNITURE):
                layer['properties'] = [
                    {'name': 'collides', 'type': 'bool', 'value': name == FURNITURE}
                ]
            layers.append(layer)
        return {
            'compressionlevel': -1,
            'height': self.height,
            'infinite': False,
            'layers': layers,
            'nextlayerid': len(layers) + 1,
            'nextobjectid': self.next_id,
            'orientation': 'orthogonal',
            'renderorder': 'right-down',
            'tiledversion': '1.11.0',
            'tileheight': TILE,
            'tilesets': self.tilesets,
            'tilewidth': TILE,
            'type': 'map',
            'version': '1.10',
            'width': self.width,
        }


# layers of the original map and whether their objects block movement
# (the wall tops of the old map are left out, walls are drawn by OfficeMap.room)
LEGACY_LAYERS = {
    'Objects': DECORATION,
    'ObjectsOnCollide': FURNITURE,
    'GenericObjects': DECORATION,
    'GenericObjectsOnCollide': FURNITURE,
    'Basement': FURNITURE,
    'Chair': 'Chair',
    'Computer': 'Computer',
    'Whiteboard': 'Whiteboard',
}


class Prefab:
    """Objects cut out of the original map, positioned relative to a tile origin."""

    def __init__(self, source, px0, py0, px1, py1, layers=None):
        self.objects = []
        # align to the tile grid so the pieces stay where they were
        ox = (px0 // TILE) * TILE
        oy = (py0 // TILE) * TILE
        for layer in source['layers']:
            target = LEGACY_LAYERS.get(layer['name'])
            if layer['type'] != 'objectgroup' or not target:
                continue
            if layers and layer['name'] not in layers:
                continue
            for obj in layer['objects']:
                cx = obj['x'] + obj['width'] / 2
                cy = obj['y'] - obj['height'] / 2
                if px0 <= cx < px1 and py0 <= cy < py1:
                    moved = copy.deepcopy(obj)
                    moved['x'] -= ox
                    moved['y'] -= oy
                    self.objects.append((target, moved))
