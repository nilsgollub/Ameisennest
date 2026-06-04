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

# Home-Assistant-Host, auf dem die AntSim als /local/antsim/ liegt. Der Kiosk
# proxied /antsim/ dorthin (siehe nginx-Block) und schneidet dabei
# X-Frame-Options raus, damit der iframe-Screensaver same-origin lädt.
# So muss die Sim NUR auf HA deployed werden (kein Kopieren ins Kiosk-Repo).
HA_HOST="${HA_HOST:-192.168.1.155:8123}"

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
    x11-xserver-utils   # für xset

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

    # AntSim-Screensaver: Reverse-Proxy auf Home Assistant (/local/antsim/).
    # Die Sim wird NUR auf HA deployed; hier wird sie same-origin durchgereicht,
    # und X-Frame-Options/CSP werden entfernt, damit der iframe sie einbetten darf
    # (HA sendet sonst X-Frame-Options: SAMEORIGIN -> weißes "refused to connect").
    location /antsim/ {
        proxy_pass http://${HA_HOST}/local/antsim/;
        proxy_hide_header X-Frame-Options;
        proxy_hide_header Content-Security-Policy;
        proxy_set_header  Host \$host;
        proxy_set_header  Accept-Encoding "";
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

cat > "${AUTOSTART_DIR}/formica-kiosk.desktop" << EOF
[Desktop Entry]
Type=Application
Name=Formica Kiosk
Comment=FORMICA-OS Kiosk Chromium Vollbildanzeige
Exec=${CHROMIUM_BIN} \\
    --kiosk \\
    --app=${KIOSK_URL} \\
    --no-sandbox \\
    --disable-infobars \\
    --noerrdialogs \\
    --disable-translate \\
    --overscroll-history-navigation=0 \\
    --password-store=basic \\
    --use-mock-keychain \\
    --check-for-update-interval=604800 \\
    --disable-features=TranslateUI \\
    --start-maximized
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
