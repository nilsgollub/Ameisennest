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
const zoomSlider      = document.getElementById('zoom-slider');
const zoomValue       = document.getElementById('zoom-value');

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
// Pan (Bildausschnitt verschieben)
// ============================================================
// panX/panY: 0–100% = CSS transform-origin.
// 50/50 = Mitte (kein Pan), 0/0 = oben-links, 100/100 = unten-rechts.
// Bei zoom=1 kein sichtbarer Effekt.

let panX = parseFloat(localStorage.getItem('panX') ?? '50');
let panY = parseFloat(localStorage.getItem('panY') ?? '50');

function applyPan() {
    camStream.style.setProperty('--pan-x', `${panX.toFixed(1)}%`);
    camStream.style.setProperty('--pan-y', `${panY.toFixed(1)}%`);
}

function savePan() {
    localStorage.setItem('panX', String(panX));
    localStorage.setItem('panY', String(panY));
}

function movePan(dx, dy) {
    panX = Math.max(0, Math.min(100, panX + dx));
    panY = Math.max(0, Math.min(100, panY + dy));
    applyPan();
    savePan();
}

// D-Pad Buttons
document.querySelectorAll('.pan-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        const dx = parseFloat(btn.dataset.dx ?? '0');
        const dy = parseFloat(btn.dataset.dy ?? '0');
        movePan(dx, dy);
    });
});

document.getElementById('pan-center-btn').addEventListener('click', () => {
    panX = 50; panY = 50;
    applyPan(); savePan();
});

// Drag-to-Pan (Maus + Touch als Alternative zu D-Pad)
let dragStart = null;

camStream.addEventListener('mousedown', (e) => {
    e.preventDefault();
    dragStart = { x: e.clientX, y: e.clientY, panX, panY };
});
window.addEventListener('mousemove', (e) => {
    if (!dragStart) return;
    const zoom = parseFloat(zoomSlider.value) / 10;
    if (zoom <= 1.05) return;
    const W = streamContainer.clientWidth || 800;
    const H = streamContainer.clientHeight || 480;
    panX = Math.max(0, Math.min(100, dragStart.panX - (e.clientX - dragStart.x) / W * 100));
    panY = Math.max(0, Math.min(100, dragStart.panY - (e.clientY - dragStart.y) / H * 100));
    applyPan();
});
window.addEventListener('mouseup', () => { if (dragStart) savePan(); dragStart = null; });

camStream.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const t = e.touches[0];
    dragStart = { x: t.clientX, y: t.clientY, panX, panY };
}, { passive: false });
camStream.addEventListener('touchmove', (e) => {
    if (!dragStart || e.touches.length !== 1) return;
    e.preventDefault();
    const zoom = parseFloat(zoomSlider.value) / 10;
    if (zoom <= 1.05) return;
    const t = e.touches[0];
    const W = streamContainer.clientWidth || 800;
    const H = streamContainer.clientHeight || 480;
    panX = Math.max(0, Math.min(100, dragStart.panX - (t.clientX - dragStart.x) / W * 100));
    panY = Math.max(0, Math.min(100, dragStart.panY - (t.clientY - dragStart.y) / H * 100));
    applyPan();
}, { passive: false });
camStream.addEventListener('touchend', () => { if (dragStart) savePan(); dragStart = null; });

// ============================================================
// Zoom
// ============================================================
const ZOOM_DEFAULT = 2.0;

function applyZoom(val) {
    const zoom = val / 10;
    streamContainer.style.setProperty('--zoom', zoom);
    zoomValue.textContent = zoom.toFixed(1) + '×';
    localStorage.setItem('zoom', String(val));
    if (zoom <= 1.05) { panX = 50; panY = 50; applyPan(); savePan(); }
}

zoomSlider.addEventListener('input', () => applyZoom(parseInt(zoomSlider.value, 10)));

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
    // Zoom + Pan aus localStorage wiederherstellen
    const savedZoom = parseInt(localStorage.getItem('zoom') ?? '20', 10);
    zoomSlider.value = savedZoom;
    applyZoom(savedZoom);
    applyPan();

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
