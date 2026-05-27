#pragma once
// ============================================================
// FORMICA-OS — Kamera-Pinbelegung DFRobot DFR1154
//
// Quelle: s60sc/ESP32-CAM_MJPEG2SD camera_pins.h
//         (CAMERA_MODEL_DFRobot_ESP32_S3_AI_CAM)
//         Verifiziert gegen DFRobot Wiki DFR1154
//
// Sensor:  OmniVision OV3660 · 2MP · 940 nm IR-sensitiv
//          Die Pin-Belegung des DVP-Interface ist identisch
//          zu OV2640; die Sensor-ID wird von esp_camera
//          automatisch erkannt.
//
// Wichtig: PWDN und RESET sind auf der DFR1154-Platine
//          hardwired — keine Software-Kontrolle nötig.
// ============================================================

// --- Infrarot-LED -------------------------------------------
// 5× 940 nm IR-LEDs, aktiv HIGH, PWM via LEDC
#define IR_LED_PIN      47

// --- Status-LED (onboard, blau) -----------------------------
#define STATUS_LED_PIN   3

// --- OV3660 DVP-Kamerabus -----------------------------------
#define CAM_PIN_PWDN    -1   // hardwired, kein GPIO
#define CAM_PIN_RESET   -1   // hardwired, kein GPIO
#define CAM_PIN_XCLK     5   // Master Clock (20 MHz)
#define CAM_PIN_SIOD     8   // SCCB Data  (I2C-ähnlich)
#define CAM_PIN_SIOC     9   // SCCB Clock

// Pixeldata D2…D9 (Y2…Y9 im esp_camera Naming)
#define CAM_PIN_D7      4
#define CAM_PIN_D6      6
#define CAM_PIN_D5      7
#define CAM_PIN_D4      14
#define CAM_PIN_D3      17
#define CAM_PIN_D2      21
#define CAM_PIN_D1      18
#define CAM_PIN_D0      16

// Synchronisation
#define CAM_PIN_VSYNC    1
#define CAM_PIN_HREF     2
#define CAM_PIN_PCLK    15

// --- SD-Karte (MMC 1-bit, optional) -------------------------
// Nur belegt wenn SD-Logging aktiviert; im Kamera-Node
// nicht verwendet (Daten gehen direkt per MQTT/HTTP).
#define SD_MMC_CLK      12
#define SD_MMC_CMD      13
#define SD_MMC_D0       11

// --- Mikrofon (PDM, für spätere Erweiterung) ----------------
#define MIC_PDM_DATA    39
#define MIC_PDM_CLK     38   // -1 für PDM-Mono, hier als Ref.

// --- Audio-Verstärker MAX98357 (für spätere Erweiterung) ----
#define AMP_BCLK        45
#define AMP_LRCLK       46
#define AMP_DIN         42
#define AMP_GAIN        41
#define AMP_MODE        40
