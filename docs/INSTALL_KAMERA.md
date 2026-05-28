# FORMICA-OS · Kameranode Installationsanleitung

Verifiziert mit: DFRobot DFR1154, Windows 11 PC, Raspberry Pi 4 Debian 13 Trixie.

---

## Netzwerk-Topologie

```
PC (Windows 11)              192.168.1.x
ESP32 Kamera (DFR1154)       192.168.1.201  (statisch)
RPi Kiosk (7" Touchscreen)   192.168.1.147
RPi Home Assistant           192.168.1.155  (Mosquitto MQTT)
```

Zwei separate Raspberry Pis — Kiosk und HA laufen getrennt.

---

## Schritt 1 — Secrets konfigurieren

Alle Zugangsdaten stehen in `firmware/esp32_cam/credentials.ini` (nicht in git).
Vorlage kopieren und befüllen:

```bash
cp firmware/esp32_cam/credentials.ini.example firmware/esp32_cam/credentials.ini
```

Dann in `credentials.ini` eintragen:

```ini
[env:dfr1154_cam]
build_flags =
    ${base.build_flags}
    -DWIFI_SSID=\"DeineSSID\"
    -DWIFI_PASS=\"DeinWLANPasswort\"
    -DMQTT_BROKER=\"192.168.1.155\"    ; IP des HA-RPi
    -DMQTT_USER=\"DeinHAUser\"
    -DMQTT_PASS=\"DeinHAPasswort\"
```

> MQTT-User ist ein normaler HA-Nutzer (Einstellungen → Personen → Nutzer).
> Kein anonymer Zugang nötig.

Statische IP des ESP32 steht in `src/main.cpp` Zeile ~47 — dort ggf. anpassen:

```cpp
static const IPAddress STATIC_IP (192, 168, 1, 201);
```

---

## Schritt 2 — ESP32 flashen (Windows, PlatformIO VS Code)

```bash
cd firmware/esp32_cam
pio run -t upload
```

**Bekannte Stolpersteine unter Windows:**

**`No module named 'fatfs.wrapper'`** — tritt auf wenn Python 3.13 als System-Python
verwendet wird. Fix: espressif32 auf 6.5.0 gepinnt (bereits in `platformio.ini`).
Falls der Fehler trotzdem auftritt:
```bash
C:\Users\<user>\.platformio\penv\Scripts\pip.exe install fatfs
```

**COM-Port** — PlatformIO erkennt ihn automatisch aus `platformio.ini`:
```ini
upload_port = COM7
monitor_port = COM7
```
Aktueller Port via Windows Geräte-Manager → Anschlüsse (COM & LPT).

**Erwartete Serial-Ausgabe** (`pio run -t monitor`):

```
=== FORMICA-OS Kameranode ===
[IR] LED auf GPIO 47 initialisiert
[WIFI] Verbinde mit 'Skynet'.
[WIFI] Verbunden! IP: 192.168.1.201
[mDNS] Erreichbar als http://formicarium-cam1.local
[CAM] PSRAM gefunden → SVGA 800×600, 2× Framebuffer
[CAM] OV3660 initialisiert
[MQTT] Verbinde mit Broker... OK
[MQTT] Heartbeat: {"online":true,"ip":"192.168.1.201",...}
```

**Schnelltest im Browser:**

```
http://192.168.1.201/stream    → MJPEG-Livestream
http://192.168.1.201/capture   → JPEG-Snapshot
http://192.168.1.201/ir?level=128  → IR auf 50%
http://192.168.1.201/          → JSON Status
```

---

## Schritt 3 — Kiosk-RPi einrichten

Getestet auf **Debian 13 Trixie (aarch64)**, Benutzer `nilsgollub`.

### 3.1 Pakete installieren

```bash
sudo apt-get update
sudo apt-get install -y nginx chromium unclutter x11-xserver-utils
```

> Debian 13: Paket heisst `chromium` (nicht `chromium-browser`).

### 3.2 Kiosk-Dateien kopieren

```bash
mkdir -p ~/kiosk
cp kiosk/index.html kiosk/app.js kiosk/style.css ~/kiosk/

# Berechtigungen setzen (nginx läuft als www-data und braucht Lesezugriff)
chmod 755 ~ ~/kiosk
chmod 644 ~/kiosk/*
```

### 3.3 nginx konfigurieren

```bash
sudo tee /etc/nginx/sites-available/formica-kiosk << 'EOF'
server {
    listen 80 default_server;
    server_name localhost;
    root /home/nilsgollub/kiosk;
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

# Test:
curl -o /dev/null -w '%{http_code}' http://localhost/
# → 200
```

### 3.4 Autostart einrichten

