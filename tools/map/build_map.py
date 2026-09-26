"""Generates the office map (client/public/assets/map/map.json).

    python3 tools/map/build_map.py

The layout is sized for everyday use by 20-30 people and events (barcamps) with up to
250 people: an auditorium, four session rooms with a stage, meeting rooms, focus booths,
a library, two open spaces, kitchen, lounge and a large foyer.

Tiles are 32px; all coordinates below are in tiles. After generating, the map can be
refined in Tiled (it opens map.json directly).
"""

import json
from pathlib import Path

from mapkit import DECORATION, FLOORS, FURNITURE, TEMPLATE_MAP, OfficeMap
from prefabs import load_prefabs

OUTPUT = Path(__file__).resolve().parents[2] / 'client' / 'public' / 'assets' / 'map' / 'map.json'

WIDTH, HEIGHT = 100, 72

# image paths relative to map.json, so Tiled can open the map
TILESET_IMAGES = {
    'FloorAndGround': 'FloorAndGround.png',
    'chair': '../items/chair.png',
    'Modern_Office_Black_Shadow': '../tileset/Modern_Office_Black_Shadow.png',
    'Generic': '../tileset/Generic.png',
    'computer': '../items/computer.png',
    'whiteboard': '../items/whiteboard.png',
    'Basement': '../tileset/Basement.png',
    'vendingmachine': '../items/vendingmachine.png',
    'Classroom_and_library': '../tileset/Classroom_and_library.png',
}


def prepare_tilesets(office):
    last = max(office.tilesets, key=lambda t: t['firstgid'])
    office.tilesets.append(
        {
            'columns': 16,
            'firstgid': last['firstgid'] + last['tilecount'],
            'image': '',
            'imageheight': 1088,
            'imagewidth': 512,
            'margin': 0,
            'name': 'Classroom_and_library',
            'spacing': 0,
            'tilecount': 544,
            'tileheight': 32,
            'tilewidth': 32,
        }
    )
    for tileset in office.tilesets:
        tileset['image'] = TILESET_IMAGES[tileset['name']]


# --- furniture from the tilesets: (tileset, row, col, width, height) --------------------

SOFA_GREY = ('Basement', 0, 3, 3, 2)
SOFA_WHITE = ('Basement', 0, 6, 3, 2)
SOFA_BROWN = ('Basement', 0, 9, 3, 2)
ROUND_TABLE = ('Basement', 1, 0, 3, 2)
PING_PONG = ('Basement', 12, 0, 3, 4)
ARCADE = ('Basement', 41, 0, 2, 3)
BEANBAG_WHITE = ('Basement', 42, 12, 2, 2)
BEANBAG_BEIGE = ('Basement', 42, 14, 2, 2)
TV_WALL = ('Basement', 29, 12, 2, 2)
TV_CONSOLE = ('Basement', 47, 6, 5, 3)
ARMCHAIR_WHITE = ('Basement', 33, 2, 2, 2)
ARMCHAIR_BLUE = ('Basement', 33, 6, 2, 2)
ARMCHAIR_YELLOW = ('Basement', 33, 8, 2, 2)
BENCH_BROWN = ('Basement', 14, 6, 4, 2)
BENCH_GREEN = ('Basement', 14, 10, 4, 2)
STOOL = ('Basement', 14, 14, 1, 2)
KITCHEN_COUNTER = ('Generic', 67, 0, 8, 2)
KITCHEN_CUPBOARD = ('Generic', 70, 0, 8, 2)
PLANT_BIG = ('Generic', 56, 8, 2, 3)
PLANT_SMALL = ('Generic', 57, 6, 1, 2)
BOOKSHELF_TALL = ('Classroom_and_library', 22, 0, 3, 4)
BOOKSHELF_TALL_LIGHT = ('Classroom_and_library', 26, 0, 3, 4)
BOOKSHELF_LOW = ('Classroom_and_library', 7, 4, 2, 2)
READING_DESK = ('Classroom_and_library', 1, 5, 2, 2)
GLOBE = ('Classroom_and_library', 1, 13, 1, 2)
BLACKBOARD = ('Classroom_and_library', 5, 13, 2, 2)


def place(office, item, tx, ty, layer=FURNITURE):
    tileset, row, col, w, h = item
    office.block(layer, tileset, row, col, w, h, tx, ty)


def build():
    office = OfficeMap(WIDTH, HEIGHT)
    prepare_tilesets(office)
    prefabs = load_prefabs(json.loads(TEMPLATE_MAP.read_text()))

    # the building: everything not inside a room is foyer and corridors
    office.fill_floor(0, 0, WIDTH, HEIGHT, FLOORS['hall'])
    office.room(0, 0, WIDTH, HEIGHT, 'foyer', 'beige')

    auditorium(office)
    for index, (x, y) in enumerate([(41, 2), (59, 2), (41, 19), (59, 19)], start=1):
        session_room(office, index, x, y)
    library(office)
    large_meeting_room(office, prefabs)
    open_space_west(office, prefabs)
    open_space_east(office, prefabs)
    kitchen(office, prefabs)
    meeting_rooms(office, prefabs)
    lounge(office, prefabs)
    foyer(office, prefabs)

    OUTPUT.write_text(json.dumps(office.to_json(), indent=1) + '\n')
    counts = {name: len(objects) for name, objects in office.layers.items()}
    print(f'wrote {OUTPUT.name}: {WIDTH}x{HEIGHT} tiles, {counts}')


