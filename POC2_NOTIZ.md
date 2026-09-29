# PoC 2 – Das Büro in 3D (React Three Fiber) mit Chibi-Charakter-Editor

Stand: 29.09.2026 · Branch `poc/threejs-r3f` · Paket `client-3d/` (der 2D-Client `client/` ist unverändert)

![Konferenzsaal mit 40 Bots im Pixel-Look](docs/poc2/3d-conference-40-pixel.png)

## Gesamtempfehlung

**Weiter in 3D – als Hybrid-Übergang, nicht als harter Schnitt.**

Der 3D-Client hängt am selben Colyseus-Server und spricht dasselbe Positions- und Anim-Format wie der Phaser-Client. 2D- und 3D-Spieler treffen sich also schon heute im selben Raum (getestet). Damit gibt es keinen Big Bang: Phaser bleibt der stabile Standard, der 3D-Client wächst daneben, bis er Feature-Parität hat. Die wichtigste offene Lücke ist Video/Audio mit Nähe-Logik. Danach entscheidet ein kurzer A/B-Test mit echten Nutzern (2D vs. 3D klar vs. 3D Pixel-Look), ob Phaser abgelöst wird.

Warum nicht bei Phaser bleiben: In einem autonomen Lauf waren alle P0- und P1-Punkte und der Großteil von P2 machbar. Die Performance reicht für 40 Personen auf einer integrierten Laptop-GPU mit Reserve. Und der Charakter-Editor, parametrisch statt Pixel-Sprite-Sheets, ist ein echter Gewinn, den Phaser nur mit viel Pixel-Art-Aufwand bieten könnte.

Warum nicht sofort umsteigen: Ob die Knuffigkeit wirklich trägt, müssen Nutzer beurteilen, nicht ich. Außerdem fehlen Proximity-Video und -Audio in 3D noch ganz.

## Stand der Prio-Stufen

