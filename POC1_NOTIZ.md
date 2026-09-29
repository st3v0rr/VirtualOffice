# PoC 1 — Charakter-Editor mit Ebenen-Sprites (Phaser)

Branch `poc/character-editor-layers`. Avatare werden zur Laufzeit aus LPC-Ebenen (Körper+Kopf,
Hose, Oberteil, Frisur) zu einer Textur zusammengesetzt, animiert (stehen, laufen, sitzen in vier
Richtungen) und das Aussehen als kurzer String über Colyseus synchronisiert. Der alte
AvatarPicker ist durch einen Editor mit animierter Vorschau ersetzt.

## Kurzfazit

| Frage                                       | Ergebnis                                                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| RenderTexture-Komposition machbar?          | **Ja.** ≈ 0,5–1 ms pro Avatar inkl. GPU, 0,7 MB VRAM pro Avatar                                                             |
| Animationen mit zusammengesetzten Texturen? | **Ja**, normale Phaser-Animationen auf Frames der DynamicTexture, Sitzen funktioniert                                       |
| Colyseus-Sync der Beschreibung?             | **Ja.** Ein String (~45 Byte), Latenz Ø 20–30 ms / p95 ≈ 50 ms lokal, 30 Spieler bei 60 FPS                                 |
| LPC vs. LimeZu                              | Funktioniert, aber sichtbarer Stilbruch → **Empfehlung: Pipeline behalten, LimeZu-Charakter-Ebenen kaufen** (Details unten) |

## Was gebaut wurde

- **Grafiken** (`client/public/assets/lpc/`, 24 PNGs, 148 KB): 2 Körper (Körpertyp `teen` hell,
  `female` bronze, jeweils mit passendem Kopf), 3 Frisuren (Bob, Kurz/Buzzcut, Locken) + „Keine“,
  3 Oberteile (T-Shirt, Polo, Strickjacke), 2 Hosen (Jeans, Anzughose). Quelle: Universal LPC
  Spritesheet Character Generator (`spritesheets/…`), per `git clone --filter=blob:none` +
  Sparse-Checkout geholt. Credits pro Datei in `client/public/assets/lpc/CREDITS.csv`
  (CC-BY-SA 3.0 / GPL 3.0 / OGA-BY 3.0 — **Attribution ist Pflicht**, bei CC-BY-SA auch Share-Alike
  für abgeleitete Grafiken).
- **Zuschnitt** (`client/scripts/prepare-lpc.sh <LPC-Checkout>`): Die LPC-Sheets sind nicht mehr
  das alte 8×6/21-Reihen-Layout, sondern das „universal“-Layout mit 46 Reihen à 64×64 (832×2944).
  Relevante Reihen (verifiziert im Generator-Quellcode, `index.html` `data-row`): idle 22–25,
  sit 30–33, run 34–37, walk 8–11; Richtungsreihenfolge oben, links, unten, rechts. Das Skript
  packt pro Ebene nur die genutzten 11 Frames je Richtung in eine Zeile: 0–1 idle, 2–9 run,
  10 = Sitzen auf Stuhl (Spalte 2 des sit-Blocks; 0–1 sind Sitzen auf dem Boden) → 704×256 pro Ebene.
- **Auswahl-Einschränkung:** Die klassischen LPC-Oberteile für männliche Körper (`longsleeve`,
  `shortsleeve` …) haben **keine** idle/run/sit-Reihen (nur 21 Reihen). Vollständig animiert sind
  die „revised“-Oberteile (`tshirt`, `longsleeve2_polo`, `…_cardigan` …) — aber nur für die
  Körpertypen `female` und `teen`. Deshalb diese beiden Körpertypen; `teen` mit männlichem Kopf
  wirkt als schlanker, erwachsener Mann. Hosen: `thin`-Varianten passen zu beiden.
- **Beschreibung** (`types/Avatar.ts`, von Client und Server genutzt):
  `{ body, hair, hairColor, top, bottom }`, Katalog der erlaubten IDs, `serializeAvatar` /
  `parseAvatar` (versioniert, validiert), `randomAvatar`.
