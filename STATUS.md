# STATUS.md — Formica-OS Projektstatus
*Wird nach jeder Session aktualisiert. Das ist die einzige Datei die beide Umgebungen aktiv schreiben.*

---

## Kolonie-Status
```
Datum:          27.05.2026
Kolonie-Tag:    T+0
Phase:          Gründung — Reagenzglas
Setup:          Büro, dunkle Ecke, ~23 °C
Letzter Fund:   Königin gefunden, keine Eier sichtbar
Nächster Check: ~03.06.2026 (T+7, Eier erwartet)
```

## Letzter Logbuch-Eintrag
```
T+0 — 27.05.2026
Königin gefunden Marly CH. Reagenzglas-Setup. Büro ~23 °C.
```

## Hardware-Status
```
Phase:           1 — Reagenzglas, kein Sensor
ESP32:           [ ] noch nicht verbaut
HA-Integration:  [ ] noch nicht konfiguriert
Korknest v1:     [~] F360 Scripts + Verifikation bereit, lokale Session ausstehend
Fusion 360 MCP:  [x] lokal verbunden, bereit
```

## Offene Entscheidungen
- [x] Nest-Design: ✅ Gestapelte Platten (4 Layer, 200×200×20mm)
- [ ] ESP32: ESPHome vs. custom MQTT Firmware → Entscheidung ausstehend
- [ ] CNC-Ressource: Eigene Fräse oder Dienstleister?

## Letzte Session
```
Datum:    27.05.2026
Umgebung: Claude Code (Cloud/Remote)
Output:   - CLAUDE.md überarbeitet (Architektur-Diagramm, Build-Kommandos)
          - F360 MCP Workflow geplant und implementiert
          - scripts/fusion360/ erstellt (parameters.py, layer_01-03, verify_dxf.py)
          - cad/korknest_v1/exports/ Verzeichnis angelegt
          - Nest-Design Entscheidung getroffen: Stacked Plates ✅
```

## Nächste geplante Sessions
| Umgebung | Aufgabe |
|----------|---------|
| Claude Code (Lokal) | F360 öffnen → layer_01_water.py ausführen → DXF exportieren → verifizieren |
| Claude Code (Lokal) | Layer 02+03 Scripts ausführen, Kammer-Layout anpassen |
| claude.ai (Cloud) | Logbuch-Update sobald Eier sichtbar |
| Claude Code (Lokal) | ESP32 PlatformIO-Setup + MQTT-Skeleton |