| #     | Punkt                                                        | Stand | Anmerkung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----- | ------------------------------------------------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0.1  | `client-3d/` als Workspace, `npm run dev:client3d`           | ✅    | Vite + React 19 + R3F 9 + drei. Zusätzlich `npm run dev3d` (Server + 3D-Client), `build:client3d`. Port 3100.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| P0.2  | Colyseus-Sync: Position, Drehung, Avatar, Anim               | ✅    | Neue Player-Felder `avatar` (JSON) und `rot`, neue Messages `UPDATE_PLAYER_AVATAR`, `PLAYER_EMOTE` (ans Enum angehängt). Positionen in Map-Pixeln, Anims im 2D-Format (`lucy_run_left`) → 2D- und 3D-Spieler sehen sich gegenseitig (Node-Test + Browser).                                                                                                                                                                                                                                                                                               |
| P0.3  | Map mit allen Räumen als Toon-Diorama, Kollision aus der TMX | ✅    | Konferenzsaal (Bühne, 40 Stühle), Meetingraum, Bibliothek (Ruhezone), Lounge mit Getränkeautomat und Billard, Chefbüro, Großraumbüro, Flure. Kollision exakt aus den Tiled-Daten (Skript, s. u.).                                                                                                                                                                                                                                                                                                                                                        |
| P0.4  | Chibi aus Teilen                                             | ✅    | Prozedural aus Primitives (Quaternius liefert nur über Google Drive/itch.io, nicht skriptbar). Großer Kopf, Stummelbeine, große Augen, Bäckchen, Toon + Outline.                                                                                                                                                                                                                                                                                                                                                                                         |
| P0.5  | Charakter-Editor                                             | ✅    | Haut, 4 Frisuren, Haarfarbe, 3 Oberteile + Farbe, Hose/Shorts/Rock + Farbe, freie Farbwahl, Vorlagen, Zufall, drehbare animierte Vorschau (OrbitControls, Stehen/Laufen/Sitzen/Winken/Jubeln), localStorage, Sync an alle.                                                                                                                                                                                                                                                                                                                               |
| P0.6  | WASD + Klick-zum-Laufen + Zoom                               | ✅    | WASD bildschirmrelativ, Klick → A\* auf Viertel-Kachel-Raster mit Pfadglättung, Mausrad-Zoom.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| P0.7  | Nametags, Chat, Sprechblasen                                 | ✅    | Chat nutzt die `chatMessages` des Servers (gemeinsam mit 2D). Namen verblassen mit Entfernung, Sprechblasen immer sichtbar.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| P0.8  | Stühle: E/Klick, Belegung, „Plumps"                          | ✅    | Belegung wird aus den Positionen abgeleitet (auch 2D-Spieler belegen Stühle). Plumps: kurzer Hüpfer, Fall, Squash & Wobble.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| P1.9  | Computer, Whiteboard, Getränkeautomat                        | ✅/⚠️ | Computer: Screen-Share über LiveKit (Session aus dem 2D-Client übernommen), meldet ohne Server nach ~4 s „nicht verfügbar". Mit echtem LiveKit **nicht getestet** (kein Server vorhanden). Whiteboard: eigener Dialog auf denselben Colyseus-Notizen (live synchron mit 2D), Staffelei zeigt die echten Zettel. Der React-Flow-Dialog des 2D-Clients ließ sich nicht einbinden (fest an Redux/Phaser gekoppelt), Pfeile nur anzeigen, Zettel nicht in der Größe änderbar. Automat: Getränk wählen → Becher in der Hand mit Schlücken, für alle sichtbar. |
| P1.10 | Emotes, Idle-Variationen, Hüpf-Feedback                      | ✅    | Winken (1), Jubeln (2), Hüpfen (Leertaste), Umschauen/Strecken nach längerem Stehen, Blinzeln. Emotes sieht nur der 3D-Client (2D ignoriert die Message).                                                                                                                                                                                                                                                                                                                                                                                                |
| P1.11 | Pixel-/PostFX-Umschalter                                     | ✅    | Einstellungen → Look: klar / Pixel (Pixelation + Tiefenkanten) / Kanten-Post-FX statt Inverted Hull.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| P2    | Mobil-Joystick                                               | ✅    | Auf Touch-Geräten, analog. Kein Pinch-Zoom, UI nicht für kleine Screens optimiert.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| P2    | Instancing/LOD + FPS-Messung                                 | ✅    | Stühle instanziert, Chibis pro Segment gemergt, Kulisse gebacken, Frustum-Skip der Animation, Mess-Skripte. Kein LOD.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| P2    | Login/Raumauswahl                                            | ✅    | Öffentliches Büro, eigene Räume aus der Lobby (mit Passwort), eigenen Raum anlegen.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| P2    | Preset-Migration adam/ash/lucy/nancy                         | ✅    | Die vier Figuren gibt es als Chibi-Vorlagen. 2D-Spieler erscheinen in 3D als ihre Vorlage, 3D-Spieler in 2D als die im Editor gewählte Figur.                                                                                                                                                                                                                                                                                                                                                                                                            |
| –     | **Video/Audio mit Nähe/Zonen (LiveKit)**                     | ❌    | Nicht umgesetzt. Der HUD prüft nur, ob Medien möglich wären („Medien nicht verfügbar" / „Ruhezone"). Größte Lücke zur Parität.                                                                                                                                                                                                                                                                                                                                                                                                                           |

## Die 5 PoC-Fragen

### 1. Ist die Knuffigkeit in 3D erreicht?

Meine Einschätzung: **weitgehend ja, mit Einschränkungen.** Screenshots liegen in [`docs/poc2/`](docs/poc2).

