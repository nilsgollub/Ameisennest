'use strict';

// ============================================================
// Konfiguration
// ============================================================
const CAM_HOST   = 'formicarium-cam1.local';
const STREAM_URL = `http://${CAM_HOST}:81`;
const IR_URL     = (level) => `http://${CAM_HOST}/ir?level=${level}`;

const STREAM_TIMEOUT_MS  = 15000;
const RECONNECT_DELAY_MS = 2000;

// Bildschirmschoner
// URL wird nach SCREENSAVER_TIMEOUT_MS Inaktivität als iframe geladen.
// Echte URL via SCREENSAVER_URL ersetzen, sobald bekannt.
const SCREENSAVER_URL         = './antsim/index.html?colonies=2';
const SCREENSAVER_TIMEOUT_MS  = 1 * 60 * 1000;            // 1 Minute

// Zoom: Schrittgrösse und Grenzen
const ZOOM_STEP = 0.5;
const ZOOM_MIN  = 1.0;
const ZOOM_MAX  = 5.0;

// ============================================================
// DOM-Referenzen
// ============================================================
const camStream       = document.getElementById('cam-stream');
const streamContainer = document.getElementById('stream-container');
const streamOverlay   = document.getElementById('stream-overlay');
const overlayText     = document.getElementById('overlay-text');
const zoomValue       = document.getElementById('zoom-value');
const reloadBtn       = document.getElementById('reload-btn');
const irBtns          = document.querySelectorAll('.ir-btn');

// ============================================================
// IR-LED Steuerung
// ============================================================
let currentIrLevel = parseInt(localStorage.getItem('ir_level') ?? '0', 10);

function updateIrUi(level) {
    currentIrLevel = level;
    irBtns.forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.level) === level);
    });
    localStorage.setItem('ir_level', String(level));
}

async function sendIrLevel(level) {
    updateIrUi(level);
    try {
        await fetch(IR_URL(level), { signal: AbortSignal.timeout(2000) });
    } catch (e) {
        console.warn('[IR]', e.message);
    }
}

irBtns.forEach(btn => {
    btn.addEventListener('click', () => sendIrLevel(parseInt(btn.dataset.level)));
});

// ============================================================
// Zoom
// ============================================================
let currentZoom = parseFloat(localStorage.getItem('zoom') ?? '2.0');

function applyZoom(z) {
    currentZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
    streamContainer.style.setProperty('--zoom', currentZoom);
    zoomValue.textContent = currentZoom.toFixed(1) + '×';
    localStorage.setItem('zoom', String(currentZoom));
    if (currentZoom <= 1.05) { panX = 50; panY = 50; applyPan(); savePan(); }
}

document.getElementById('zoom-minus').addEventListener('click', () => applyZoom(currentZoom - ZOOM_STEP));
document.getElementById('zoom-plus' ).addEventListener('click', () => applyZoom(currentZoom + ZOOM_STEP));

// ============================================================
// Pan
// ============================================================
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
    applyPan(); savePan();
}

document.querySelectorAll('.pan-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const dx = parseFloat(btn.dataset.dx ?? '0');
        const dy = parseFloat(btn.dataset.dy ?? '0');
        movePan(dx, dy);
    });
});

document.getElementById('pan-center-btn').addEventListener('click', () => {
    panX = 50; panY = 50; applyPan(); savePan();
});

// Drag-to-Pan (Touch + Maus als Alternative zu D-Pad)
let dragStart = null;

camStream.addEventListener('mousedown', (e) => {
    e.preventDefault();
    dragStart = { x: e.clientX, y: e.clientY, panX, panY };
});
window.addEventListener('mousemove', (e) => {
    if (!dragStart) return;
    if (currentZoom <= 1.05) return;
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
    if (currentZoom <= 1.05) return;
    const t = e.touches[0];
    const W = streamContainer.clientWidth || 800;
    const H = streamContainer.clientHeight || 480;
    panX = Math.max(0, Math.min(100, dragStart.panX - (t.clientX - dragStart.x) / W * 100));
    panY = Math.max(0, Math.min(100, dragStart.panY - (t.clientY - dragStart.y) / H * 100));
    applyPan();
}, { passive: false });

camStream.addEventListener('touchend', () => { if (dragStart) savePan(); dragStart = null; });

// ============================================================
// Reload-Button
// ============================================================
reloadBtn.addEventListener('click', () => reconnectStream('Manueller Reload …'));

