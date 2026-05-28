# FORMICA-OS — Hardware Dokumentation

---

## Netzwerk-Topologie

```
Router (192.168.1.1)
├── ESP32 Kamera        192.168.1.201  (statisch)
├── RPi Kiosk           192.168.1.147  (DHCP/statisch)
└── RPi Home Assistant  192.168.1.155  (DHCP/statisch)
```

---

## ESP32 Kameranode — DFRobot DFR1154

**Zweck:** MJPEG-Livestream + IR-Nachtsicht + Umgebungslichtsensor

| Eigenschaft | Wert |
|-------------|------|
| MCU | ESP32-S3R8 (240 MHz, dual-core Xtensa LX7) |
| Flash | 16 MB |
| PSRAM | 8 MB OPI (board_build.arduino.memory_type = qio_opi) |
| Kamerasensor | OmniVision OV3660, 2MP, 160° FOV |
| IR-Empfindlichkeit | 940 nm (Nachtsicht ohne sichtbares Licht) |
| Stromversorgung | USB-C 5V oder VIN 3.7–15V |

### Onboard-Komponenten

| Komponente | Modell | GPIO | Funktion |
|------------|--------|------|----------|
| Kamera | OV3660 | DVP-Bus | 2MP, 160° |
| IR-LEDs | 5× 940nm | 47 | Nachtsicht, LEDC PWM 0–255 |
| Lichtsensor | LTR-308ALS | I2C 8/9 (0x53) | Umgebungslicht 0–157k lux |
| Mikrofon | PDM | 38 (CLK), 39 (DAT) | — |
| Verstärker | MAX98357 | 40–46 | — |
| Status-LED | — | 3 | Blau, onboard |
| SD-Karte | MMC 1-bit | 11, 12, 13 | — |

### Kamera DVP-Pinbelegung (OV3660)

| Signal | GPIO |
|--------|------|
| XCLK | 5 |
| SIOD (SDA) | 8 |
| SIOC (SCL) | 9 |
| VSYNC | 1 |
| HREF | 2 |
| PCLK | 15 |
| D0–D7 | 16, 18, 21, 17, 14, 7, 6, 4 |
| PWDN | –1 (hardwired) |
| RESET | –1 (hardwired) |

### Stream-Konfiguration

| Parameter | Wert |
|-----------|------|
| Auflösung | 640×480 (VGA) |
| Framerate | ~5 fps (200ms Intervall) |
| Format | MJPEG |
| Stream-Port | 81 (WiFiServer, eigener FreeRTOS-Task) |
| API-Port | 80 (esp_http_server) |
| mDNS | formicarium-cam1.local |

### HTTP-Endpunkte

| Endpoint | Funktion |
|----------|----------|
| `GET :81/` | MJPEG-Stream |
| `GET :80/capture` | JPEG-Snapshot |
| `GET :80/ir?level=0-255` | IR-LED setzen |
| `GET :80/` | JSON-Status |

### MQTT-Topics

| Topic | Richtung | Inhalt |
|-------|----------|--------|
| `formicarium/cam1/status` | ESP32 → HA | JSON Heartbeat (30s, retain) |
| `formicarium/cam1/lux` | ESP32 → HA | float lux (30s, retain) |
| `formicarium/cam1/ir_level` | ESP32 → HA | 0–255 (bei Änderung, retain) |
| `formicarium/cam1/cmd/ir_led` | HA → ESP32 | 0–255 |

### PlatformIO-Konfiguration

```ini
platform  = espressif32@6.5.0    ; gepinnt wegen Python 3.13 fatfs-Bug
board     = esp32-s3-devkitc-1
board_build.arduino.memory_type = qio_opi
board_build.partitions          = huge_app.csv
upload_port = COM7
```

---

## Raspberry Pi Kiosk — RPi 4

**Zweck:** Touchscreen-Display für Kamerastream

| Eigenschaft | Wert |
|-------------|------|
| IP | 192.168.1.147 |
| OS | Debian 13 Trixie (aarch64) |
| User | nilsgollub |
| Display | Offizielles RPi 7" Touchscreen (2nd Gen) |