- Was trägt: die Chibi-Proportionen (Kopf ≈ halbe Körperhöhe), die großen glänzenden Augen mit Bäckchen, das Hüpfen beim Laufen, das Wippen im Stehen, der „Plumps" beim Hinsetzen, das Blinzeln, die Pastellpalette und die Toon-Bänder. Das Büro wirkt wie ein Spielzeug-Diorama aus Holzklötzchen und Knetfiguren.
- Was schwächer ist als in 2D: In der Standard-Iso-Ansicht sind die Gesichter nur ~25–40 px groß. Der Pixel-Art-Charme der LimeZu-Sprites (viele liebevolle Details auf wenigen Pixeln) wird durch „glatte" Primitives ersetzt. Die Möbel sind bewusst schlicht (abgerundete Boxen), die 2D-Map ist deutlich detailreicher. Einige Dekor-Objekte der Tiled-Map sind in 3D ausgeblendet oder zu Blöcken vereinfacht.
- Der **Pixel-Look** (Einstellungen) schlägt eine Brücke: 3D-Diorama mit Pixelkanten und scharfen DOM-Namensschildern. Subjektiv ist das die knuffigste Variante.
- Was Nutzer vergleichen müssen, am besten nebeneinander (2D auf :3000, 3D auf :3100, gleicher Raum):
  1. die eigene Figur im 2D-Sprite vs. selbst gestalteter Chibi (ist der Editor den Verlust an Pixel-Detail wert?),
  2. 3D klar vs. 3D Pixel-Look,
  3. Lesbarkeit von Gesichtern und Namen auf normalem Zoom,
  4. das Gefühl beim Laufen, Hinsetzen und Winken (Animation statt 4-Richtungs-Sprites),
  5. Übersicht im vollen Konferenzsaal.

### 2. Asset-/Map-Workflow: Blender/glTF vs. prozedural, Aufwand für einen neuen Raum

**Umgesetzt (prozedural, Tiled bleibt die Quelle):**

1. Den Raum wie heute in Tiled bauen (Tiles, Objekt-Layer, `collides`, Stühle mit `direction`, Computer/Whiteboards, Zonen).
2. `npm run extract-map -w client-3d` ausführen. `scripts/extract-map.mjs` liest `client/public/assets/map/map.json` und die Tileset-PNGs und erzeugt `client-3d/src/map/office.generated.json` mit
   - begehbaren Kacheln (Flood-Fill ab Spawn) und Wandkacheln,
   - Kollisionsrechtecken nach denselben Regeln wie Phaser (Tile-Property `collides`, `*OnCollide`-/`Basement`-Layer, Layer-Property `collides`, Automat),
   - „Komponenten": je Layer zusammenhängende Deko-Objekte mit Bounding Box und **aus den Pixeln gemittelter Farbe**,
   - Stühlen, Computern, Whiteboards, Automat und Zonen.
3. Fertig, der Raum ist in 3D begehbar: Böden und Wände bekommen die (pastellisierten) Farben ihrer Tiles, Wände werden per Greedy-Meshing zu Blöcken zusammengefasst, Grünes wird zur Pflanze, Wandobjekte werden zu Bildern, alles Blockierende wird zur abgerundeten Box in der Pixel-Farbe.
4. Optional für mehr Liebe: in `client-3d/src/world/furniture.tsx` die Position einer Komponente einem Prefab zuordnen (`'21,7': 'poolTable'`). Es gibt 15 Prefabs: Tisch, Pult, Billard, Bücherregal, Pflanze, Schrank, Wasserspender, Drucker, Kartons, Globus, Bild, TV …

**Aufwand für einen neuen Raum** (z. B. so groß wie die Bibliothek): Tiled wie heute, dazu 0 min für „begehbar und erkennbar" und etwa 15–45 min Prefab-Zuordnung für „hübsch", solange die vorhandenen Prefabs passen. Ein neues Prefab (z. B. ein Sofa) kostet 15–30 min Code aus Primitives.

**Blender/glTF als Alternative:** Kollision und Layout weiterhin aus Tiled, Möbel als glTF-Prefabs aus einem Kit (KayKit/Quaternius Furniture, CC0) mit `useGLTF`, Materialien beim Laden durch unser Toon-Material ersetzen. Aufwand pro Raum etwa 2–4 h Platzieren und Abstimmen, ein eigenes Modell in Blender 1–4 h pro Möbel für Nicht-Artists. Mehr Detail und mehr Charme pro Objekt, aber zwei Quellen (Tiled + glTF), die synchron bleiben müssen.

**Empfehlung:** Tiled als einzige Layout- und Kollisionsquelle behalten. Die Prefab-Tabelle ist die Nahtstelle: Heute zeigt sie auf prozedurale Prefabs, später kann sie auf glTF-Modelle zeigen.