def auditorium(office):
    """Keynotes and plenary sessions: about 300 seats facing a stage."""
    x, y, w, h = office.room(1, 2, 37, 32, 'carpet', 'blue')
    office.fill(8, 4, 23, 6, FLOORS['stage'])
    office.zone('Auditorium', 'auditorium', x + 1, y + 2, w - 2, h - 3)
    office.zone('Auditorium Stage', 'stage', 8, 4, 23, 6)

    # on the wall behind the stage: two whiteboards and two screens
    office.whiteboard(10, 3)
    office.whiteboard(27, 3)
    place(office, TV_WALL, 17, 2, DECORATION)
    place(office, TV_WALL, 20, 2, DECORATION)
    for tx in (3, 34):
        place(office, PLANT_BIG, tx, 4)

    # 10 rows of 2 x 15 seats with an aisle in the middle
    for ty in range(12, 32, 2):
        for tx in list(range(3, 18)) + list(range(21, 36)):
            office.chair(tx, ty, 'up')

    office.door(17, 33, 5, 1, 'carpet')
    office.door(37, 20, 1, 3, 'carpet')


def session_room(office, index, x, y):
    """Barcamp sessions: a small stage and 48 seats."""
    faces = ['purple', 'green', 'red', 'wood']
    office.room(x, y, 18, 15, 'session', faces[index - 1])
    office.fill(x + 5, y + 2, 8, 3, FLOORS['stage'])
    office.zone(f'Session Room {index}', 'auditorium', x + 1, y + 2, 16, 12)
    office.zone(f'Session Room {index} Stage', 'stage', x + 5, y + 2, 8, 3)

    office.whiteboard(x + 2, y + 1)
    place(office, TV_WALL, x + 8, y, DECORATION)
    place(office, PLANT_SMALL, x + 15, y + 2)

    for ty in range(y + 7, y + 14, 2):
        for tx in list(range(x + 2, x + 8)) + list(range(x + 10, x + 16)):
            office.chair(tx, ty, 'up')

    office.door(x + 8, y + 14, 2, 1, 'session')


def library(office):
    """Quiet zone without video: shelves, reading desks and a globe."""
    x, y, w, h = office.room(79, 2, 20, 16, 'wood', 'wood')
    office.zone('Library', 'quiet', x + 1, y + 2, w - 2, h - 3)
    for tx in (81, 84, 90, 93):
        place(office, BOOKSHELF_TALL, tx, 4)
    place(office, BLACKBOARD, 87, 2, DECORATION)
    for tx in (81, 85, 89, 93):
        place(office, BOOKSHELF_LOW, tx, 9)
    for tx, ty in [(82, 12), (86, 12), (90, 12), (94, 12)]:
        place(office, READING_DESK, tx, ty)
    place(office, GLOBE, 97, 14)
    place(office, PLANT_SMALL, 80, 14)
    office.door(79, 9, 1, 2, 'wood')
    office.door(88, 17, 2, 1, 'wood')


def large_meeting_room(office, prefabs):
    x, y, w, h = office.room(79, 19, 20, 15, 'meeting', 'grey')
    office.zone('Large Meeting Room', 'meeting', x + 1, y + 2, w - 2, h - 3)
    office.prefab(prefabs['meeting_table'], 83, 24)
    office.whiteboard(82, 20)
    place(office, TV_WALL, 91, 19, DECORATION)
    place(office, PLANT_BIG, 96, 21)
    office.door(79, 25, 1, 2, 'meeting')
    office.door(88, 33, 2, 1, 'meeting')


def open_space_west(office, prefabs):
    office.room(1, 37, 30, 20, 'office', 'grey')
    office.prefab(prefabs['desks_3'], 3, 40)
    office.prefab(prefabs['desks_3'], 16, 40)
    office.prefab(prefabs['desks_2'], 3, 48)
    office.prefab(prefabs['desks_2'], 16, 48)
    office.whiteboard(11, 38)
    office.prefab(prefabs['printer'], 26, 53)
    office.prefab(prefabs['water_cooler'], 27, 38)
    place(office, PLANT_BIG, 2, 53)
    # doors: foyer, hall above and kitchen below
    office.door(30, 45, 1, 3, 'office')
    office.door(14, 37, 2, 2, 'office')
    office.door(14, 56, 2, 1, 'office')