document.getElementById('screensaver-btn').addEventListener('click', showScreensaver);

// ============================================================
// Reboot-Button (2 Sekunden halten → Pi neu starten)
// ============================================================
const rebootBtn = document.getElementById('reboot-btn');
const HOLD_MS   = 2000;

rebootBtn.style.setProperty('--hold-duration', `${HOLD_MS}ms`);

let holdTimer = null;

function startHold() {
    rebootBtn.classList.add('holding');
    holdTimer = setTimeout(async () => {
        rebootBtn.textContent = '…';
        try {
            await fetch('http://localhost:8765/reboot', { signal: AbortSignal.timeout(3000) });
        } catch (e) {
            // Verbindung bricht ab weil Pi neu startet — das ist OK
        }
        showOverlay('Pi startet neu …');
        rebootBtn.classList.remove('holding');
        rebootBtn.textContent = '⏻';
    }, HOLD_MS);
}

function cancelHold() {
    clearTimeout(holdTimer);
    rebootBtn.classList.remove('holding');
}

rebootBtn.addEventListener('mousedown',  startHold);
rebootBtn.addEventListener('mouseup',    cancelHold);
rebootBtn.addEventListener('mouseleave', cancelHold);
rebootBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startHold(); }, { passive: false });
rebootBtn.addEventListener('touchend',   cancelHold);
rebootBtn.addEventListener('touchcancel',cancelHold);

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

function resetWatchdog() {
    clearTimeout(streamWatchdogTimer);
    streamWatchdogTimer = setTimeout(() => {
        reconnectStream('Verbindung unterbrochen …');
    }, STREAM_TIMEOUT_MS);
}

function reconnectStream(reason = 'Reconnect …') {
    if (isReconnecting) return;
    isReconnecting = true;
    clearTimeout(streamWatchdogTimer);
    clearTimeout(reconnectTimer);
    showOverlay(reason);
    camStream.src = '';
    reconnectTimer = setTimeout(() => {
        showOverlay('Verbinde …');
        camStream.src = STREAM_URL;
        resetWatchdog();
    }, RECONNECT_DELAY_MS);
}

camStream.addEventListener('load',  () => { hideOverlay(); resetWatchdog(); });
camStream.addEventListener('error', () => { if (!isReconnecting) reconnectStream('Kamera nicht erreichbar …'); });

// ============================================================
// Initialisierung
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    applyZoom(currentZoom);
    applyPan();
    updateIrUi(currentIrLevel);

    showOverlay('Verbinde …');
    camStream.src = STREAM_URL;
    resetWatchdog();
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !isReconnecting && camStream.naturalWidth === 0) {
        reconnectStream('Wiederverbinde …');
    }
});

// ============================================================
// Bildschirmschoner
// ============================================================
const screensaverEl    = document.getElementById('screensaver');
const screensaverFrame = document.getElementById('screensaver-frame');
const screensaverClose = document.getElementById('screensaver-close');

let screensaverTimer  = null;
let screensaverActive = false;

function showScreensaver() {
    screensaverActive = true;
    screensaverFrame.src = SCREENSAVER_URL;
    screensaverEl.classList.remove('hidden');
    screensaverEl.setAttribute('aria-hidden', 'false');
}

function hideScreensaver() {
    screensaverActive = false;
    screensaverEl.classList.add('hidden');
    screensaverEl.setAttribute('aria-hidden', 'true');
    // src leeren damit kein Audio/Video im Hintergrund weiterläuft
    setTimeout(() => { screensaverFrame.src = ''; }, 300);
    resetScreensaverTimer();
}

function resetScreensaverTimer() {
    clearTimeout(screensaverTimer);
    screensaverTimer = setTimeout(showScreensaver, SCREENSAVER_TIMEOUT_MS);
}

// × Schaltfläche schließt Screensaver
screensaverClose.addEventListener('click',      hideScreensaver);
screensaverClose.addEventListener('touchstart', (e) => { e.preventDefault(); hideScreensaver(); }, { passive: false });

// Jede Benutzeraktion setzt den Idle-Timer zurück
['mousemove', 'mousedown', 'touchstart', 'keydown', 'wheel'].forEach(evt => {
    document.addEventListener(evt, () => {
        if (screensaverActive) return; // laufender Screensaver soll nicht durch Bewegung abgebrochen werden
        resetScreensaverTimer();
    }, { passive: true });
});

// Timer starten sobald die Seite bereit ist
resetScreensaverTimer();