### 3. Stilvereinheitlichung: freie Assets vs. eigene

- **Eigene/prozedurale Assets** (so umgesetzt): automatisch einheitlich, weil alles dasselbe Toon-Material (3-Band-Gradient), dieselbe Palette, dieselbe Kontur und dieselben Rundungen nutzt. Die Grenze ist das Detail: Alles sieht nach „Holzspielzeug" aus. Das ist gewollt, aber limitiert.
- **Freie Kits:** innerhalb _eines_ Kits sehr einheitlich (KayKit ist selbst schon Toy-Style). Mehrere Kits zu mischen (KayKit + Quaternius + Kenney) fällt sofort auf: andere Polygondichte, Proportionen und Texturierung (Atlas vs. Vertex-Farbe). Vereinheitlichen geht über (a) Material-Override auf unser Toon-Material mit gemappten Palettenfarben, (b) dieselbe Kontur, (c) einheitliche Skalierung. Das holt viel heraus, Proportionsunterschiede bleiben.
- **Figuren:** Ein Charakter-Kit mit austauschbaren Teilen (Haare, Kleidung) muss von _einem_ Hersteller kommen, sonst passen Rigs und Proportionen nicht. Prozedurale Chibis sind hier bewusst die robustere Wahl: Jede Kombination aus Frisur, Kleidung und Farbe funktioniert, und das Datenformat ist ein winziges JSON.
- **Empfehlung:** höchstens eine Kit-Familie plus eigene Prefabs, immer mit Material-Override. Figuren prozedural lassen.

### 4. Performance

Messaufbau: AMD Ryzen 7 7735HS mit **integrierter Radeon 680M**, Chromium 153 headless auf der echten GPU (Vulkan), 1600×900, DPR 1, **ohne Vsync/Frame-Limit** (die Werte zeigen die Reserve über 60 FPS). Produktions-Build. 40 Bots per `scripts/bots.mjs` (30 sitzen im Konferenzsaal, 10 laufen, alle mit Zufallsavatar, chatten und winken), plus ich. Messung: `scripts/measure.mjs`, Mittel über 8 s. „4× CPU" = Chromium-CPU-Drosselung, als Näherung für einen schwachen Büro-Laptop.

| Szene (41 Chibis)                    | FPS vor Optimierung | FPS nach Optimierung | FPS nach Opt., 4× CPU | Draw Calls vorher → nachher |
| ------------------------------------ | ------------------: | -------------------: | --------------------: | --------------------------: |
| Übersicht ganzes Büro (ohne Spieler) |                 480 |                  692 |                   237 |                   822 → 137 |
| Flur (Chibis außerhalb des Bildes)   |                 297 |                  566 |                   109 |                    205 → 80 |
| Konferenzsaal voll, Konturen an      |                 134 |              **222** |                **55** |                  1543 → 378 |
| Konferenzsaal voll, Konturen aus     |                 168 |                  437 |                    73 |                  1111 → 225 |
| Konferenzsaal voll, Pixel-Post-FX    |                 136 |                  254 |                    62 |                           – |
| Konferenzsaal voll, Kanten-Post-FX   |                 177 |                  489 |                    78 |                           – |

