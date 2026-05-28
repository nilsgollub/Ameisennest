/**
 * FORMICA-OS Kiosk — JavaScript
 *
 * Funktionen:
 *   1. MJPEG-Stream laden und bei Verbindungsabbruch
 *      automatisch neu starten (Watchdog).
 *   2. IR-LED-Level per HTTP-Request direkt an den ESP32 senden.
 *      Der Kiosk spricht den ESP32 direkt an (kein Umweg über HA),
 *      weil das die Latenz auf <50 ms reduziert.
 *   3. IR-Level in localStorage persistieren (überlebt Page-Reload).
 *
 * Konfiguration: CAM_HOST am Anfang dieser Datei anpassen.
 */

'use strict';

// ============================================================
// Konfiguration
// ============================================================

/** Hostname des ESP32-Kameranodes (mDNS oder IP). */
const CAM_HOST   = 'formicarium-cam1.local';
const STREAM_URL = `http://${CAM_HOST}:81`;   // Port 81: eigener Stream-Task
const IR_URL     = (level) => `http://${CAM_HOST}/ir?level=${level}`; // Port 80: API

/** Nach diesem Timeout (ms) ohne Bild → Reconnect auslösen. */
const STREAM_TIMEOUT_MS = 15000;

/** Wartezeit vor Reconnect-Versuch (ms). */
const RECONNECT_DELAY_MS = 2000;

/** IR-Debounce beim Slider (ms). */
const IR_DEBOUNCE_MS = 180;

// ============================================================
// DOM-Referenzen
// ============================================================
const camStream       = document.getElementById('cam-stream');
const streamContainer = document.getElementById('stream-container');
const streamOverlay   = document.getElementById('stream-overlay');
const overlayText     = document.getElementById('overlay-text');
const irSlider        = document.getElementById('ir-slider');
const irValue         = document.getElementById('ir-value');
const presetBtns      = document.querySelectorAll('.preset-btn');
const reloadBtn       = document.getElementById('reload-btn');

// ============================================================
// IR-LED Steuerung
// ============================================================
let irDebounceTimer = null;
let currentIrLevel  = parseInt(localStorage.getItem('ir_level') ?? '0', 10);

/**
 * Setzt das IR-Level in der UI (Slider, Wertanzeige, Buttons,
 * Glow-Effekt) ohne einen HTTP-Request zu senden.
 */
function updateIrUi(level) {
    level = Math.max(0, Math.min(255, level));
    currentIrLevel = level;

    irSlider.value = level;
    irValue.textContent = level;
    irValue.classList.toggle('off', level === 0);

    // Track-Fill: CSS Custom Property
    const pct = (level / 255 * 100).toFixed(1);
    irSlider.style.setProperty('--slider-pct', `${pct}%`);

    // Preset-Buttons: aktiv markieren wenn Wert exakt passt
    const presets = [0, 85, 170, 255];
    presetBtns.forEach((btn, i) => {
        btn.classList.toggle('active', presets[i] === level);
    });

    // Glow-Effekt am Stream-Bereich wenn IR aktiv
    streamContainer.classList.toggle('ir-active', level > 0);
}

/**
 * Sendet das IR-Level an den ESP32 und persistiert es.
 * Fehler werden still ignoriert — der ESP behält seinen letzten
 * Zustand, und MQTT liefert den Wert ohnehin nach.
 */
async function sendIrLevel(level) {
    level = Math.max(0, Math.min(255, level));
    localStorage.setItem('ir_level', String(level));

    try {
        const resp = await fetch(IR_URL(level), { signal: AbortSignal.timeout(2000) });
        if (!resp.ok) console.warn('[IR] HTTP', resp.status);
    } catch (err) {
        // Netzwerkfehler oder Timeout — kein Crash
        console.warn('[IR] Fehler:', err.message);
    }
}

/** Debounced: UI sofort, HTTP-Request nach Pause. */
function onIrSliderInput(level) {
    updateIrUi(level);
    clearTimeout(irDebounceTimer);
    irDebounceTimer = setTimeout(() => sendIrLevel(level), IR_DEBOUNCE_MS);
}

// Event-Listener Slider
irSlider.addEventListener('input', () => {
    onIrSliderInput(parseInt(irSlider.value, 10));
});

// Event-Listener Preset-Buttons
presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
        const level = parseInt(btn.dataset.level, 10);
        updateIrUi(level);
        sendIrLevel(level);
    });
});

// Event-Listener Reload-Button
reloadBtn.addEventListener('click', () => {
    reconnectStream('Manueller Reload …');
});

// ============================================================
// MJPEG-Stream Watchdog
// ============================================================
let streamWatchdogTimer = null;
let reconnectTimer      = null;
let isReconnecting      = false;

function showOverlay(text) {
    overlayText.textContent = text;
    streamOverlay.classList.add('visible');
    camStream.classList.add('loading');
}

function hideOverlay() {
    streamOverlay.classList.remove('visible');
    camStream.classList.remove('loading');
    isReconnecting = false;
}

/**
 * Startet oder resettet den Stream-Watchdog.
 * Wenn innerhalb von STREAM_TIMEOUT_MS kein neues Bild kommt
 * (naturalWidth bleibt 0 oder Fehler), wird Reconnect ausgelöst.
 */
function resetWatchdog() {
    clearTimeout(streamWatchdogTimer);
    streamWatchdogTimer = setTimeout(() => {
        console.warn('[STREAM] Watchdog ausgelöst — kein Bild empfangen');
        reconnectStream('Verbindung unterbrochen …');
    }, STREAM_TIMEOUT_MS);
}

function reconnectStream(reason = 'Reconnect …') {
    if (isReconnecting) return;
    isReconnecting = true;

    clearTimeout(streamWatchdogTimer);
    clearTimeout(reconnectTimer);

    showOverlay(reason);

    // Stream-URL kurz entfernen, dann neu setzen → Browser baut
    // neue HTTP-Verbindung auf
    camStream.src = '';

    reconnectTimer = setTimeout(() => {
        showOverlay('Verbinde …');
        camStream.src = STREAM_URL;
        resetWatchdog();
    }, RECONNECT_DELAY_MS);
}

// Erster Byte empfangen → Watchdog zurücksetzen
// Das 'load'-Event feuert beim ersten vollständigen JPEG-Frame.
camStream.addEventListener('load', () => {
    hideOverlay();
    resetWatchdog();
});

// Bild-Fehler (404, Netzwerk, etc.)
camStream.addEventListener('error', () => {
    if (!isReconnecting) {
        console.warn('[STREAM] Fehler beim Laden');
        reconnectStream('Kamera nicht erreichbar …');
    }
});

// ============================================================
// Initialisierung
// ============================================================

/** Seite bereit: Stream starten und letzten IR-Level wiederherstellen. */
document.addEventListener('DOMContentLoaded', () => {
    // IR-Level aus localStorage wiederherstellen
    updateIrUi(currentIrLevel);
    // Kein automatisches Re-Senden beim Start — der ESP32 hat
    // seinen Zustand von MQTT (retain). Nur UI wiederherstellen.

    // Stream starten
    showOverlay('Verbinde …');
    camStream.src = STREAM_URL;
    resetWatchdog();

    console.info(`[FORMICA] Kiosk gestartet. Kamera: ${CAM_HOST}`);
});

// Seite wird sichtbar (z.B. Tab-Wechsel, Kiosk-Wake)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !isReconnecting) {
        // Kurzer Check: Bild noch valide?
        if (camStream.naturalWidth === 0) {
            reconnectStream('Wiederverbinde …');
        }
    }
});