def open_space_east(office, prefabs):
    office.room(69, 37, 30, 20, 'office', 'grey')
    office.prefab(prefabs['desks_3'], 71, 40)
    office.prefab(prefabs['desks_2'], 71, 48)
    office.whiteboard(80, 38)
    office.prefab(prefabs['boxes'], 80, 53)
    place(office, PLANT_BIG, 83, 53)
    office.door(69, 45, 1, 3, 'office')
    office.door(76, 37, 2, 2, 'office')

    # four focus booths, each with a computer for screen sharing
    booths = [(86, 39), (92, 39), (86, 47), (92, 47)]
    for index, (bx, by) in enumerate(booths, start=1):
        office.room(bx, by, 6, 7, 'focus', 'blue')
        office.zone(f'Focus Booth {index}', 'focus', bx + 1, by + 2, 4, 4)
        office.computer(bx + 1, by + 4, index % 5)
    office.door(86, 42, 1, 2, 'focus')
    office.door(94, 45, 2, 1, 'focus')
    office.door(86, 50, 1, 2, 'focus')
    office.door(94, 47, 2, 2, 'focus')


def kitchen(office, prefabs):
    office.room(1, 57, 30, 14, 'tiles', 'kitchen')
    place(office, KITCHEN_COUNTER, 3, 59)
    place(office, KITCHEN_CUPBOARD, 11, 59)
    office.vending_machine(21 * 32, 61 * 32 - 8)
    office.prefab(prefabs['bar'], 24, 59)
    for tx, ty in [(4, 63), (10, 63), (16, 63), (4, 67), (10, 67), (16, 67)]:
        place(office, ROUND_TABLE, tx, ty)
        office.chair(tx - 1, ty + 1, 'right')
        office.chair(tx + 3, ty + 1, 'left')
    office.prefab(prefabs['water_cooler'], 27, 66)
    place(office, PLANT_SMALL, 28, 68)
    office.door(14, 57, 2, 2, 'tiles')
    office.door(30, 61, 1, 3, 'tiles')


def meeting_rooms(office, prefabs):
    x, y, w, h = office.room(33, 57, 13, 14, 'meeting', 'red')
    office.zone('Meeting Room', 'meeting', x + 1, y + 2, w - 2, h - 3)
    office.prefab(prefabs['meeting_table'], 34, 61)
    office.whiteboard(35, 58)
    office.door(38, 57, 2, 2, 'meeting')

    x, y, w, h = office.room(55, 57, 13, 14, 'meeting', 'green')
    office.zone('Small Meeting Room', 'meeting', x + 1, y + 2, w - 2, h - 3)
    place(office, ROUND_TABLE, 60, 63)
    office.chair(59, 64, 'right')
    office.chair(63, 64, 'left')
    office.chair(61, 62, 'down')
    office.chair(61, 66, 'up')
    office.whiteboard(57, 58)
    place(office, PLANT_SMALL, 65, 60)
    office.door(60, 57, 2, 2, 'meeting')


def lounge(office, prefabs):
    office.room(69, 57, 30, 14, 'lounge', 'lounge')
    office.prefab(prefabs['pool_table'], 72, 60)
    place(office, PING_PONG, 79, 60)
    for tx in (85, 87, 89):
        place(office, ARCADE, tx, 59)
    place(office, TV_CONSOLE, 91, 59)
    place(office, SOFA_GREY, 92, 64)
    place(office, BEANBAG_WHITE, 90, 67)
    place(office, BEANBAG_BEIGE, 94, 67)
    place(office, SOFA_BROWN, 72, 66)
    place(office, ARMCHAIR_YELLOW, 76, 66)
    place(office, ROUND_TABLE, 72, 68)
    place(office, SOFA_WHITE, 81, 66)
    place(office, ARMCHAIR_WHITE, 85, 66)
    place(office, ROUND_TABLE, 81, 68)
    for tx in (75, 76, 77):
        place(office, STOOL, tx, 62)
    place(office, PLANT_BIG, 96, 59)
    office.door(69, 60, 1, 3, 'lounge')


def foyer(office, prefabs):
    """Entrance and meeting point, big enough for a crowd between sessions."""
    office.spawn(50, 64)
    # stairs down to the street
    office.fill(47, 69, 7, 1, 1)
    office.fill(47, 70, 7, 1, 65)

    # session plan for events
    office.whiteboard(43, 35)
    office.whiteboard(55, 35)
    # reception next to the entrance
    office.prefab(prefabs['manager_desk'], 52, 59)

    for tx, ty in [(34, 42), (61, 42)]:
        place(office, SOFA_GREY, tx, ty)
        place(office, ARMCHAIR_BLUE, tx - 2, ty + 2)
        place(office, ARMCHAIR_BLUE, tx + 3, ty + 2)
        place(office, ROUND_TABLE, tx, ty + 3)
    for tx, ty in [(38, 50), (54, 50)]:
        place(office, BENCH_BROWN, tx, ty)
    for tx, ty in [(32, 35), (66, 35), (32, 54), (66, 54), (45, 66), (53, 66)]:
        place(office, PLANT_BIG, tx, ty)


if __name__ == '__main__':
    build()