```bash
mkdir -p ~/.config/autostart

# Chromium Kiosk
cat > ~/.config/autostart/formica-kiosk.desktop << 'EOF'
[Desktop Entry]
Type=Application
Name=Formica Kiosk
Exec=chromium --kiosk --app=http://localhost --no-sandbox --disable-infobars --noerrdialogs --disable-translate --overscroll-history-navigation=0
Hidden=false
X-GNOME-Autostart-enabled=true
EOF

# Bildschirmschoner deaktivieren
cat > ~/.config/autostart/formica-screensaver-off.desktop << 'EOF'
[Desktop Entry]
Type=Application
Name=Formica Screensaver Off
Exec=bash -c "xset s off && xset -dpms && xset s noblank"
Hidden=false
X-GNOME-Autostart-enabled=true
EOF

# Mauszeiger verstecken
cat > ~/.config/autostart/formica-unclutter.desktop << 'EOF'
[Desktop Entry]
Type=Application
Name=Unclutter
Exec=unclutter -idle 1 -root
Hidden=false
X-GNOME-Autostart-enabled=true
EOF
```

### 3.5 Neu starten

```bash
sudo reboot
```

Nach dem Neustart startet Chromium automatisch im Vollbild mit dem Kamerastream.

---

## Schritt 4 — Home Assistant einbinden

### 4.1 Packages-Verzeichnis aktivieren

In `configuration.yaml` auf dem HA-RPi (192.168.1.155):

```yaml
homeassistant:
  packages: !include_dir_named packages
```

### 4.2 Package-Datei kopieren

```bash
cp homeassistant/packages/formicarium_cam.yaml /config/packages/
```

### 4.3 HA neu laden

```bash
ha core check
ha core restart
```

### 4.4 Erwartete Entities

| Entity | Zustand |
|--------|---------|
| `camera.formicarium_cam1` | Vorschaubild sichtbar |
| `light.formicarium_ir_led` | `off`, Helligkeit 0–255 |
| `binary_sensor.formicarium_cam1` | `on` (online) |
| `sensor.formicarium_cam1_ip` | `192.168.1.201` |

---

## Fehlerbehebung

### PSRAM nicht erkannt (`[CAM] Kein PSRAM → VGA Fallback`)
`board_build.arduino.memory_type = qio_opi` muss in `platformio.ini` stehen.
`psram_type = opi` allein reicht bei espressif32@6.5.0 nicht aus.

### MQTT `rc=5` (Unauthorized)
Broker erreichbar, aber Zugangsdaten falsch. `MQTT_USER` / `MQTT_PASS` in
`credentials.ini` prüfen. HA-Nutzer muss unter Einstellungen → Personen → Nutzer
angelegt sein mit aktiviertem „Lokaler Benutzer".

### MQTT `rc=-2` (Connection Failed)
Broker nicht erreichbar. IP in `credentials.ini` → `MQTT_BROKER` prüfen.
HA-RPi pingbar? Mosquitto Add-on läuft?

### nginx 500 auf dem Kiosk-RPi
Home-Verzeichnis oder kiosk-Ordner für www-data nicht lesbar.
```bash
chmod 755 ~ ~/kiosk
chmod 644 ~/kiosk/*
```

### Stream öffnet sich nicht im Kiosk
Nur ein Client kann den Stream gleichzeitig konsumieren. HA-Kamera-Entity
nicht parallel offen halten beim ersten Test.

### mDNS `formicarium-cam1.local` nicht auflösbar
Avahi auf dem Kiosk-RPi prüfen: `systemctl status avahi-daemon`.
Alternativ statische IP direkt in `kiosk/app.js` eintragen:
```js
const CAM_HOST = '192.168.1.201';
```

### IR-LEDs leuchten nicht
940 nm ist für das menschliche Auge nicht sichtbar. Handykamera-Test:
Die meisten Smartphone-Frontkameras zeigen IR als weißes/violettes Leuchten.
Direkttest: `curl "http://192.168.1.201/ir?level=255"`

---

## Kiosk-Dateien aktualisieren

Nach Änderungen an `kiosk/` auf den Kiosk-RPi übertragen (vom PC):

```powershell
# Windows mit PuTTY pscp:
pscp -pw "PASSWORT" -hostkey "SHA256:g7qB9MYP2m4F98S1mqWkWkzucFd1A6HtSPjp2Gtaxvk" `
  kiosk\index.html kiosk\app.js kiosk\style.css `
  nilsgollub@192.168.1.147:/home/nilsgollub/kiosk/
```

---

## MQTT Referenz

```
formicarium/cam1/status           Heartbeat JSON alle 30 s (retain)
formicarium/cam1/ir_level         Aktueller IR-Stand 0-255 (retain)
formicarium/cam1/cmd/ir_led       IR-Befehl: "0"–"255"
```

Test vom HA-RPi:

```bash
mosquitto_pub -h localhost -u Nils -P PASSWORT \
  -t formicarium/cam1/cmd/ir_led -m "128"

mosquitto_sub -h localhost -u Nils -P PASSWORT \
  -t "formicarium/cam1/#" -v
```
