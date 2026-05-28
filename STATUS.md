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

## Netzwerk
```
ESP32 Kamera (DFR1154):     192.168.1.201  (statisch)
RPi Kiosk (7" Touchscreen): 192.168.1.147
RPi Home Assistant:         192.168.1.155  (Mosquitto MQTT)
```

## Hardware-Status
```
Phase:           1 — Reagenzglas, kein Sensor

ESP32 Kamera:    [x] Geflasht, läuft ✅
                     OV3660 SVGA 800×600, PSRAM aktiv
                     MQTT verbunden (formicarium/cam1/status publiziert)
                     Stream: http://192.168.1.201/stream

ESP32 Sensor:    [ ] noch nicht verbaut
                     (firmware/esp32_formicarium/ — ausstehend)

Kiosk RPi:       [x] Eingerichtet, läuft ✅
                     nginx + Chromium Kiosk aktiv
                     http://192.168.1.147 → Kamerastream

HA-Integration:  [~] formicarium_cam.yaml erstellt, noch nicht deployed
                     Auf RPi .155 in /config/packages/ kopieren ausstehend

Korknest v1:     [~] F360 Scripts bereit, lokale Session ausstehend
Fusion 360 MCP:  [x] lokal verbunden, bereit
```

## Kamera-Node (cam1)
```
Board:           DFRobot DFR1154 — ESP32-S3, OV3660 2MP
PSRAM:           8 MB OPI (qio_opi aktiviert)
IR-LED:          GPIO 47, 940 nm, 5× TX, LEDC PWM 0-255
Stream:          MJPEG, ~10 fps, SVGA 800×600
mDNS:            formicarium-cam1.local
Static IP:       192.168.1.201
MQTT Broker:     192.168.1.155 (HA-RPi)
Platform:        espressif32@6.5.0 (gepinnt — Python 3.13 fatfs-Bug)
```

## Offene Entscheidungen
- [x] Nest-Design: ✅ Gestapelte Platten (4 Layer, 200×200×20mm)
- [x] Kamera: ✅ DFR1154 MJPEG + IR LEDC + Kiosk
- [ ] ESP32 Sensor-Node: ESPHome vs. custom MQTT Firmware
- [ ] CNC-Ressource: Eigene Fräse oder Dienstleister?

## Letzte Session
```
Datum:    28.05.2026
Umgebung: Claude Code (Lokal, VS Code)
Output:   - ESP32 Kamera geflasht und in Betrieb (192.168.1.201)
          - Bugs behoben: fatfs Python 3.13, PSRAM qio_opi, MQTT Auth
          - Secrets in credentials.ini ausgelagert (.gitignore)
          - Kiosk-RPi eingerichtet (nginx + Chromium Autostart)
          - INSTALL_KAMERA.md und STATUS.md aktualisiert
```

## Nächste geplante Sessions
| Umgebung | Aufgabe |
|----------|---------|
| Claude Code (Lokal) | formicarium_cam.yaml auf HA-RPi deployen |
| Claude Code (Lokal) | F360 öffnen → layer_01_water.py → DXF exportieren → verifizieren |
| Claude Code (Lokal) | ESP32 Sensor-Node: PlatformIO-Setup + MQTT-Skeleton |
| claude.ai (Cloud)   | Logbuch-Update sobald Eier sichtbar |
