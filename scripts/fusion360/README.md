# Fusion 360 Scripts — Korknest v1

Workflow: Python Scripts generieren Sketch-Geometrie, MCP-Calls exportieren DXF.

## Voraussetzungen

- Fusion 360 offen (lokal)
- Claude Code lokal gestartet mit Autodesk MCP verbunden
- `pip install ezdxf` für Verifikation

## Schritt 1 — Parameter in Fusion 360 setzen (einmalig)

In einer lokalen Claude Code Session:
```
→ Autodesk MCP: User Parameters anlegen gemäss parameters.py
```

## Schritt 2 — Layer-Scripts ausführen

In Fusion 360: **Tools → Scripts and Add-Ins → Run Script**

| Script | Layer | Pocket-Tiefe |
|--------|-------|-------------|
| `layer_01_water.py` | Wasserkanal, Ports, Sensorkanal | — (Durchbohrungen) |
| `layer_02_humidity.py` | Worker-Kammern + Tunnel | 6 mm |
| `layer_03_queen.py` | Queen-/Brutkammer | 10 mm |

Nach jedem Script: Kammer-Layout in F360 visuell prüfen und ggf. anpassen.

## Schritt 3 — DXF-Export via MCP

```
MCP → export_dxf(sketch="L01_Kontur", path="cad/korknest_v1/exports/layer_01_water_channel.dxf")
MCP → export_dxf(sketch="L02_Kontur", path="cad/korknest_v1/exports/layer_02_humidity_zone.dxf")
MCP → export_dxf(sketch="L03_Kontur", path="cad/korknest_v1/exports/layer_03_queen_chamber.dxf")
```

## Schritt 4 — Verifikation

```bash
python scripts/fusion360/verify_dxf.py cad/korknest_v1/exports/
```

Checks: Plattenumriss 200×200, 4× Führungsstifte an Eckpositionen, Port vorhanden, CNC-Mindestabstand.

## CNC-Probe vor Kork

Vor dem ersten Kork-Schnitt: DXF in XPS-Polystyrolplatte testen → Passung der Führungsstifte und Schlauchports prüfen.