- **Composer** (`client/src/avatar/composeAvatar.ts`): `ensureAvatarTexture(scene, avatar)` →
  Texture-Key `lpc-<fnv1a-hash>`. Legt eine `DynamicTexture` an, stempelt die Ebenen in
  Z-Reihenfolge (Körper, Hose, Oberteil, Kopf, Haare), `render()`, legt 44 Frames an und
  registriert 12 Animationen `<key>_{idle,run,sit}_{up,left,down,right}`. Existiert der Key schon,
  wird nichts neu gebaut (Cache). Alle 30 s werden Texturen, die niemand mehr trägt, entfernt.
- **Editor** (`client/src/components/AvatarEditor.tsx`, `AvatarPreview.tsx`): ToggleButtons pro
  Ebene, Farb-Swatches für Haare, „Zufällig“, Vorschau als eigene kleine Phaser-Instanz (2×
  skaliert, dreht sich alle 1,6 s, umschaltbar Stehen/Laufen/Sitzen) — benutzt exakt denselben
  Composer. Im Login-Dialog und in den Einstellungen. Speicherung im Profil in `localStorage`
  (`skyoffice:profile`), alte Profile (`"adam"` …) bekommen einen Zufalls-Avatar.
  Im Dev-Build zusätzlich „Test-Avatare (nur Dev)“ A–D.
- **Server**: `Player.avatar` (String, Default `''`), neue Message `UPDATE_PLAYER_AVATAR`
  (ans Enum **angehängt**, damit alte Message-Nummern gleich bleiben), `PlayerUpdateAvatarCommand`
  validiert und speichert die normalisierte Form.
- **Andere Spieler** (`OtherPlayer.applyAnim`): Aus dem synchronisierten `anim` werden nur Zustand
  und Richtung genommen (`…_run_left`), die Figur kommt aus `avatar`. Ohne gültigen Avatar (alter
  Client) wird die alte Figur aus dem anim-Key genommen (`ash_run_left` → ash), sonst `adam`.
- **Ausrichtung**: LPC-Frames sind 64×64, die alten Figuren 32×48. Der Sprite-Origin wird so
  gesetzt, dass die Füße (Zeile 62 der Zelle) dort stehen, wo die alten Figuren sie haben
  (y+24); die Kollisionsbox (16×9,6 an den Füßen) ist für beide gleich (`Player.updateFootprint`).
  Dadurch funktionieren Sitz-Offsets, Kollision und Namensschild unverändert.

## Die 4 PoC-Fragen

### 1. RenderTexture-Komposition: machbar? Kosten / Time-to-first-Frame

Machbar und billig. **Phaser-4-Hinweis:** `RenderTexture` ist in Phaser 4 nur noch ein
GameObject-Wrapper um eine `DynamicTexture`; Zeichenbefehle werden gepuffert und erst mit
`render()` ausgeführt. Da wir kein sichtbares GameObject brauchen, nutzt der Composer
`textures.addDynamicTexture()` direkt (gleiche Technik, ohne unnötiges Display-Objekt).
Frames lassen sich per `texture.add()` anlegen, das Y-Flip des Framebuffers behandelt Phaser
korrekt (visuell geprüft).

Messungen (Dev-Build, Chromium 26 headless, `window.avatarBenchmark(50)`: 50 neue Avatare,
nach jedem `gl.finish()`, also inkl. GPU-Arbeit):

| Variante                            | GPU                                       | erster Avatar | Ø           | Median | Max                |
| ----------------------------------- | ----------------------------------------- | ------------- | ----------- | ------ | ------------------ |
| volles Sheet 576×1024 (2,4 MB VRAM) | AMD Radeon 680M (iGPU)                    | 5,5 ms        | 1,0 ms      | 1,3 ms | 1,9 ms             |
| **gepackt 704×256 (0,7 MB VRAM)**   | AMD Radeon 680M (iGPU)                    | 4,6 ms        | **0,65 ms** | 0,5 ms | 1,8 ms             |
| gepackt 704×256                     | SwiftShader (Software, Vulkan)            | 4,0 ms        | 0,55–0,9 ms | 0,5 ms | 15 ms              |
| volles Sheet                        | SwiftShader via `--use-angle=swiftshader` | 123 ms        | 27 ms       | 0,7 ms | 366 ms (Ausreißer) |

