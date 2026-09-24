# CLAUDE.md

> **Projekt ruht (Stand 2026-09-24).** Letzte Commits Anfang Juni 2026,
> `STATUS.md` steht noch auf Kolonie-Tag T+2 (27.05.2026) und ist veraltet.
> Das Kamera-Board (DFRobot DFR1154, früher `formicarium-cam1`,
> 192.168.1.201) wurde umgewidmet und läuft jetzt als Frigate-Kamera im
> separaten Repo `esp32-cam-surveillance` — für dieses Projekt nicht mehr
> verfügbar. Vor Arbeit hier zuerst mit dem Nutzer den aktuellen
> Kolonie- und Hardware-Stand klären.

---

## Projekt-Identität

**FORMICA-OS** ist ein Smart-Formicarium-System für eine *Camponotus ligniperda*-Kolonie (Gründung: 27.05.2026, Marly CH).

**Keeper:** Nils — Veteranen-Ameisenhalter, Maschinenbauingenieur, Maker (Python, ESP32, RPi, Home Assistant, Fusion 360). Kein Beginner-Overhead — direkt auf Architektur- und Implementierungsebene arbeiten.

---

## Umgebungs-Aufteilung

Diese Instanz (Claude Code / lokal) ist zuständig für:
- ESP32 Firmware (`firmware/esp32_cam/`, geplant: `firmware/esp32_formicarium/` für den Sensor-Node)
- Kiosk (`kiosk/`: 7"-Touchscreen-RPi, zeigt AntSim lokal, Chromium-Watchdog)
- Python Scripts (`scripts/`)
- Home Assistant YAML (`homeassistant/packages/`)
- Fusion 360 via MCP — CAD-Design des Korknests
- DXF-Export-Verifikation für CNC

Die Cloud-Instanz (claude.ai) übernimmt: React Logbuch-Artifact, biologische Meilenstein-Analyse, Hardware-Architektur-Entscheidungen.

---

## Architektur-Überblick

Das System besteht aus drei Schichten:

```
┌────────────────────────────────────────────┐
│         Home Assistant OS (RPi 4)          │
│  Dashboards · Automations · Alerts         │
│  Entities: sensor.formicarium_*            │
│            light.formicarium_*             │
│            switch.formicarium_*            │
└──────────────────┬─────────────────────────┘
                   │ MQTT (Mosquitto Add-on)
          ┌────────┴────────┐
          │   ESP32 Node    │
          │  SHT40  Temp/RH │  → Arena-Klima
          │  DS18B20 Temp   │  → Nestkern
          │  TSL2591 Lux    │  → Lichtmessung
          │  Servo          │  → Fütterung
          │  LED PWM        │  → Rotlicht
          └─────────────────┘
```

**Datenfluss:** ESP32 liest Sensoren → publiziert per MQTT → HA verarbeitet → Automationen reagieren → Kommandos zurück via `cmd/`-Topics.

**MQTT Topic-Schema** (`formicarium/{node}/{sensor}`):
```
formicarium/node1/temp_arena         # float, °C — SHT40
formicarium/node1/humidity_arena     # float, %RH — SHT40
formicarium/node1/temp_nest_core     # float, °C — DS18B20
formicarium/node1/lux                # float, lux — TSL2591
formicarium/node1/status             # JSON, Heartbeat
formicarium/node1/cmd/light          # int 0–255, Rotlicht PWM
formicarium/node1/cmd/feeder         # bool, Servo-Trigger
```

**Repo-Struktur** (vorhanden; `firmware/esp32_formicarium/`, `logbook/` und
`scripts/tests/` sind nur geplant):
```
firmware/esp32_cam/        ← PlatformIO, Kamera-Firmware (Board inzwischen umgewidmet)
homeassistant/packages/    ← formicarium.yaml
kiosk/                     ← index.html/app.js/style.css + reboot-server.py
scripts/                   ← u.a. scripts/fusion360/
cad/korknest_v1/exports/   ← layer_{nn}_{name}.dxf
docs/
formica-os-logbook.jsx     ← React Logbuch (Cloud-Artifact, hier zur Versionierung)
```

---

## Entwicklungs-Kommandos

### ESP32 Firmware (PlatformIO)
```bash
pio run                        # Firmware kompilieren
pio run -t upload              # Kompilieren + auf ESP32 flashen
pio run -t monitor             # Seriellen Monitor öffnen (nach upload)
pio run -t upload -t monitor   # Flash + Monitor in einem Schritt
pio check                      # Statische Code-Analyse (cppcheck)
```

### Python Scripts
```bash
python scripts/datalogger.py           # Datenlogger starten
python -m mypy scripts/                # Typ-Prüfung
python -m pytest scripts/tests/ -v    # Tests (einzelner: -k test_name)
```

### Home Assistant YAML
```bash
yamllint homeassistant/                # YAML-Syntax prüfen
# HA-Config-Check (auf dem RPi via SSH):
ha core check
```

---

## Code-Standards

1. **Vollständige Codeblöcke** — keine Platzhalter, kein `// wie vorher`, keine TODOs ohne Implementierung
2. **PlatformIO-Struktur** — `src/main.cpp` + `platformio.ini`, kein Arduino IDE Format
3. **MQTT-Topics** strikt nach Schema: `formicarium/{node}/{sensor}`
4. **HA YAML** ausschliesslich Packages-Struktur unter `homeassistant/packages/formicarium.yaml`
5. **Python** ≥ 3.11, Type Hints überall, keine externen Dependencies ohne explizite Begründung

---

## Korknest Design-Parameter (v1.0)

```
Plattengrösse:        200×200 mm (Nest-Bereich ~120×80 mm), Dicke 20 mm
Tunnel-∅:             3.5 mm (Worker), 6.0 mm (Queen-Passage)
Kammerhöhe:           6 mm (Worker), 10 mm (Queen/Brut)
Wasserkanal:          Layer 1, Nut 4×4 mm, Kapillarverbindung
Sensor-Kanal:         ∅4.5 mm, Layer 1→2
Verbindungs-Ports:    ∅8 mm, Schlauchpassung
Führungsstifte:       ∅6 mm, 4× pro Layer
DXF-Export:           ein File pro Layer → cad/korknest_v1/exports/layer_{nn}_{name}.dxf
```

---

## Projektstatus

→ `STATUS.md` für tagesaktuellen Stand (Kolonie-Tag, Hardware-Phase, offene Entscheidungen)  
→ `FORMICA-OS_PROJECT.md` für Vollbeschreibung inkl. Biologie-Zeitplan und Hardware-Architektur
