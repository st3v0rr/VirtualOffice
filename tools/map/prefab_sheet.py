"""Debug helper: places every prefab on its own spot and writes prefabs.json for rendering."""
import json
import sys
from pathlib import Path
from mapkit import OfficeMap, TEMPLATE_MAP
from prefabs import load_prefabs

prefabs = load_prefabs(json.loads(TEMPLATE_MAP.read_text()))
office = OfficeMap(60, 40)
office.fill(0, 0, 60, 40, 415)
x, y = 1, 1
for name, prefab in prefabs.items():
    office.prefab(prefab, x, y)
    print(name, 'at', x, y, len(prefab.objects), 'objects')
    x += 12
    if x > 48:
        x, y = 1, y + 10
Path(sys.argv[1]).write_text(json.dumps(office.to_json()))