### Software-Stack

| Dienst | Konfiguration |
|--------|---------------|
| nginx | Port 80 → `/home/nilsgollub/kiosk/` |
| Chromium | Kiosk-Modus, `http://localhost`, `--password-store=basic` |
| Autostart | `~/.config/autostart/*.desktop` (XDG) |

### Kiosk-Features

- MJPEG-Stream von `http://formicarium-cam1.local:81`
- IR-Slider 0–255 + Preset-Buttons (Aus / 33% / 66% / 100%)
- Zoom 1×–5× (CSS object-fit + object-position)
- Pan per Drag/Touch (Bildausschnitt verschiebbar)
- Reload-Button (Stream-Reconnect ohne Page-Reload)
- Zoom + Pan in localStorage persistiert

---

## Raspberry Pi Home Assistant — RPi 4

**Zweck:** Heimautomation, MQTT-Broker, Kamera-Integration

| Eigenschaft | Wert |
|-------------|------|
| IP | 192.168.1.155 |
| OS | Home Assistant OS |
| MQTT | Mosquitto Add-on, Port 1883 |
| Samba | Share `config` → `/config/` |

### HA-Entities (Kameranode)

| Entity | Typ | Funktion |
|--------|-----|----------|
| `camera.formicarium_cam1` | camera | MJPEG-Stream + Snapshot |
| `light.formicarium_ir_led` | light | IR-LED Helligkeit 0–255 |
| `sensor.formicarium_lux` | sensor | Umgebungslicht (lx) |
| `sensor.formicarium_cam1_ip` | sensor | ESP32-IP aus Heartbeat |
| `binary_sensor.formicarium_cam1` | binary_sensor | Online/Offline |

---

## Geplante Hardware — Sensor-Node (Phase 2/3)

Noch nicht verbaut. Firmware-Gerüst unter `firmware/esp32_formicarium/`.

| Sensor | Modell | Messgrösse | Einbauort |
|--------|--------|-----------|-----------|
| Temp + Feuchte | SHT40 | °C / %RH | Arena |
| Nestkern-Temp | DS18B20 | °C | Korknest-Innenkanal (∅4.5mm) |
| Licht | TSL2591 | Lux | Nestdeckel |
| IR-LED | WS2812B 660nm | — | Rotlicht (Beobachtung) |
| Servo | — | — | Honigwasser-Dispenser |

### Geplante MQTT-Topics (Sensor-Node)

```
formicarium/node1/temp_arena         # °C, SHT40
formicarium/node1/humidity_arena     # %RH, SHT40
formicarium/node1/temp_nest_core     # °C, DS18B20
formicarium/node1/lux                # lux, TSL2591
formicarium/node1/status             # JSON Heartbeat
formicarium/node1/cmd/light          # 0–255, Rotlicht PWM
formicarium/node1/cmd/feeder         # bool, Servo-Trigger
```

---

## Korknest — Design-Parameter v1.0

Fertigung ausstehend. CAD-Scripts unter `scripts/fusion360/`.

| Parameter | Wert |
|-----------|------|
| Plattenformat | 200 × 200 × 20 mm (Naturkork) |
| Nest-Bereich | ~120 × 80 mm |
| Worker-Tunnel ∅ | 3.5 mm |
| Queen-Passage ∅ | 6.0 mm |
| Worker-Kammerhöhe | 6 mm |
| Queen/Brut-Kammerhöhe | 10 mm |
| Wasserkanal | 4 × 4 mm, Layer 1 |
| Sensorkanal | ∅ 4.5 mm, Layer 1→2 |
| Arena-Port | ∅ 8 mm |
| Führungsstifte | ∅ 6 mm, 4× pro Layer |
| Layer-Anzahl | 3–4 (stapelbar, modular) |
| Verbindung | Mechanisch via Führungsstifte, kein Kleber |
| DXF-Naming | `cad/korknest_v1/exports/layer_{nn}_{name}.dxf` |