Im laufenden Spiel (Konsole `[avatar] composed …`, `window.avatarTimings`), 12–30 Bots, GPU:
CPU-seitig Median 0,9–1,2 ms, Max 3–8 ms (ohne GPU-Sync); **Time-to-first-Frame** (bis zum
nächsten gerenderten Frame) Median 13 ms, Max ~100 ms beim Betreten, wenn ~12 Avatare im selben
Frame gebaut werden. Die Ebenen (24 PNGs, 148 KB) werden in `Bootstrap` vorgeladen, lokal ~110 ms.
Fazit: Selbst 30 Avatare auf einmal kosten weniger als ein paar Frames; kein Web-Worker/Canvas-
Umweg nötig. Der erste Avatar ist teurer (Shader/Framebuffer-Setup).

VRAM ist die eigentliche Größe: 0,7 MB pro verschiedener Figur (50 Spieler ≈ 36 MB). Deshalb das
Packen auf die genutzten Frames und das periodische Entfernen ungenutzter Texturen.

### 2. Animationen mit zusammengesetzten Texturen

Funktioniert ohne Sonderlocken: `anims.create` mit `{ key: <DynamicTexture-Key>, frame: <Index> }`.
Die Keys folgen dem bestehenden Schema `<textur>_<zustand>_<richtung>`, deshalb laufen
`MyPlayer`/`OtherPlayer`/`PlayerSelector` inkl. `split('_')`-Logik unverändert weiter (der
Textur-Key ist ein Hash ohne `_`). Animationen: idle (Frames 0,0,1 bei 2,5 fps, LPC-„Atmen“),
run (8 Frames, 12 fps; passt bei 200 px/s besser als der Walk-Zyklus), sit (1 Frame).

**Sitzen** geprüft an Stühlen aller vier Richtungen (per Skript positioniert, E gedrückt,
Screenshots): links/rechts/unten sitzt die LPC-Figur sauber auf dem Stuhl, `sittingShiftData`
passt dank Fuß-Ausrichtung ohne Änderung. Bei „oben“ verschwindet die Figur hinter der hohen
Stuhllehne — das tut die alte Figur `adam` am selben Stuhl genauso (Tiefe −10 ist Absicht), also
kein LPC-Problem. Andere Spieler sehen die Sitz-Animation (Zwei-Session-Test).

Haarfarbe: LPC liefert jede Frisur in ~25 **vorgerenderten Farben** mit sauberem Shading → das ist
der Standardweg (Dunkelbraun, Blond, Schwarz). **Tint-Experiment**: die `white`-Variante mit
`stamp(…, { tint })` multipliziert (Rot, Blau). Funktioniert überraschend gut (nur WebGL): Die
weiße Variante ist in Graustufen schattiert, das Shading bleibt erhalten; nur die Glanzlichter
werden mit eingefärbt, dadurch etwas weniger Tiefe als bei den vorgerenderten Farben.
Empfehlung: vorgerenderte Varianten als Standard (bestes Ergebnis, kein Laufzeitaufwand), Tint
auf der weißen Variante für eine freie Farbwahl — die Beschreibung bräuchte dann ein Farbfeld
statt einer ID.

### 3. Colyseus-Sync der Beschreibung

**Format: ein einziger String** `Player.avatar`, z.B. `1.teen_light.curly_short.dark_brown.polo.pants`
(Version + 5 IDs, ~45 Byte). Warum kein verschachteltes Schema mit 5 Feldern:

- atomar: eine Änderung = ein Feld-Update, der Empfänger sieht nie halbe Zustände,
- der String ist gleichzeitig der Cache-Key (Hash → Textur),
- Versionierung (`1.`) erlaubt spätere Formatwechsel ohne Schema-Migration,
- Validierung zentral in `parseAvatar` (Server verwirft Unbekanntes, speichert Normalform).
  Nachteil: kein Delta pro Feld — irrelevant bei 45 Byte und seltenen Änderungen.

Messung mit `npm run bots` (Bot sendet Änderung → ein zweiter Beobachter-Client empfängt sie;
lokaler Server, Colyseus-Patchrate 50 ms):

| Spieler | Änderungen | Ø     | p50   | p95   | Max   |
| ------- | ---------- | ----- | ----- | ----- | ----- |
| 12 Bots | 25         | 22 ms | 21 ms | 41 ms | 48 ms |
| 30 Bots | 206        | 26 ms | 26 ms | 50 ms | 53 ms |

