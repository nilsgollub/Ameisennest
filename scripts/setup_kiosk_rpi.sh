#!/usr/bin/env bash
# ============================================================
# FORMICA-OS — Kiosk-Setup für Raspberry Pi 4
#
# Einrichten von:
#   - nginx (Webserver für kiosk/index.html)
#   - Chromium im Kiosk-Modus (fullscreen, kein UI)
#   - Bildschirmschoner deaktivieren (24/7-Display)
#   - Autostart via XDG
#
# Voraussetzungen:
#   - Raspberry Pi OS (Bookworm 64-bit empfohlen)
#   - Desktop-Umgebung vorhanden (LXDE / Wayfire)
#   - Kiosk-Dateien bereits in ~/kiosk/ vorhanden
#     (oder Script clont das Repo)
#
# Ausführen:
#   sudo bash scripts/setup_kiosk_rpi.sh
#   sudo bash scripts/setup_kiosk_rpi.sh --user pi
#
# Idempotent: mehrfaches Ausführen schadet nicht.
# ============================================================

set -euo pipefail

# --- Konfiguration ------------------------------------------
KIOSK_USER="${2:-${SUDO_USER:-pi}}"
KIOSK_DIR="/home/${KIOSK_USER}/kiosk"
AUTOSTART_DIR="/home/${KIOSK_USER}/.config/autostart"
NGINX_SITE="/etc/nginx/sites-available/formica-kiosk"
KIOSK_URL="http://localhost"

# AntSim-Screensaver: wird LOKAL aus einem git-Klon ausgeliefert (entkoppelt von
# Home Assistant — ein hängender HA blackt den Kiosk nicht mehr aus). Der Klon
# enthält das committete dist/ (kein Node/Build auf dem Pi nötig) und wird beim
# Boot per `git pull` aktualisiert (Autostart-Eintrag weiter unten).
ANTSIM_DIR="/home/${KIOSK_USER}/AntSim_V2"
ANTSIM_REPO="${ANTSIM_REPO:-https://github.com/nilsgollub/AntSim_V2.git}"

# Repo-Pfad (Skript liegt in scripts/ → Parent = Repo-Root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Farben für Ausgabe
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_ok()   { echo -e "${GREEN}[OK]${NC}    $1"; }
log_info() { echo -e "${YELLOW}[INFO]${NC}  $1"; }
log_err()  { echo -e "${RED}[FEHLER]${NC} $1" >&2; }

# --- Root-Check ---------------------------------------------
if [[ $EUID -ne 0 ]]; then
    log_err "Bitte als root ausführen: sudo bash $0"
    exit 1
fi

echo "=============================================="
echo " FORMICA-OS Kiosk Setup"
echo " User:      ${KIOSK_USER}"
echo " Kiosk-Dir: ${KIOSK_DIR}"
echo " URL:       ${KIOSK_URL}"
echo "=============================================="

# ============================================================
# 1. Pakete installieren
# ============================================================
log_info "Installiere Pakete..."
apt-get update -qq
apt-get install -y -qq \
    nginx \
    unclutter \
    x11-xserver-utils \
    fonts-noto-color-emoji   # x11-xserver-utils für xset; Emoji-Font für die AntSim-Buttons (sonst Tofu-Kästchen)

# Chromium heißt je nach OS chromium-browser (RPi OS) oder chromium (Debian).
# Das erste Paket, das sich installieren lässt, gewinnt.
CHROMIUM_BIN=""
for pkg in chromium-browser chromium; do
    if apt-get install -y -qq "$pkg" 2>/dev/null; then
        CHROMIUM_BIN="$pkg"
        break
    fi
done
if [[ -z "$CHROMIUM_BIN" ]]; then
    log_err "Weder 'chromium-browser' noch 'chromium' installierbar — bitte manuell installieren"
    exit 1
fi
log_ok "Pakete installiert (Chromium: ${CHROMIUM_BIN})"

# ============================================================
# 2. Kiosk-Dateien kopieren
# ============================================================
log_info "Kopiere Kiosk-Dateien nach ${KIOSK_DIR}..."

if [[ -d "${REPO_ROOT}/kiosk" ]]; then
    mkdir -p "${KIOSK_DIR}"
    cp -r "${REPO_ROOT}/kiosk/"* "${KIOSK_DIR}/"
    chown -R "${KIOSK_USER}:${KIOSK_USER}" "${KIOSK_DIR}"
    log_ok "Kiosk-Dateien kopiert (${KIOSK_DIR})"
else
    log_err "kiosk/ Verzeichnis nicht gefunden in ${REPO_ROOT}"
    log_info "Bitte Kiosk-Dateien manuell nach ${KIOSK_DIR} kopieren"
fi

