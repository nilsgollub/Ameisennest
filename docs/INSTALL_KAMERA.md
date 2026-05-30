# FORMICA-OS · Kameranode Installationsanleitung

Verifiziert: DFRobot DFR1154 · Windows 11 PC · RPi 4 Debian 13 Trixie.

---

## Netzwerk-Topologie

```
PC (Windows 11)              192.168.1.x
ESP32 Kamera (DFR1154)       192.168.1.201  (statisch)
RPi Kiosk (7" Touchscreen)   192.168.1.147
RPi Home Assistant           192.168.1.155  (Mosquitto MQTT)
```

---

## Schritt 1 — ESP32: Secrets konfigurieren

Vorlage kopieren:
```bash
cp firmware/esp32_cam/credentials.ini.example firmware/esp32_cam/credentials.ini
```

`credentials.ini` befüllen (nicht in git):
```ini
[env:dfr1154_cam]
build_flags =
    ${base.build_flags}
    -DWIFI_SSID=\"DeineSSID\"
    -DWIFI_PASS=\"DeinWLANPasswort\"
    -DMQTT_BROKER=\"192.168.1.155\"
    -DMQTT_USER=\"DeinHAUser\"
    -DMQTT_PASS=\"DeinHAPasswort\"
```

Statische IP in `firmware/esp32_cam/src/main.cpp` (~Zeile 50):
```cpp
static const IPAddress STATIC_IP (192, 168, 1, 201);
```

---

## Schritt 2 — ESP32 flashen (Windows, PlatformIO)

```bash
cd firmware/esp32_cam
pio run -t upload
pio run -t monitor    # Diagnose
```

**Windows-Stolpersteine:**

`No module named 'fatfs.wrapper'` → Platform auf 6.5.0 gepinnt (bereits in `platformio.ini`).
Falls trotzdem:
```bash
C:\Users\<user>\.platformio\penv\Scripts\pip.exe install fatfs
```

COM-Port in `platformio.ini` anpassen (aktuell COM7):
```ini
upload_port = COM7
monitor_port = COM7
```

**Erwartete Serial-Ausgabe:**
```
=== FORMICA-OS Kameranode ===
[IR] LED auf GPIO 47 initialisiert
[WIFI] Verbunden! IP: 192.168.1.201
[mDNS] Erreichbar als http://formicarium-cam1.local
[CAM] PSRAM gefunden → SVGA 800×600, Q8, 2× Framebuffer
[CAM] OV3660 initialisiert
[ALS] LTR-308 initialisiert (I2C 0x53)
[MQTT] Verbinde mit Broker... OK
[MQTT] Heartbeat: {"online":true,"ip":"192.168.1.201",...}
```

**Schnelltest:**
```
http://192.168.1.201:81        → MJPEG-Stream
http://192.168.1.201/capture   → JPEG-Snapshot
http://192.168.1.201/ir?level=128  → IR auf 50%
http://192.168.1.201/          → JSON Status
```

---

## Schritt 3 — Kiosk-RPi einrichten

### 3.1 Pakete + Repo

```bash
sudo apt-get update
sudo apt-get install -y nginx chromium unclutter x11-xserver-utils git

git clone https://github.com/nilsgollub/Ameisennest.git ~/Ameisennest
```

### 3.2 nginx konfigurieren

```bash
sudo tee /etc/nginx/sites-available/formica-kiosk << 'EOF'
server {
    listen 80 default_server;
    server_name localhost;
    root /home/nilsgollub/Ameisennest/kiosk;
    index index.html;
    access_log off;
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control no-store;
    }
}
EOF

sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -s /etc/nginx/sites-available/formica-kiosk /etc/nginx/sites-enabled/formica-kiosk
sudo nginx -t && sudo systemctl reload nginx
```

### 3.3 Reboot-Service einrichten

```bash
# Sudo NOPASSWD für reboot
echo 'nilsgollub ALL=(ALL) NOPASSWD: /sbin/reboot' | sudo tee /etc/sudoers.d/formica-reboot
sudo chmod 440 /etc/sudoers.d/formica-reboot
```

### 3.4 Autostart einrichten

```bash
mkdir -p ~/.config/autostart

# Chromium Kiosk
cat > ~/.config/autostart/formica-kiosk.desktop << 'EOF'
[Desktop Entry]
Type=Application
Name=Formica Kiosk
Exec=chromium --kiosk --app=http://localhost --no-sandbox --disable-infobars --noerrdialogs --disable-translate --overscroll-history-navigation=0 --password-store=basic --use-mock-keychain
Hidden=false
X-GNOME-Autostart-enabled=true
EOF

# Screensaver off
cat > ~/.config/autostart/formica-screensaver-off.desktop << 'EOF'
[Desktop Entry]
Type=Application
Name=Formica Screensaver Off
Exec=bash -c "xset s off && xset -dpms && xset s noblank"
Hidden=false
X-GNOME-Autostart-enabled=true
EOF

# Cursor verstecken
cat > ~/.config/autostart/formica-unclutter.desktop << 'EOF'
[Desktop Entry]
Type=Application
Name=Unclutter
Exec=unclutter -idle 1 -root
Hidden=false
X-GNOME-Autostart-enabled=true
EOF

# Reboot-Server (Port 8765 für Kiosk-Reboot-Button)
cat > ~/.config/autostart/formica-reboot-server.desktop << 'EOF'
[Desktop Entry]
Type=Application
Name=Formica Reboot Server
Exec=python3 /home/nilsgollub/Ameisennest/kiosk/reboot-server.py
Hidden=false
X-GNOME-Autostart-enabled=true
EOF
```

