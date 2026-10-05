# The office map

The layout of the office lives in one JSON file in VirtualOffice's own format: [`assets/map/office.json`](../assets/map/office.json). The server reads and checks it at start, uses its computers, spawn point and media zones, and serves it at `GET /map.json`; the 3D client loads it from there before it draws the office, so both always use the same map. The map editor in the browser edits files of this format, and `npm run validate-map` checks them.

The format and its checks are in [`types/map/`](../types/map): `format.ts` (types), `catalog.ts` (the assets a map can place), `validate.ts` (the checks) and `serialize.ts` (the layout the files are written in).

## Units and coordinates

Everything is measured in **tiles**: `x` grows to the east (right), `y` to the south (down), `(0, 0)` is the top left corner of the map. Fractions are allowed (`25.8125`). The 3D world uses the same numbers (world x = x, world z = y); the camera looks from the south-east.

On the network the server and the clients still use _map pixels_, 32 per tile (`tileSize`): media zones are compared with player positions in pixels, and a player position is the centre of the former 2D sprite, 19 px above the feet. The server converts the map's zones and spawn point (see `officeMapInfo` in `types/OfficeMap.ts`).

## The file

```json
{
  "format": "virtualoffice-map",
  "version": 1,
  "name": "VirtualOffice",
  "tileSize": 32,
  "width": 54,
  "height": 38,
  "tileTypes": {
    ".": { "kind": "void", "name": "Leer" },
    "#": { "kind": "wall", "name": "Wand", "color": "#efe8f5" },
    "g": { "kind": "floor", "name": "Flur", "color": "#eeeae4" }
  },
  "tiles": ["......", ".####.", ".#gg#.", "…"],
  "spawn": { "x": 36.03125, "y": 16.21875 },
  "labels": [{ "id": "flur", "text": "Flur", "x": 30, "y": 13 }],
  "zones": [
    { "id": "1435", "name": "Library", "type": "quiet", "x": 2, "y": 26, "w": 31, "h": 10 }
  ],
  "assets": [],
  "placements": [
    { "id": "plant-1", "asset": "plant", "x": 46, "y": 3, "w": 1, "h": 1 },
    {
      "id": "334",
      "asset": "chair",
      "x": 24,
      "y": 19,
      "w": 1,
      "h": 1,
      "rotation": 0,
      "color": "#c3d2ee"
    },
    {
      "id": "desk-1",
      "asset": "desk",
      "x": 43,
      "y": 3,
      "w": 2,
      "h": 4,
      "solid": ["##", "#.", "#.", "##"]
    }
  ]
}
```