# ============================================================
# 2.9 AntSim klonen (lokaler Screensaver, self-update beim Boot)
# ============================================================
log_info "Klone/aktualisiere AntSim (${ANTSIM_REPO})..."
if [[ -d "${ANTSIM_DIR}/.git" ]]; then
    sudo -u "${KIOSK_USER}" git -C "${ANTSIM_DIR}" pull --ff-only || log_err "git pull fehlgeschlagen"
else
    sudo -u "${KIOSK_USER}" git clone --depth 1 "${ANTSIM_REPO}" "${ANTSIM_DIR}" || log_err "git clone fehlgeschlagen"
fi
if [[ -f "${ANTSIM_DIR}/dist/index.html" ]]; then
    log_ok "AntSim dist/ vorhanden (wird lokal als /antsim/ ausgeliefert)"
else
    log_err "AntSim dist/ fehlt — Screensaver bleibt leer (Repo enthaelt dist/?)"
fi

# ============================================================
# 3. nginx konfigurieren
# ============================================================
log_info "Konfiguriere nginx..."

cat > "${NGINX_SITE}" << EOF
# FORMICA-OS Kiosk — nginx Site-Konfiguration
# Dient kiosk/index.html als Einzelseiten-App (keine PHP, kein CGI)
server {
    listen      80 default_server;
    listen      [::]:80 default_server;
    server_name localhost;

    root  ${KIOSK_DIR};
    index index.html;

    # Keine Logs für Kiosk-Traffic (reduziert SD-Karten-Schreibzugriffe)
    access_log off;
    error_log  /var/log/nginx/formica-kiosk-error.log warn;

    # Statische Dateien mit kurzen Cache-Headern
    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-store";
    }

    # AntSim-Screensaver: LOKAL aus dem git-Klon ausgeliefert (entkoppelt von Home
    # Assistant — ein haengender HA blackt den Kiosk nicht mehr aus). Der Klon enthaelt
    # das committete dist/; `git pull` beim Boot aktualisiert es (Autostart unten).
    # no-store -> jeder Screensaver-Aufruf holt den frischen Build.
    location /antsim/ {
        alias ${ANTSIM_DIR}/dist/;
        add_header Cache-Control "no-store" always;
    }
}
EOF

# Default-Site deaktivieren, Kiosk-Site aktivieren
rm -f /etc/nginx/sites-enabled/default
ln -sf "${NGINX_SITE}" /etc/nginx/sites-enabled/formica-kiosk

nginx -t && systemctl reload nginx
log_ok "nginx konfiguriert und neu geladen"

# ============================================================
# 4. XDG-Autostart: Bildschirmschoner deaktivieren
# ============================================================
log_info "Erstelle Autostart-Einträge..."

mkdir -p "${AUTOSTART_DIR}"

# Bildschirmschoner und DPMS ausschalten damit das Display 24/7 läuft
cat > "${AUTOSTART_DIR}/formica-screensaver-off.desktop" << 'EOF'
[Desktop Entry]
Type=Application
Name=Formica Screensaver Off
Comment=Bildschirmschoner und DPMS fuer Formica-Kiosk deaktivieren
Exec=bash -c "xset s off && xset -dpms && xset s noblank"
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF

# AntSim beim Boot aktualisieren (self-update): git pull im Klon, bevor der
# Screensaver geladen wird. Laeuft parallel zum Kiosk-Start; das committete dist/
# wird sofort lokal ausgeliefert (kein Build noetig).
# Retry mit Backoff: beim Boot steht das WLAN oft noch nicht — ein einzelner
# fehlgeschlagener Pull liesse den Kiosk bis zum naechsten Reboot auf der alten
# Version. 5 Versuche a 10s ueberbruecken die Netz-Anlaufzeit; schlaegt es ganz
# fehl, laeuft der Kiosk einfach mit dem committeten dist/ weiter (kein Blackout).
cat > "${AUTOSTART_DIR}/formica-antsim-update.desktop" << EOF
[Desktop Entry]
Type=Application
Name=Formica AntSim Auto-Update
Comment=git pull the local AntSim screensaver on boot (self-update from GitHub, retries while WLAN comes up)
Exec=bash -lc 'for i in 1 2 3 4 5; do echo "[\$(date)] pull attempt \$i"; git -C ${ANTSIM_DIR} pull --ff-only && break; sleep 10; done >> /home/${KIOSK_USER}/antsim-update.log 2>&1'
X-GNOME-Autostart-enabled=true
Hidden=false
NoDisplay=false
EOF

