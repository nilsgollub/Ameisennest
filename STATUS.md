# STATUS.md — Formica-OS Projektstatus
*Wird nach jeder Session aktualisiert. Das ist die einzige Datei die beide Umgebungen aktiv schreiben.*

---

## Kolonie-Status
```
Datum:          27.05.2026
Kolonie-Tag:    T+2
Phase:          Gründung — Reagenzglas
Setup:          Büro, dunkle Ecke, ~23 °C
Letzter Fund:   Königin, keine Eier sichtbar
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

ESP32 Kamera:    [x] Läuft ✅
                     SVGA 800×600, Q8, PSRAM aktiv, ~6-7 fps
                     LTR-308 Lux-Sensor aktiv
                     MQTT verbunden, Heartbeat alle 30s
                     Stream: http://192.168.1.201:81
                     API:    http://192.168.1.201/

ESP32 Sensor:    [ ] Noch nicht verbaut
                     (firmware/esp32_formicarium/ — ausstehend)

Kiosk RPi:       [x] Läuft ✅
                     nginx → /home/nilsgollub/Ameisennest/kiosk/
                     Chromium Kiosk + Autostart
                     Zoom/Pan/IR-Buttons + Reboot-Button
                     Update via: ~/kiosk-update.sh (git pull)

HA-Integration:  [x] Deployed ✅
                     /config/packages/formicarium_cam.yaml
                     Entities: camera, light.ir_led, sensor.lux, binary_sensor

Korknest v1:     [~] F360 Scripts bereit, lokale CAD-Session ausstehend
Fusion 360 MCP:  [x] Lokal verbunden, bereit
```

## Kamera-Node (cam1)
```
Board:           DFRobot DFR1154 — ESP32-S3R8, OV3660 2MP
PSRAM:           8 MB OPI (qio_opi)
Auflösung:       SVGA 800×600, JPEG Q8, ~6-7 fps
IR-LED:          GPIO 47, 940 nm, 5× TX, LEDC PWM 0-255
                 Auto-Off: 60s (HA-Automation + ESP32-Watchdog)
Lichtsensor:     LTR-308 onboard, I2C 0x53 (GPIO 8/9)
Stream:          Port 81 (WiFiServer, FreeRTOS-Task)
API:             Port 80 (esp_http_server) /ir /capture /
mDNS:            formicarium-cam1.local
Static IP:       192.168.1.201
MQTT Broker:     192.168.1.155
Platform:        espressif32@6.5.0 (gepinnt — Python 3.13 fatfs-Bug)
```

## HA Entities (Kamera)
```
camera.formicarium_cam1        MJPEG + Snapshot
light.formicarium_ir_led       IR 0-255, Auto-Off 60s
sensor.formicarium_lux         LTR-308, lx
sensor.formicarium_cam1_ip     ESP32 IP aus Heartbeat
binary_sensor.formicarium_cam1 Online/Offline
```

## Offene Entscheidungen
- [x] Nest-Design: ✅ Gestapelte Platten (4 Layer, 200×200×20mm)
- [x] Kamera: ✅ DFR1154 MJPEG + IR + LTR-308 + Kiosk
- [ ] ESP32 Sensor-Node: ESPHome vs. custom MQTT Firmware
- [ ] CNC-Ressource: Eigene Fräse oder Dienstleister?

## Letzte Session
```
Datum:    29.05.2026
Umgebung: Claude Code (Lokal, VS Code)
Output:   - Kiosk komplett: +/- Buttons statt Slider, D-Pad Pan, Reboot-Button
          - Reboot-Server auf Pi eingerichtet (Port 8765, sudo NOPASSWD)
          - IR Auto-Off 60s — uint32 Overflow-Bug behoben
          - SVGA Q8 + GAINCEILING_128X für bessere IR-Bildqualität
          - LTR-308 Lichtsensor eingebaut, MQTT + HA-Entity
          - Kiosk-Update via git pull (kiosk-update.sh)
          - Repo public gestellt für Pi-Deployment
          - IR LED via HA funktioniert (MQTT Bug debuggt und gefixt)
          - IR 940nm für Ameisen unsichtbar (Forschung bestätigt)
```

## Nächste geplante Sessions
| Umgebung | Aufgabe |
|----------|---------|
| Claude Code (Lokal) | F360 → layer_01_water.py → DXF → verifizieren |
| Claude Code (Lokal) | ESP32 Sensor-Node PlatformIO-Setup |
| claude.ai (Cloud)   | Logbuch-Update sobald Eier sichtbar (T+7) |