(„Vorher" ist der Stand vor den Optimierungs-Commits, `53be248`, gleicher Messaufbau. Die ganz frühe Version mit einer drei-`<Html>`-Root pro Namensschild lag im Dev-Build mit 81 Chibis bei 73 FPS.)

Umgesetzte Optimierungen, jeweils gemessen: ein DOM-Layer für alle Namensschilder statt einer React-Root pro Spieler, Animation nur für Chibis im Sichtfeld, Chibi-Teile pro animiertem Segment zu einer Geometrie mit Vertex-Farben gemergt (≈15 statt ≈50 Draw Calls pro Figur, gecacht pro Avatar), statische Kulisse nach dem Mount zu 3 Meshes gebacken, Stühle instanziert. Das CPU-Profil zeigt jetzt vor allem three.js-Szenenverwaltung.

**Was für 40 Leute im Konferenzsaal nötig wäre:**

- Auf einer iGPU von 2022 reicht es heute (222 FPS). Auf einem schwachen Laptop (4× CPU) liegt der volle Saal bei 55 FPS, ohne Konturen bei 73. Das ist grenzwertig, aber nutzbar.
- Nächste Schritte, falls nötig: (1) Chibis vollständig instanzieren (alle Köpfe einer Frisur in einem InstancedMesh, ~20 Draw Calls für _alle_ Figuren); (2) Animations-LOD: weit entfernte oder sitzende Chibis mit 15 Hz animieren; (3) Konturen automatisch aus, wenn die FPS fallen; (4) DPR auf 1 begrenzen (auf HiDPI-Displays der größte GPU-Hebel).
- Netzwerk: Der 3D-Client sendet wie der 2D-Client maximal 15 Updates/s pro Spieler und nur bei Änderung. Für den Server ändert sich damit nichts gegenüber heute.
- Bundle: 3D-Client ≈ 1,0 MB three/R3F + 0,5 MB LiveKit + 0,5 MB App inkl. React/Colyseus/Map-Daten (gzip ≈ 0,55 MB gesamt), kleiner als der Phaser-Client (≈ 3 MB).

### 5. Pflege-/Erweiterungsaufwand vs. Phaser heute

| Aspekt       | Phaser (heute)                                                      | 3D/R3F (PoC)                                                                                                                                         |
| ------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code         | `client/src` ≈ 6 600 Zeilen                                         | `client-3d/src` ≈ 5 300 Zeilen TS/TSX + 620 CSS + Skripte, heute schon mit Editor, Raumwahl, Whiteboard, Screen-Share. Ohne Video-Grid/Media-Setup.  |
| Paradigma    | imperative Szene, Game-Objects, Event-Bus Phaser ↔ React/Redux      | alles React (Szene deklarativ, Animation in `useFrame`), ein Zustand-Store. Kein Brückencode zwischen zwei Welten.                                   |
| Neue Avatare | Pixel-Art-Sprite-Sheets mit allen Animationen (teuer, Artist nötig) | Parameter + Farbe; neue Frisur ≈ 20 Zeilen                                                                                                           |
| Neue Räume   | Tiled                                                               | Tiled + Extraktor (+ optional Prefab-Zuordnung)                                                                                                      |
| Neue Möbel   | Tile aus dem LimeZu-Set                                             | Prefab aus Primitives oder glTF (mehr Aufwand pro Objekt)                                                                                            |
| Know-how     | Phaser                                                              | three.js/R3F, etwas 3D-Mathematik, Shader-Grundlagen (Outline, Post-FX), Performance-Denken (Draw Calls)                                             |
| Risiken      | stabil, Phaser 4 gerade migriert                                    | R3F 9 verlangt aktuell React < 19.4 (Peer-Dependency), three.js ändert APIs häufig (z. B. `THREE.Clock` ist deprecated), Performance braucht Pflege. |
| Testbarkeit  | –                                                                   | Headless-Chromium mit echter GPU, Bots und Messskript sind im Repo                                                                                   |

Fazit: Der laufende Pflegeaufwand ist ähnlich. 3D ist bei Figuren und Interaktion billiger, bei Möbel-Detail und Performance teurer. Das Team braucht three.js/R3F-Grundwissen.

## Lizenzübersicht

| Was                                                                                                  | Lizenz                     | Anmerkung                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chibis, Möbel-Prefabs, Shader, UI (alles in `client-3d/`)                                            | MIT (wie das Repo)         | vollständig selbst erstellt, prozedural aus three.js-Primitives; **keine externen 3D-Modelle, Texturen oder Fonts**                                                    |
| Map-Layout und Farben                                                                                | wie der 2D-Client (LimeZu) | Der Extraktor liest die vorhandenen Tiled-Daten und Tileset-PNGs des Repos und speichert nur Rechtecke und gemittelte Farben. `client-3d` liefert keine Pixel-Art aus. |
| three.js 0.186, @react-three/fiber 9, @react-three/drei 10, @react-three/postprocessing 3, zustand 5 | MIT                        | npm                                                                                                                                                                    |
| postprocessing 6                                                                                     | Zlib                       | npm                                                                                                                                                                    |
| livekit-client 2                                                                                     | Apache-2.0                 | npm (wie im 2D-Client)                                                                                                                                                 |
| @colyseus/sdk 0.18                                                                                   | MIT                        | npm (wie im 2D-Client)                                                                                                                                                 |
| pngjs 7 (nur Build-Skript), playwright-core 1.63 (nur Messskripte)                                   | MIT / Apache-2.0           | devDependencies                                                                                                                                                        |
| Emojis in der UI                                                                                     | System-Font                | nicht mitgeliefert                                                                                                                                                     |
| Quaternius / KayKit                                                                                  | (CC0)                      | **nicht verwendet**: Die Downloads laufen über Google Drive bzw. itch.io und sind nicht automatisierbar. GitHub-Spiegel gibt es nur für andere Packs.                  |

## So teste ich das

```bash
npm install
npm run dev3d                 # Server :2567 + 3D-Client :3100
# parallel zum Vergleich:
npm run dev:client            # 2D-Client :3000 (gleicher Server)
```

1. http://localhost:3100 öffnen, Namen eingeben, **„Charakter gestalten"**: Frisur, Farben und Kleidung wählen, die Vorschau mit der Maus drehen, „Laufen"/„Sitzen"/„Winken" probieren, speichern.
2. „Beitreten" (öffentliches Büro) oder einen eigenen Raum mit Passwort anlegen.
3. Mit **WASD** laufen, auf den Boden **klicken** (die Figur läuft um Hindernisse herum), mit dem **Mausrad** zoomen.
4. Auf einen **Stuhl klicken** oder davor **E** drücken → Plumps. Nochmal E zum Aufstehen.
5. **Enter** → Chat, die Sprechblase erscheint über dem Kopf. **1**/**2**/**Leertaste** → Winken/Jubeln/Hüpfen.
6. In der Lounge am Getränkeautomaten **R** → Getränk wählen. Am Whiteboard **R** → Zettel anlegen, ziehen, per Doppelklick beschriften. Am Computer **R** → ohne LiveKit erscheint „nicht verfügbar".
7. Ein zweites Fenster (auch den 2D-Client auf :3000) im selben Raum öffnen: Bewegung, Sitzen, Chat, Whiteboard-Zettel und Avatar kommen in beide Richtungen an.
8. ⚙️ → Look „Pixel-Look" und „Kanten-Post-FX", Konturen und Wände umschalten, FPS-Anzeige.
9. Volles Haus: `node client-3d/scripts/bots.mjs 40 ws://localhost:2567` und in den Konferenzsaal laufen.
10. Messen: `node client-3d/scripts/measure.mjs http://localhost:3100/` (optional `CPU_THROTTLE=4`, `CHROME_PATH=…`).
11. Figurengalerie: http://localhost:3100/?gallery

Ohne LiveKit bleibt alles außer Medien nutzbar. Der HUD zeigt „🎥 Medien nicht verfügbar" (Klick prüft erneut), in der Bibliothek „🤫 Ruhezone".

## Weitere ehrliche Grenzen

- Kein Proximity-Video/Audio und kein Video-Grid in 3D (s. o.). Screen-Share gegen einen echten LiveKit-Server ist ungetestet.
- Der Kamerawinkel ist fest (keine Drehung). Die „abgesenkten Wände" sind eine feste Regel, keine dynamische Durchsicht.
- Wie in 2D sind die Möbel nur so genau wie die Kollisionsrechtecke; einige 2D-Dekor-Objekte fehlen in 3D oder sind stark vereinfacht (z. B. Bücherregale als große Blöcke).
- Whiteboard in 3D: keine Pfeile anlegen, keine Größenänderung. Die Zettelpositionen im Dialog sind skaliert.
- Emotes und Getränke sieht nur der 3D-Client. Im 2D-Client erscheinen 3D-Spieler als die im Editor gewählte 2D-Figur.
- Mobile: Joystick ja, aber kein Pinch-Zoom und nicht für kleine Screens gestaltet.
- Einstellungswechsel (Konturen, Wände) backen die Kulisse neu, was einen kurzen Ruckler gibt.