| Field             | Meaning                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| `format`          | always `"virtualoffice-map"`                                                                          |
| `version`         | `1`. A file of a newer version is refused with a message saying so.                                   |
| `name`            | shown in the editor, up to 80 characters                                                              |
| `tileSize`        | `32`, the map pixels per tile of the network protocol                                                 |
| `width`, `height` | the size in tiles, 1 to 256 each                                                                      |
| `tileTypes`       | the legend of `tiles`: one visible ASCII character per type (not space, `"` or `\`), at most 64 types |
| `tiles`           | `height` strings of `width` characters, one per tile, each a key of `tileTypes`                       |
| `spawn`           | where players appear: the position of the feet; must be on a floor tile                               |
| `labels`          | room names shown on the floor (`id`, `text`, `x`, `y`)                                                |
| `zones`           | media zones (below)                                                                                   |
| `assets`          | assets the map brings along, i.e. local 3D models (below); usually empty                              |
| `placements`      | everything placed on the map (below)                                                                  |

Unknown properties are errors (a typo like `"colour"` is reported instead of silently ignored). Ids are letters, digits, `-`, `_` and `.` (up to 64 characters, starting with a letter or digit) and unique within their list; computer and zone ids end up in media room names.

### Tile types: floor, walls and void

| `kind`  | Walkable | Drawn as                                                                                         |
| ------- | -------- | ------------------------------------------------------------------------------------------------ |
| `floor` | yes      | a floor tile in `color` (with a slight checker pattern)                                          |
| `wall`  | no       | a toy wall in `color`; walls that would hide the floor behind them are cut down in the 3D client |
| `void`  | no       | nothing (outside of the office); no `color`                                                      |

### Media zones

`{ "id", "name", "type", "x", "y", "w", "h" }`, a rectangle in tiles inside the map. The type decides who hears whom (`types/Media.ts`); outside of all zones people hear the people close to them.

| `type`       | In the zone                                                        |
| ------------ | ------------------------------------------------------------------ |
| `meeting`    | everyone in the zone hears and sees everyone in it, nobody outside |
| `focus`      | the same, meant for small rooms                                    |
| `quiet`      | no video and no audio at all (the library)                         |
| `auditorium` | everyone hears the stage, the audience itself doesn't speak        |
| `stage`      | speaks to the whole auditorium it lies in                          |

Where zones overlap, the smallest one counts (a stage inside an auditorium).

### Placements

| Field              | Meaning                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`               | unique id; chairs, computers and vending machines are used by it                                                                                                               |
| `asset`            | a built-in asset (below) or one of the map's `assets`                                                                                                                          |
| `x`, `y`, `w`, `h` | the footprint in tiles, inside the map. `w` and `h` are in map orientation: a table turned by 90° that is 2 × 3 on the map has `w: 2, h: 3`                                    |
| `rotation`         | where the front faces: `0` south (towards the camera, default), `90` east, `180` north, `270` west. For chairs it is where a sitting person looks.                             |
| `color`            | `#rrggbb` for assets that can be tinted (chairs, pictures, blocks)                                                                                                             |
| `collides`         | whether the footprint blocks walking; default: the asset's                                                                                                                     |
| `solid`            | only for whole-tile footprints: which tiles block, one string per row of `w` characters, `#` blocks and `.` is free (an L-shaped desk). Without it the whole footprint blocks. |

What blocks walking: wall and void tiles, and the footprints (or `solid` tiles) of colliding placements. The 3D client checks this on a grid of quarter tiles, like before.

Wall assets (pictures, screens) are placed on wall tiles and hang on the south face of the wall below their footprint, where the floor begins.

### Built-in assets

The catalog (`types/map/catalog.ts`) lists the procedural toy furniture of the 3D client; the editor shows it as its palette.

| Asset            | Name                  | Default size | Blocks | Notes                                                       |
| ---------------- | --------------------- | ------------ | ------ | ----------------------------------------------------------- |
| `chair`          | Stuhl                 | 1 × 1        | no     | can be sat on (E or click); `rotation`, `color`             |
| `table`          | Tisch                 | 3 × 2        | yes    | resizable                                                   |
| `desk`           | Schreibtisch          | 2 × 2        | yes    | drawn from its blocking tiles, so `solid` shapes it         |
| `poolTable`      | Billardtisch          | 4 × 3        | yes    |                                                             |
| `bookshelf`      | Bücherregal           | 3 × 1        | yes    | one shelf per ~3 tiles of width                             |
| `lowShelf`       | Niedriges Regal       | 2 × 2        | yes    |                                                             |
| `shelf`          | Regal                 | 2 × 1        | yes    |                                                             |
| `cabinet`        | Schrank               | 2 × 2        | yes    | tall from a depth of 2 tiles                                |
| `boxes`          | Kartons               | 3 × 2        | yes    |                                                             |
| `computer`       | Computer-Arbeitsplatz | 3 × 2        | yes    | screen sharing (R or click); monitors face the chairs at it |
| `vendingMachine` | Getränkeautomat       | 1.5 × 0.75   | yes    | drinks (R or click)                                         |
| `printer`        | Drucker               | 2 × 2        | yes    |                                                             |
| `waterCooler`    | Wasserspender         | 1 × 1        | yes    |                                                             |
| `plant`          | Pflanze               | 1 × 1        | yes    | big from 2 tiles of width or 3 of depth                     |
| `globe`          | Globus                | 1 × 1        | yes    |                                                             |
| `block`          | Block                 | 1 × 1        | yes    | a plain box in `color`                                      |
| `picture`        | Bild                  | 2 × 2        | no     | on a wall, `color` is the picture                           |
| `tv`             | Bildschirm            | 2 × 2        | no     | on a wall                                                   |
| `blocker`        | Unsichtbare Sperre    | 1 × 1        | yes    | not drawn, only blocks the way                              |

### Assets of the map: local 3D models

A map can register its own assets, for now glTF models:

```json
"assets": [
  { "id": "sofa", "name": "Sofa", "category": "seating", "w": 2, "h": 1, "collides": true, "model": { "src": "furniture/sofa.glb", "scale": 0.5 } }
]
```

`category` is one of `seating`, `tables`, `storage`, `tech`, `decor`, `wall`, `other`; `mount` (`floor` or `wall`) is optional. An asset can't take the id of a built-in one. `model.src` must be a relative path to a `.glb` or `.gltf` file **below the client's `models/` folder** (`client-3d/public/models/` in the repository, so it is part of the build): no URL, no scheme, no absolute path, no `.` or `..` segments, no query. When the client loads a model, it also refuses every file the model itself refers to outside of `models/`. A model that can't be loaded is drawn as a plain box in its footprint. No models ship with VirtualOffice yet.

## Checks

The same checks run in the server (at start: a broken map stops it with the list of problems), in the client (for what the server sends) and in the editor (for every imported file):

- every problem names its place in the file, e.g. `placements[3].asset: unknown asset "sofa" (built in: chair, …; or define it in "assets")`;
- the structure: required fields, types, unknown properties, unique ids, colours as `#rrggbb`;
- geometry: everything inside the map, positive sizes, `solid` masks matching their footprint, the spawn on a floor tile;
- references: tile characters known in `tileTypes`, placements only of registered assets, model paths local;
- limits: 256 × 256 tiles, 5000 placements, 200 zones and labels, 100 assets, 5 MB per file.

Tiled maps are recognized and refused with a hint; VirtualOffice no longer reads them.

```bash
npm run validate-map                    # assets/map/office.json
npm run validate-map -- ~/my-office.json
```

The editor also points out what isn't an error but players would notice: chairs, computers or vending machines that can't be reached from the spawn, a spawn blocked by furniture, furniture standing in walls, and pictures without a wall.

## The map editor

Open `/?editor` (e.g. http://localhost:3100/?editor with `npm run dev`, or on the deployed server), or ⚙️ → „Karteneditor öffnen“ in the office. It edits a copy of the map in the browser and never writes to the server.

- **Start**: the map the server uses (`/map.json`), or the draft of your last visit. „Karte des Servers laden“ starts over from the server's map, „Neu“ with an empty room.
- **Tools** (left): Auswählen (select, drag to move, the corner handle resizes), Pinsel (paint tiles with the chosen floor/wall/void), Rechteck (fill a rectangle), Raum (walls around, floor inside), Medienzone (draw a zone), Raumschild (place a room label), Startpunkt (set the spawn).
- **Palette**: the floor and wall types of the map, and every asset of the catalog (searchable); click one, then click on the map to place it.
- **Inspector** (right): position, size, rotation, collision on/off, colour and the blocking tiles of the selection; zone name and type; the map's name, size and tile types; the checks.
- **Keys**: `R` turns clockwise (Shift+R the other way), arrow keys move by a tile (Shift: a quarter), `Entf` deletes, `Strg+D` duplicates, `Strg+Z` / `Strg+Umschalt+Z` undo and redo, `V` select, `B` brush, `Esc` deselects. Alt while dragging or placing snaps to quarter tiles.
- **Kollision & Erreichbarkeit** shows what blocks walking (red) and free places nobody can get to (orange), computed by the game's own collision code.
- **3D-Vorschau** draws the draft with the components of the office.
- **Drafts** are kept in the browser (localStorage) after every change. **Exportieren** downloads the map as a file (only without errors), **Importieren** loads a file after checking it, and lists the problems of a broken one.

## Putting an edited map into the office

The editor only produces a file. To use it:

1. Export it and check it: `npm run validate-map -- ~/Downloads/virtualoffice.json`.
2. Either **replace `assets/map/office.json`** with it and rebuild/redeploy (the Docker image contains it, and the client has it built in as a fallback), or **mount it into the running image** and point the server to it, without rebuilding:

   ```bash
   docker run -d -p 2567:2567 -v "$PWD/my-office.json:/maps/office.json:ro" \
     -e OFFICE_MAP_PATH=/maps/office.json virtualoffice
   ```

3. Restart the server. It reads the map only at start (a restart disconnects everyone in the office). The clients get the new map from `/map.json` when they load the page.

Without a reachable server (only the client's dev server runs) the client shows the map built into it.

## Where the office layout comes from

The office layout was migrated from a previously used Tiled-authored map into VirtualOffice's native format. This repository ships no source tilesets or pixel art; the current office uses procedural 3D assets and newly selected colours.

The conversion kept the behaviour of the former office exactly (checked by `client-3d/test/officeMigration.test.ts`: the same walkable floor, the same collision on the quarter-tile grid, chairs, computers, zones and spawn) and fixed a few things on the way: the vending machine now stands against its wall instead of floating in front of it, two tables that blocked the way without being drawn are now visible, a picture of the lounge that was drawn as a plant inside the wall is a picture again, and two "pictures" made from wall edges are gone.