Die Latenz ist durch das Patch-Intervall (0–50 ms) dominiert, nicht durch die Spielerzahl. Der
eigene Round-Trip im Browser (senden → im State zurück) liegt bei 60–70 ms.
Mit 30 Bots (alle mit LPC-Avatar, laufend, Avatar-Wechsel alle 5–15 s) bleibt der Browser auf
**60 FPS** (Radeon 680M); ohne das Aufräumen wuchsen die Texturen auf >100, mit Aufräumen
pendeln sie sich bei ~30–90 ein. Beim Betreten werden alle sichtbaren Avatare im ersten Frame
gebaut (s.o. ~100 ms Spitze bei 12+ Spielern) — bei deutlich mehr Spielern ggf. auf mehrere
Frames verteilen.

Abwärtskompatibilität: alte Clients senden kein `avatar` (bleibt `''`) → neue Clients zeigen die
alte Figur aus `anim` (getestet mit `npm run bots -- 12 60 --legacy`: jeder dritte Bot als „ash“).
Alte Clients ignorieren das neue Feld; da sie für `lpc-…_run_left` keine Animation haben, bleiben
neue Spieler bei ihnen als unanimierte Standardfigur (adam) stehen, die Position stimmt — für
einen PoC akzeptabel, im Echtbetrieb ohnehin gleiche Client-Version.

### 4. LPC vs. LimeZu-Map: optische Einschätzung und Empfehlung

Beobachtung (Screenshots LPC-Bots neben alten LimeZu-Figuren auf der LimeZu-Karte):

- **Größe passt**: LPC-Figuren sind ~49 px hoch, LimeZu 46 px — nebeneinander stimmig, Stühle
  und Türen passen.
- **Stil passt nicht ganz**: LPC hat realistischere Proportionen (Kopf ~⅓ der Höhe), schwarze
  Outlines, kontrastreiches RPG-Shading, 3/4-Ansicht. LimeZu ist Chibi (Kopf ~½), weiche farbige
  Outlines, flache Pastell-Töne — genau wie Möbel und Böden der Karte. Die LPC-Figuren wirken
  dadurch wie „aus einem anderen Spiel“; nicht störend, aber sichtbar.
- LPC ist riesig (Hunderte Ebenen, freie Lizenz), aber viele Kleidungsstücke haben nicht alle
  Animationen/Körpertypen (s.o.), und CC-BY-SA verlangt Share-Alike für eigene Anpassungen.

**Empfehlung: Pipeline übernehmen, Grafiken wechseln — LimeZu-Charakter-Ebenen kaufen**
(Modern Interiors enthält laut Shop einen „Character Generator“ mit Einzel-Ebenen für Körper,
Augen, Outfit, Frisur, Accessoires; Lizenz und genaues Frame-Layout vor dem Kauf prüfen, LimeZu
erlaubt kommerzielle Nutzung, aber keine Weitergabe der Rohdateien — also nicht offen ins Repo).
Der Composer ist Asset-agnostisch: Es ändern sich nur `prepare-lpc.sh` (Zuschnitt), die
Konstanten in `lpcLayout.ts` (Zellgröße, Spalten, Fußlinie) und der Katalog in `types/Avatar.ts`.
Falls kein Kauf gewünscht: LPC **anpassen** (eigene Palette ohne schwarze Outlines, evtl.
0,85–0,9× skalieren) ist möglich, aber Handarbeit pro Ebene und wegen CC-BY-SA lizenzpflichtig.
LPC „wie es ist“ nur als Übergangslösung.

## So teste ich das

`livekit-server` wird nicht gebraucht (Video zeigt dann „Video chat is not available“).