# ============================================================
# 5. XDG-Autostart: Chromium im Kiosk-Modus
# ============================================================
# Flags erklärt:
#   --kiosk              Vollbild, kein Schliessen via GUI
#   --app=URL            App-Modus: keine Tabs, kein Adressfeld
#   --no-sandbox         Nötig auf RPi ohne Seccomp-Unterstützung
#   --disable-infobars   "Chrome wird von automatisierter..." ausblenden
#   --noerrdialogs       Keine Crash-Dialoge
#   --check-for-update-interval=604800  Update-Check einmal/Woche
#   --disable-translate  Kein Übersetzungsangebot
#   --overscroll-history-navigation=0  Kein Wischgesten-Navigation
#   --password-store=basic  Kein System-Keyring → verhindert Keyring-Passwort-Dialog
#   --use-mock-keychain     Mock-Keychain als Fallback (macOS-Kompatibilität, schadet nicht)
#   --disk-cache-size=1     Disk-Cache praktisch aus → laedt nach jedem Deploy frisch
#                           (verhindert "Load fail" auf alte, geloeschte JS-Chunks)

# Chromium-Aufruf in ein Launcher-Skript faktorisieren, damit Autostart UND der
# Watchdog (unten) exakt denselben Befehl nutzen.
LAUNCHER="/home/${KIOSK_USER}/formica-launch-chromium.sh"
cat > "${LAUNCHER}" << EOF
#!/usr/bin/env bash
exec ${CHROMIUM_BIN} --kiosk --app=${KIOSK_URL} --no-sandbox --disable-infobars --noerrdialogs --disable-translate --overscroll-history-navigation=0 --password-store=basic --use-mock-keychain --check-for-update-interval=604800 --disable-features=TranslateUI --start-maximized --disk-cache-size=1
EOF
chmod +x "${LAUNCHER}"

cat > "${AUTOSTART_DIR}/formica-kiosk.desktop" << EOF
[Desktop Entry]
Type=Application
Name=Formica Kiosk
Comment=FORMICA-OS Kiosk Chromium Vollbildanzeige
Exec=${LAUNCHER}
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF

# Watchdog: prueft alle 30s, ob Chromium laeuft, und startet es sonst neu. Laeuft in
# der X-Session (erbt DISPLAY/XAUTHORITY), deshalb kann es den Browser direkt wieder
# hochziehen — der letzte Single-Point-of-Failure (Browser-Crash/Hang ohne Reboot).
WATCHDOG="/home/${KIOSK_USER}/formica-watchdog.sh"
cat > "${WATCHDOG}" << EOF
#!/usr/bin/env bash
# Relaunch Chromium if it dies. pgrep matches both chromium and chromium-browser.
sleep 20   # dem ersten Autostart-Launch Zeit geben
while true; do
    if ! pgrep -f -- '--kiosk --app=' > /dev/null; then
        echo "[\$(date)] chromium not running -> relaunch" >> /home/${KIOSK_USER}/formica-watchdog.log
        "${LAUNCHER}" >> /home/${KIOSK_USER}/formica-watchdog.log 2>&1 &
    fi
    sleep 30
done
EOF
chmod +x "${WATCHDOG}"

cat > "${AUTOSTART_DIR}/formica-watchdog.desktop" << EOF
[Desktop Entry]
Type=Application
Name=Formica Kiosk Watchdog
Comment=Chromium neu starten, falls der Kiosk-Browser abstuerzt oder haengt
Exec=${WATCHDOG}
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF

# ============================================================
# 6. Optional: Unclutter (Mauszeiger verstecken nach Inaktivität)
# ============================================================
cat > "${AUTOSTART_DIR}/formica-unclutter.desktop" << 'EOF'
[Desktop Entry]
Type=Application
Name=Unclutter
Comment=Mauszeiger nach 1 Sekunde Inaktivitaet verstecken
Exec=unclutter -idle 1 -root
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF

# Berechtigungen setzen
chown -R "${KIOSK_USER}:${KIOSK_USER}" "${AUTOSTART_DIR}"
log_ok "Autostart-Einträge erstellt (${AUTOSTART_DIR})"

# ============================================================
# 7. Zusammenfassung
# ============================================================
echo ""
echo "=============================================="
echo " Setup abgeschlossen!"
echo "=============================================="
echo ""
echo "  Kiosk-Dateien:  ${KIOSK_DIR}"
echo "  nginx:          http://localhost → ${KIOSK_DIR}/index.html"
echo "  Autostart:      ${AUTOSTART_DIR}"
echo ""
echo "  Nächste Schritte:"
echo "  1. WLAN-Verbindung prüfen (RPi und ESP32 im gleichen Netz)"
echo "  2. mDNS testen: ping formicarium-cam1.local"
echo "  3. Kiosk testen: ${CHROMIUM_BIN} http://localhost"
echo "  4. Raspberry Pi neu starten → Kiosk startet automatisch"
echo ""
log_info "Neustart empfohlen: sudo reboot"
