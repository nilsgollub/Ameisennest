# FORMICA-OS · Kameranode Installationsanleitung

Ziel: DFRobot DFR1154 (ESP32-S3 AI CAM) als MJPEG-Livestream im
Heimnetz, steuerbar über den Kiosk-Browser auf dem Raspberry Pi 4
und über Home Assistant.

---

## Voraussetzungen

| Was | Mindestanforderung |
|-----|--------------------|
| Hardware | DFRobot DFR1154 (ESP32-S3 + OV3660) |
| | Raspberry Pi 4 mit Raspberry Pi OS Bookworm 64-bit |
| | Desktop-Umgebung (LXDE oder Wayfire) |
| | Touchscreen oder HDMI-Display am RPi |
| Netzwerk | WLAN-Router, ESP32 und RPi im selben Subnetz |
| Software (PC) | [PlatformIO](https://platformio.org) (VS Code Extension oder CLI) |
| | Home Assistant mit Mosquitto MQTT Add-on |

---

## Schritt 1 — ESP32 konfigurieren

Öffne `firmware/esp32_cam/src/main.cpp` und passe den Abschnitt
**Nutzer-Konfiguration** (Zeilen ~29–38) an:

```cpp
#define WIFI_SSID    "MeinNetz"          // WLAN-Name
#define WIFI_PASS    "MeinPasswort"      // WLAN-Passwort

static const IPAddress STATIC_IP   (192, 168, 1, 200); // freie IP im Netz
static const IPAddress GATEWAY     (192, 168, 1,   1); // Router-IP
static const IPAddress SUBNET      (255, 255, 255,  0);
static const IPAddress DNS_SERVER  (192, 168, 1,   1);

#define MQTT_BROKER  "192.168.1.100"    // IP des Raspberry Pi (HA)
```

> Die statische IP verhindert, dass sich der Kiosk-Browser neu
> konfigurieren muss wenn der DHCP-Lease erneuert wird.

---

## Schritt 2 — ESP32 flashen

```bash
# Im Repo-Root:
cd firmware/esp32_cam

# Kompilieren + flashen (USB-C Kabel am DFR1154)
pio run -t upload

# Seriellen Monitor öffnen (optional, zur Diagnose)
pio run -t monitor
```

**Erwartete Ausgabe im Monitor:**

```
=== FORMICA-OS Kameranode ===
[IR] LED auf GPIO 47 initialisiert
[WIFI] Verbinde mit 'MeinNetz'......
[WIFI] Verbunden! IP: 192.168.1.200
[mDNS] Erreichbar als http://formicarium-cam1.local
[CAM] PSRAM gefunden → SVGA 800×600, 2× Framebuffer
[CAM] OV3660 initialisiert
[MQTT] Verbinde mit Broker... OK
[HTTP] Server gestartet auf Port 80
[FORMICA] Kameranode bereit
```

**Schnelltest im Browser** (PC im gleichen Netz):
- `http://formicarium-cam1.local/` → JSON Status
- `http://formicarium-cam1.local/capture` → JPEG-Snapshot
- `http://formicarium-cam1.local/stream` → MJPEG-Livestream
- `http://formicarium-cam1.local/ir?level=128` → IR auf 50%

---

## Schritt 3 — Raspberry Pi Kiosk einrichten

Das Setup-Script installiert nginx, richtet Chromium im Kiosk-Modus
ein und deaktiviert den Bildschirmschoner.

```bash
# Auf dem Raspberry Pi als root ausführen:
sudo bash /pfad/zum/repo/scripts/setup_kiosk_rpi.sh

# Oder wenn das Repo unter /home/pi/Ameisennest liegt:
sudo bash /home/pi/Ameisennest/scripts/setup_kiosk_rpi.sh
```

Das Script ist idempotent — mehrfaches Ausführen schadet nicht.

**Manuell testen vor dem Neustart:**

```bash
# mDNS prüfen (muss den ESP32 auflösen)
ping formicarium-cam1.local

# nginx testen
curl http://localhost/

# Kiosk manuell starten
DISPLAY=:0 chromium-browser --kiosk http://localhost
```

**Dann neu starten:**

```bash
sudo reboot
```

Nach dem Neustart startet Chromium automatisch im Vollbild.

---

## Schritt 4 — Home Assistant einbinden

### 4.1 Packages-Verzeichnis aktivieren

Falls noch nicht vorhanden, in `configuration.yaml` auf dem RPi:

```yaml
homeassistant:
  packages: !include_dir_named packages
```

Dann die Kamera-Package-Datei an die richtige Stelle kopieren:

```bash
# Auf dem RPi (SSH oder Dateibrowser):
cp /home/pi/Ameisennest/homeassistant/packages/formicarium_cam.yaml \
   /config/packages/formicarium_cam.yaml
```

### 4.2 Konfiguration prüfen und neu laden

```bash
# Über SSH auf dem RPi (HA OS):
ha core check
ha core restart
```

### 4.3 Entities prüfen

Nach dem Neustart sollten diese Entities vorhanden sein:

| Entity | Erwarteter Zustand |
|--------|--------------------|
| `camera.formicarium_cam1` | Vorschaubild sichtbar |
| `light.formicarium_ir_led` | `off`, Helligkeit 0–255 |
| `binary_sensor.formicarium_cam1` | `on` (online) |
| `sensor.formicarium_cam1_ip` | `192.168.1.200` |

---

## Schritt 5 — Kiosk-Konfiguration anpassen

Der Hostname des ESP32 ist in `kiosk/app.js` Zeile 15 konfiguriert:

```js
const CAM_HOST = 'formicarium-cam1.local';
```

Falls mDNS im Netz nicht funktioniert, einfach die statische IP
eintragen:

```js
const CAM_HOST = '192.168.1.200';
```

Nach einer Änderung die Kiosk-Dateien neu auf den RPi kopieren:

```bash
sudo bash scripts/setup_kiosk_rpi.sh   # kopiert kiosk/ nach /home/pi/kiosk/
```

---

## Fehlerbehebung

### ESP32 bootet nicht / kein Serial-Output
- USB-C-Kabel prüfen (manche Kabel sind nur Ladekabel, kein Data)
- `ARDUINO_USB_CDC_ON_BOOT=1` ist in platformio.ini gesetzt →
  kein separater USB-Serial-Adapter nötig
- Falls Flash fehlschlägt: BOOT-Button gedrückt halten während USB
  angesteckt wird, dann `pio run -t upload`

### Kamera zeigt kein Bild (`[CAM] Initialisierung fehlgeschlagen`)
- PSRAM-Fehler: `board_build.psram_type = opi` in platformio.ini
  prüfen — ohne OPI friert der Sensor-Init ein
- Kamera-Kabel am DFR1154 sitzt lose → leicht andrücken

### Stream friert ein / Kiosk zeigt Reconnect-Overlay
- Nur ein Client kann den MJPEG-Stream gleichzeitig öffnen
  (httpd `max_open_sockets = 5`, aber Stream blockiert einen Task)
- HA-Kamera-Entity nicht gleichzeitig mit Kiosk öffnen beim Testen
- WLAN-Signal prüfen: ESP32 braucht stabiles RSSI > -70 dBm

### mDNS `formicarium-cam1.local` nicht auflösbar
- `avahi-daemon` auf dem RPi prüfen: `systemctl status avahi-daemon`
- Temporär: statische IP in `kiosk/app.js` und HA-Package eintragen

### IR-LED reagiert nicht auf Slider
- Browser-Konsole öffnen (F12): CORS-Fehler oder Netzwerkfehler?
- Direkttest: `curl "http://formicarium-cam1.local/ir?level=255"`
- IR-LEDs sind 940 nm — mit normaler Handykamera (die IR oft
  durchlässt) prüfen, ob die LEDs leuchten

---

## Referenz — MQTT Topics

```
formicarium/cam1/status           Heartbeat JSON alle 30 s (retain)
formicarium/cam1/ir_level         Aktueller IR-Stand 0-255 (retain)
formicarium/cam1/cmd/ir_led       IR-Befehl senden: "0"–"255"
```

Testen mit mosquitto_pub (auf dem RPi):

```bash
# IR auf 50%
mosquitto_pub -h localhost -t formicarium/cam1/cmd/ir_led -m "128"

# IR aus
mosquitto_pub -h localhost -t formicarium/cam1/cmd/ir_led -m "0"

# Heartbeat lesen
mosquitto_sub -h localhost -t "formicarium/cam1/#" -v
```