1. `npm install`
2. Zwei Terminals: `npm run dev:server` (Colyseus, ws://localhost:2567) und
   `npm run dev:client` (Vite, **http://localhost:3000**). Nicht `npm run dev`, das startet auch
   `livekit-server`.
3. Fenster 1: http://localhost:3000 → „Connect to public lobby“ → im Editor Ebenen wählen
   (Vorschau läuft; unter der Vorschau Stehen/Laufen/Sitzen), Namen eingeben, „Join“.
4. Fenster 2 als **zweite Session**: Inkognito-Fenster/anderer Browser, **oder** im selben
   Browser http://localhost:3000/?profile=b (eigenes gespeichertes Profil). Dort z.B.
   „Test B“ unter „Test-Avatare (nur Dev)“ wählen und joinen.
5. Beide Figuren laufen lassen (Pfeiltasten/WASD) — im jeweils anderen Fenster erscheinen sie mit
   dem gewählten Aussehen und Animationen.
6. Sitzen: vor einen Stuhl laufen, E drücken → im anderen Fenster sitzt die Figur ebenfalls.
7. Aussehen im Spiel ändern: Zahnrad unten rechts → Editor → „Save“ → das andere Fenster zeigt
   die neue Figur sofort. Nach Reload ist das Aussehen aus `localStorage` wieder da.
8. Konsole: `[avatar] composed … ms` (Kompositionszeit), `[avatar] … synced back … ms`
   (Round-Trip), `window.avatarTimings` (letzte 100 Kompositionen),
   `window.avatarBenchmark(50)` (50 neue Avatare mit GPU-Sync, Tabelle inkl. GPU-Name).
9. Viele Spieler: `npm run bots -- 30` (30 Bots mit Zufalls-Avataren um den Spawnpunkt, wechseln
   alle 5–15 s das Aussehen, alle 10 s Latenz-Statistik; Ctrl+C beendet). Optionen:
   `npm run bots -- <anzahl> <sekunden> [--legacy]`, `--legacy` = jeder dritte Bot als alter
   Client ohne Avatar.
10. Die Ebenen neu erzeugen: LPC-Repo klonen (sparse genügt) und
    `client/scripts/prepare-lpc.sh <pfad-zum-lpc-repo>` (braucht ImageMagick 7 `magick`).

Validiert in dieser Umgebung: `npm install`, `npm run typecheck`, `npm run build`, `npm run lint`
fehlerfrei; Server+Client headless gestartet und per curl geprüft; Login, Editor, Laufen, Sitzen
in allen Richtungen, Avatar-Wechsel über die Einstellungen (die zweite Session sieht die neue
Figur), zwei getrennte Browser-Sessions sowie 12/30 Bots per Chromium-DevTools-Skript
durchgespielt und per Screenshot kontrolliert. Nicht manuell von Hand im sichtbaren Browser
geklickt — Schritte 3–7 sind der empfohlene manuelle Gegentest.

## Bekannte Grenzen

- Nur 2 Körper / 3 Frisuren / 3 Oberteile / 2 Hosen, Farben der Kleidung fest (LPC hat ~24
  vorgerenderte Farbvarianten pro Teil — Farbwahl wäre nur ein weiteres Feld + mehr Dateien).
- Körpertypen auf `teen`/`female` beschränkt (s.o., fehlende Animationen der klassischen
  Oberteile). Frisuren „adult“ passen zu beiden.
- Alle Ebenen werden beim Start vorgeladen; bei großem Katalog auf Nachladen pro Beschreibung
  umstellen (`load.image` + `once('complete')` vor dem Komponieren).
- Tint funktioniert nur mit WebGL (Canvas-Renderer: Haare in Weiß).
- Nach WebGL-Kontextverlust sind DynamicTextures leer; nicht behandelt (Phaser: bei
  `restorewebgl` neu zeichnen).
- Beim Betreten mit vielen Spielern werden alle Avatare im selben Frame gebaut (~100 ms Spitze
  bei 12 neuen); bei 50+ Spielern auf mehrere Frames verteilen.
- Alte Clients (ohne Editor) sehen neue Spieler nur als unanimierte adam-Figur.
- Das Namensschild sitzt 30 px über dem Mittelpunkt wie bisher; bei LPC-Frisuren mit viel
  Volumen berührt es fast die Haare.
- Der Sitzen-Frame nach „oben“ ist bei hohen Stuhllehnen verdeckt (wie bei den alten Figuren).
- Die Vorschau ist eine zweite Phaser-Instanz (eigener WebGL-Kontext), solange Login-/
  Einstellungsdialog offen sind.
- Alle Messungen lokal (Server auf demselben Rechner) — echte Netzlatenz kommt obendrauf.
