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
ESP32 Sensor:    [ ] noch nicht verbaut (firmware/esp32_formicarium/ — ausstehend)
ESP32 Kamera:    [x] Firmware fertig (firmware/esp32_cam/) — Flash ausstehend
HA-Integration:  [~] formicarium_cam.yaml fertig, formicarium.yaml ausstehend
Kiosk RPi:       [x] HTML/JS/CSS + nginx-Setup-Script fertig
Korknest v1:     [~] F360 Scripts + Verifikation bereit, lokale Session ausstehend
Fusion 360 MCP:  [x] lokal verbunden, bereit
```

## Kamera-Node (cam1)
```
Board:        DFRobot DFR1154 — ESP32-S3, OV3660 2MP, 8MB OPI-PSRAM
IR-LED:       GPIO 47, 940 nm, 5× TX, PWM via LEDC (0-255)
Stream:       MJPEG HTTP GET /stream — ~10 fps, SVGA 800×600
mDNS:         formicarium-cam1.local
Static IP:    192.168.1.200  (anpassen in main.cpp vor Flash!)
MQTT Broker:  192.168.1.100  (anpassen in main.cpp vor Flash!)
```

## Offene Entscheidungen
- [x] Nest-Design: ✅ Gestapelte Platten (4 Layer, 200×200×20mm)
- [x] Kamera: ✅ MJPEG + IR PWM via MQTT + Kiosk HTML
- [ ] ESP32 Sensor-Node: ESPHome vs. custom MQTT Firmware
- [ ] CNC-Ressource: Eigene Fräse oder Dienstleister?

## Letzte Session
```
Datum:    27.05.2026
Umgebung: Claude Code (Cloud/Remote)
Output:   - firmware/esp32_cam/ komplett (platformio.ini, camera_pins.h, main.cpp)
          - kiosk/ komplett (index.html, app.js, style.css) — Dark Theme, Touch-optimiert
          - homeassistant/packages/formicarium_cam.yaml — camera + IR light + Automationen
          - scripts/setup_kiosk_rpi.sh — nginx + Chromium Autostart
          - Kamera-Pins recherchiert: DFR1154 OV3660, IR=GPIO47
```

## Nächste geplante Sessions
| Umgebung | Aufgabe |
|----------|---------|
| Claude Code (Lokal) | ESP32 Kamera flashen — WIFI_SSID, MQTT_BROKER in main.cpp anpassen |
| Claude Code (Lokal) | setup_kiosk_rpi.sh auf RPi ausführen |
| Claude Code (Lokal) | F360 öffnen → layer_01_water.py ausführen → DXF exportieren → verifizieren |
| Claude Code (Lokal) | ESP32 Sensor-Node: PlatformIO-Setup + MQTT-Skeleton |
| claude.ai (Cloud) | Logbuch-Update sobald Eier sichtbar |
