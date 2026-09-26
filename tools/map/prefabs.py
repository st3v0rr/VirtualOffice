"""Furniture groups cut out of the original SkyOffice map (tools/map/template.json).

Rectangles are in pixels of the original map: x0, y0, x1, y1.
"""
from mapkit import Prefab

RECTS = {
    'desks_3': (940, 400, 1260, 590),
    'desks_2': (940, 670, 1260, 835),
    'meeting_table': (250, 580, 545, 745),
    'pool_table': (230, 235, 345, 320),
    'bar': (440, 220, 580, 320),
    'water_cooler': (575, 140, 610, 205),
    'blue_chairs': (220, 370, 320, 415),
    'dark_chairs': (475, 370, 610, 415),
    'plant_tall': (1210, 255, 1250, 335),
    'plant_small': (190, 340, 222, 380),
    'printer': (805, 850, 860, 905),
    'boxes': (1155, 865, 1250, 925),
    'manager_desk': (925, 95, 995, 215),
    'sofa': (640, 75, 735, 125),
    'shelf': (1025, 270, 1090, 335),
}


def load_prefabs(template):
    return {name: Prefab(template, *rect) for name, rect in RECTS.items()}
