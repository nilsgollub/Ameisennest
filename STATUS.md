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
Korknest v1:     [ ] Design ausstehend
Fusion 360 MCP:  [x] lokal verbunden, bereit
```

## Offene Entscheidungen
- [ ] Nest-Design: Topdown-Block vs. gestapelte Platten → Fusion 360 Session nötig
- [ ] ESP32: ESPHome vs. custom MQTT Firmware → Entscheidung ausstehend
- [ ] CNC-Ressource: Eigene Fräse oder Dienstleister?

## Letzte Session
```
Datum:    27.05.2026
Umgebung: claude.ai (Cloud)
Output:   - Projekt-Beschreibung erstellt (FORMICA-OS_PROJECT.md)
          - Logbuch-Artifact initialisiert (React)
          - CLAUDE.md + STATUS.md erstellt
          - Repo-Struktur definiert
```

## Nächste geplante Sessions
| Umgebung | Aufgabe |
|----------|---------|
| Claude Code (Lokal) | Korknest Layer 1 in Fusion 360 — Grundriss definieren |
| claude.ai (Cloud) | Logbuch-Update sobald Eier sichtbar |
| Claude Code (Lokal) | ESP32 PlatformIO-Setup + MQTT-Skeleton |