### 3.5 Update-Script anlegen

```bash
cat > ~/kiosk-update.sh << 'EOF'
#!/bin/bash
cd ~/Ameisennest
git pull
DISPLAY=:0 xdotool key ctrl+r 2>/dev/null || true
EOF
chmod +x ~/kiosk-update.sh
```

**Zukünftige Kiosk-Updates** (nach `git push` vom PC):
```bash
ssh nilsgollub@192.168.1.147 "~/kiosk-update.sh"
```

### 3.6 Neu starten

```bash
sudo reboot
```

---

## Schritt 4 — Home Assistant einbinden

### 4.1 Packages aktivieren

In `/config/configuration.yaml`:
```yaml
homeassistant:
  packages: !include_dir_named packages
```

### 4.2 Package deployen

Via Samba-Share `\\192.168.1.155\config\packages\`:
```
homeassistant/packages/formicarium_cam.yaml → /config/packages/formicarium_cam.yaml
```

### 4.3 HA neu laden

Entwicklerwerkzeuge → YAML → **MQTT neu laden**
(kein Voll-Neustart nötig für MQTT-Entities)

### 4.4 Entities

| Entity | Zustand |
|--------|---------|
| `camera.formicarium_cam1` | MJPEG-Stream + Snapshot |
| `light.formicarium_ir_led` | 0–255, Auto-Off 60s |
| `sensor.formicarium_lux` | lx, LTR-308 onboard |
| `binary_sensor.formicarium_cam1` | Online/Offline |

---

## Kiosk-Bedienung

| Steuerung | Funktion |
|-----------|---------|
| **ZOOM −/+** | 0.5× Schritte, 1×–5× |
| **IR AUS/33%/66%/MAX** | IR-LED Preset; Auto-Off nach 60s |
| **PAN ↑←⊕→↓** | Bildausschnitt verschieben; ⊕ = zentrieren |
| **↺ Reload** | Stream neu verbinden |
| **⏻ Reboot** | 2 Sekunden halten → Pi neu starten |
| **Drag auf Stream** | Freies Pan (Touch/Maus) |

Zoom und Pan-Position werden in `localStorage` gespeichert (Neustart-sicher).

---

## Fehlerbehebung

### PSRAM nicht erkannt (`Kein PSRAM → VGA Fallback`)
`board_build.arduino.memory_type = qio_opi` in `platformio.ini` prüfen.

### MQTT `rc=5` (Unauthorized)
`MQTT_USER`/`MQTT_PASS` in `credentials.ini` prüfen.

### MQTT `rc=-2` (Connection Failed)
`MQTT_BROKER`-IP prüfen. HA-RPi pingbar? Mosquitto läuft?

### IR-LED via HA schaltet sofort wieder aus
Bekannter uint32-Overflow-Bug → behoben in aktuellem Stand.

### nginx HTTP 500 auf RPi
```bash
chmod 755 ~ ~/Ameisennest ~/Ameisennest/kiosk
```

### Stream häufig unterbrochen
VGA (640×480) ist stabiler als SVGA. In `main.cpp`:
```cpp
config.frame_size = FRAMESIZE_VGA;
```

### mDNS `formicarium-cam1.local` nicht auflösbar
```bash
systemctl status avahi-daemon
```
Fallback: statische IP in `kiosk/app.js`:
```js
const CAM_HOST = '192.168.1.201';
```

---

## MQTT Referenz

```
formicarium/cam1/status        Heartbeat JSON alle 30s (retain)
formicarium/cam1/lux           Lux float alle 30s (retain)
formicarium/cam1/ir_level      IR-Stand 0-255 (retain, bei Änderung)
formicarium/cam1/cmd/ir_led    IR-Befehl 0-255 (HA → ESP32)
```

Test vom HA-RPi:
```bash
mosquitto_pub -h localhost -u Nils -P PASSWORT \
  -t formicarium/cam1/cmd/ir_led -m "128"
mosquitto_sub -h localhost -u Nils -P PASSWORT \
  -t "formicarium/cam1/#" -v
```

---

## Ports & Endpunkte

| Gerät | Port | Funktion |
|-------|------|---------|
| ESP32 | `:81` | MJPEG-Stream (WiFiServer) |
| ESP32 | `:80/capture` | JPEG-Snapshot |
| ESP32 | `:80/ir?level=N` | IR-LED setzen |
| ESP32 | `:80/` | JSON Status |
| RPi Kiosk | `:80` | Kiosk HTML (nginx) |
| RPi Kiosk | `:8765/reboot` | Pi-Reboot-API |
