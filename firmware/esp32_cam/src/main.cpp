// ============================================================
// FORMICA-OS — ESP32-S3 AI CAM · Kameranode
//
// Aufgaben:
//   1. MJPEG-Videostream  → Port 81  (eigener FreeRTOS-Task)
//   2. JPEG-Snapshot      → HTTP GET /capture (Port 80)
//   3. IR-LED-Steuerung   → HTTP GET /ir?level=0-255  (Port 80)
//                           MQTT sub formicarium/cam1/cmd/ir_led
//   4. MQTT-Heartbeat     → formicarium/cam1/status  (30 s, inkl. Lux)
//   5. IR-State-Publish   → formicarium/cam1/ir_level (bei Änderung)
//   6. Lux-Publish        → formicarium/cam1/lux  (alle 30 s, LTR-308)
//
// Architektur (Zwei-Port-Design):
//   Port 80 — esp_http_server: /capture, /ir, /  (API, non-blocking)
//   Port 81 — WiFiServer + FreeRTOS-Task: MJPEG-Stream (blocking)
//   Der Stream blockiert nur den eigenen Task, Port 80 bleibt frei.
//   Arduino loop() pollt MQTT unabhängig davon.
//
// Konfiguration: Abschnitt "Nutzer-Konfiguration" unten anpassen.
// ============================================================

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiServer.h>
#include <WiFiClient.h>
#include <Wire.h>
#include <ESPmDNS.h>
#include <esp_camera.h>
#include <esp_http_server.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DFRobot_LTR308.h>
#include "camera_pins.h"

// ============================================================
// Nutzer-Konfiguration
// Alle Secrets kommen aus credentials.ini (nicht in git)
// ============================================================
#ifndef WIFI_SSID
  #error "WIFI_SSID fehlt — credentials.ini.example nach credentials.ini kopieren und befüllen"
#endif
#ifndef WIFI_PASS
  #error "WIFI_PASS fehlt — credentials.ini.example nach credentials.ini kopieren und befüllen"
#endif
#ifndef MQTT_BROKER
  #error "MQTT_BROKER fehlt — credentials.ini.example nach credentials.ini kopieren und befüllen"
#endif
#ifndef MQTT_USER
  #error "MQTT_USER fehlt — credentials.ini.example nach credentials.ini kopieren und befüllen"
#endif
#ifndef MQTT_PASS
  #error "MQTT_PASS fehlt — credentials.ini.example nach credentials.ini kopieren und befüllen"
#endif

// Statische IP des Kamera-Nodes (im gleichen Subnetz wie RPi/HA)
static const IPAddress STATIC_IP   (192, 168, 1, 201);
static const IPAddress GATEWAY     (192, 168, 1,   1);
static const IPAddress SUBNET      (255, 255, 255,  0);
static const IPAddress DNS_SERVER  (192, 168, 1,   1);
#define MQTT_PORT       1883
#define MQTT_CLIENT_ID  "formicarium-cam1"

// MQTT-Topics (fest gemäß Architektur in CLAUDE.md)
#define TOPIC_STATUS    "formicarium/cam1/status"
#define TOPIC_IR_LEVEL  "formicarium/cam1/ir_level"
#define TOPIC_IR_CMD    "formicarium/cam1/cmd/ir_led"

// Hostname für mDNS → erreichbar als formicarium-cam1.local
#define MDNS_HOSTNAME   "formicarium-cam1"

// Heartbeat-Intervall
#define HEARTBEAT_MS    30000UL

// MJPEG-Frame-Intervall (200 ms → ~5 fps)
// Ameisen bewegen sich langsam — 5 fps reichen; halbiert die Netzlast.
#define FRAME_INTERVAL_MS   200

// ============================================================
// IR-LED LEDC-Konfiguration
// ============================================================
#define LEDC_CHANNEL_IR     0
#define LEDC_FREQ_HZ     5000
#define LEDC_RESOLUTION     8   // 8 Bit → Wertebereich 0-255

// IR-Auto-Off: 60s nach letztem Einschalten → IR aus (Firmware-Watchdog,
// unabhängig von HA/MQTT als Fallback-Sicherheit).
#define IR_AUTO_OFF_MS  60000UL

// ============================================================
// Globale Zustände
// ============================================================
static uint8_t  g_ir_level    = 0;      // aktuelles IR-PWM-Level
static uint32_t g_ir_on_since = 0;      // millis() beim letzten IR-Einschalten (0 = aus)
static float    g_lux         = -1.0f;  // letzter Lux-Wert (-1 = nicht gelesen)
static bool     g_als_ok      = false;  // LTR-308 erfolgreich initialisiert
static uint32_t g_last_hb     = 0;      // Timestamp letzter Heartbeat
static uint32_t g_uptime_s    = 0;

WiFiClient      wifiClient;
PubSubClient    mqtt(wifiClient);
DFRobot_LTR308  als;

// ============================================================
// IR-LED Hilfsfunktion
// ============================================================

// Setzt PWM-Level der IR-LEDs und publiziert neuen State per MQTT.
// level: 0 = aus, 255 = volle Leistung
static void ir_set(uint8_t level) {
    if (level == g_ir_level) return;
    g_ir_level = level;
    ledcWrite(LEDC_CHANNEL_IR, level);

    // Timestamp für Auto-Off-Watchdog
    g_ir_on_since = (level > 0) ? millis() : 0;

    char buf[4];
    snprintf(buf, sizeof(buf), "%u", level);
    mqtt.publish(TOPIC_IR_LEVEL, buf, /*retain=*/true);

    Serial.printf("[IR] level=%u%s\n", level, level > 0 ? " (Auto-Off in 60s)" : "");
}

// ============================================================
// LTR-308 Ambient Light Sensor
// ============================================================
// Teilt I2C-Bus (GPIO 8/9) mit Camera-SCCB — Kamera MUSS zuerst
// initialisiert werden, sonst liefert der Sensor 0 (DFRobot-Hinweis).

static void als_init() {
    // Wire auf Camera-SCCB-Pins (gemeinsamer I2C-Bus)
    Wire.begin(CAM_PIN_SIOD, CAM_PIN_SIOC);
    if (als.begin()) {
        g_als_ok = true;
        Serial.println("[ALS] LTR-308 initialisiert (I2C 0x53)");
    } else {
        Serial.println("[ALS] LTR-308 nicht gefunden — Lichtsensor deaktiviert");
    }
}

// Lux lesen und per MQTT publizieren.
// Wird im Heartbeat-Takt aufgerufen (alle 30 s).
static void als_read_publish() {
    if (!g_als_ok) return;
    uint32_t raw = als.getData();
    g_lux = (float)als.getLux(raw);

    char buf[12];
    snprintf(buf, sizeof(buf), "%.1f", g_lux);
    mqtt.publish("formicarium/cam1/lux", buf, /*retain=*/true);
    Serial.printf("[ALS] Lux: %.1f\n", g_lux);
}

// ============================================================
// MJPEG-Stream Server — Port 81, eigener FreeRTOS-Task
// ============================================================
// Läuft komplett getrennt von Port-80-API.
// write_chunked() schreibt grosse JPEG-Frames in TCP-Segmenten
// (1436 Byte), weil client.write() bei >TCP-Sendepuffer-Grösse
// weniger Bytes schreibt als erwartet → Verbindungsabbruch.

static WiFiServer streamServer(81);

// Schreibt buf zuverlässig in 1436-Byte-Chunks. Gibt false zurück
// sobald die Verbindung wegbricht.
static bool write_chunked(WiFiClient &client, const uint8_t *buf, size_t len) {
    const size_t CHUNK = 1436;  // TCP MSS für 802.11n
    size_t sent = 0;
    while (sent < len) {
        size_t n = min(CHUNK, len - sent);
        int written = client.write(buf + sent, n);
        if (written <= 0) return false;
        sent += written;
    }
    return true;
}

static void stream_task(void *param) {
    streamServer.begin();
    Serial.println("[STREAM] Server gestartet auf Port 81");

    for (;;) {
        WiFiClient client = streamServer.accept();
        if (!client) {
            vTaskDelay(pdMS_TO_TICKS(50));
            continue;
        }

        Serial.println("[STREAM] Client verbunden");

        client.print(
            "HTTP/1.1 200 OK\r\n"
            "Content-Type: multipart/x-mixed-replace;boundary=frame\r\n"
            "Access-Control-Allow-Origin: *\r\n"
            "Cache-Control: no-store\r\n"
            "Connection: close\r\n\r\n"
        );

        char part_buf[64];
        while (client.connected()) {
            camera_fb_t *fb = esp_camera_fb_get();
            if (!fb) {
                vTaskDelay(pdMS_TO_TICKS(FRAME_INTERVAL_MS));
                continue;
            }

            size_t hlen = snprintf(part_buf, sizeof(part_buf),
                "--frame\r\n"
                "Content-Type: image/jpeg\r\n"
                "Content-Length: %u\r\n\r\n",
                (unsigned)fb->len);

            bool ok = write_chunked(client, (uint8_t *)part_buf, hlen);
            if (ok) ok = write_chunked(client, fb->buf, fb->len);
            if (ok) ok = client.print("\r\n");

            esp_camera_fb_return(fb);

            if (!ok) break;
            client.flush();  // TCP-Puffer nach jedem Frame leeren
            vTaskDelay(pdMS_TO_TICKS(FRAME_INTERVAL_MS));
        }

        client.stop();
        Serial.println("[STREAM] Client getrennt");
    }
}

// ============================================================
// HTTP-Handler: JPEG-Snapshot  GET /capture
// ============================================================
static esp_err_t capture_handler(httpd_req_t *req) {
    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) {
        httpd_resp_send_500(req);
        return ESP_FAIL;
    }

    httpd_resp_set_type(req, "image/jpeg");
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    httpd_resp_set_hdr(req, "Content-Disposition", "inline; filename=capture.jpg");
    esp_err_t res = httpd_resp_send(req, (const char *)fb->buf, (ssize_t)fb->len);

    esp_camera_fb_return(fb);
    return res;
}

// ============================================================
// HTTP-Handler: IR-Steuerung  GET /ir?level=0-255
// ============================================================
// Antwort: JSON  {"ok":true,"level":128}
static esp_err_t ir_handler(httpd_req_t *req) {
    char query[32] = {0};
    char level_str[8] = {0};

    if (httpd_req_get_url_query_str(req, query, sizeof(query)) == ESP_OK) {
        if (httpd_query_key_value(query, "level", level_str, sizeof(level_str)) == ESP_OK) {
            int val = atoi(level_str);
            val = constrain(val, 0, 255);
            ir_set((uint8_t)val);
        }
    }

    char resp[48];
    snprintf(resp, sizeof(resp), "{\"ok\":true,\"level\":%u}", g_ir_level);

    httpd_resp_set_type(req, "application/json");
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    return httpd_resp_send(req, resp, (ssize_t)strlen(resp));
}

// ============================================================
// HTTP-Handler: Status  GET /
// ============================================================
static esp_err_t status_handler(httpd_req_t *req) {
    char ip_str[16];
    STATIC_IP.toString().toCharArray(ip_str, sizeof(ip_str));

    char resp[128];
    snprintf(resp, sizeof(resp),
        "{\"node\":\"cam1\",\"ip\":\"%s\",\"ir_level\":%u,\"uptime_s\":%lu}",
        ip_str, g_ir_level, g_uptime_s);

    httpd_resp_set_type(req, "application/json");
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    return httpd_resp_send(req, resp, (ssize_t)strlen(resp));
}

// ============================================================
// HTTP-Server starten
// ============================================================
static void http_server_start() {
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.server_port     = 80;
    config.max_open_sockets = 5;   // 1 stream + 4 API-Calls gleichzeitig
    config.stack_size      = 8192; // erhöht für MJPEG-Puffer im Task-Stack

    httpd_handle_t server = nullptr;
    if (httpd_start(&server, &config) != ESP_OK) {
        Serial.println("[HTTP] Fehler beim Starten des Servers");
        return;
    }

    static const httpd_uri_t uri_capture = { .uri="/capture", .method=HTTP_GET, .handler=capture_handler, .user_ctx=nullptr };
    static const httpd_uri_t uri_ir      = { .uri="/ir",      .method=HTTP_GET, .handler=ir_handler,      .user_ctx=nullptr };
    static const httpd_uri_t uri_root    = { .uri="/",        .method=HTTP_GET, .handler=status_handler,  .user_ctx=nullptr };

    httpd_register_uri_handler(server, &uri_capture);
    httpd_register_uri_handler(server, &uri_ir);
    httpd_register_uri_handler(server, &uri_root);

    Serial.println("[HTTP] API-Server gestartet auf Port 80");
    Serial.printf("[HTTP]   http://%s.local/capture\n", MDNS_HOSTNAME);
    Serial.printf("[HTTP]   http://%s.local/ir?level=128\n", MDNS_HOSTNAME);
}

// ============================================================
// Kamera initialisieren
// ============================================================
static bool camera_init() {
    camera_config_t config;
    config.ledc_channel = LEDC_CHANNEL_1;    // Kanal 0 belegt durch IR-LED
    config.ledc_timer   = LEDC_TIMER_1;
    config.pin_d0       = CAM_PIN_D0;
    config.pin_d1       = CAM_PIN_D1;
    config.pin_d2       = CAM_PIN_D2;
    config.pin_d3       = CAM_PIN_D3;
    config.pin_d4       = CAM_PIN_D4;
    config.pin_d5       = CAM_PIN_D5;
    config.pin_d6       = CAM_PIN_D6;
    config.pin_d7       = CAM_PIN_D7;
    config.pin_xclk     = CAM_PIN_XCLK;
    config.pin_pclk     = CAM_PIN_PCLK;
    config.pin_vsync    = CAM_PIN_VSYNC;
    config.pin_href     = CAM_PIN_HREF;
    config.pin_sccb_sda = CAM_PIN_SIOD;
    config.pin_sccb_scl = CAM_PIN_SIOC;
    config.pin_pwdn     = CAM_PIN_PWDN;
    config.pin_reset    = CAM_PIN_RESET;
    config.xclk_freq_hz = 20000000;       // 20 MHz Master Clock
    config.pixel_format = PIXFORMAT_JPEG; // MJPEG-Ausgabe
    config.grab_mode    = CAMERA_GRAB_LATEST; // immer aktuellsten Frame

    // VGA für stabiles Streaming über WiFi — SVGA war zu bandbreitenintensiv.
    // PSRAM trotzdem nutzen für Doppelpuffer (smoother grab).
    if (psramFound()) {
        config.frame_size    = FRAMESIZE_VGA;  // 640×480 — ~12 KB/Frame statt 26 KB
        config.jpeg_quality  = 15;             // Etwas mehr Komprimierung als zuvor
        config.fb_count      = 2;              // Doppelpuffer — GRAB_LATEST verhindert Stau
        config.fb_location   = CAMERA_FB_IN_PSRAM;
        Serial.println("[CAM] PSRAM gefunden → VGA 640×480, 2× Framebuffer");
    } else {
        config.frame_size    = FRAMESIZE_VGA;
        config.jpeg_quality  = 20;
        config.fb_count      = 1;
        config.fb_location   = CAMERA_FB_IN_DRAM;
        Serial.println("[CAM] Kein PSRAM → VGA 640×480, 1× Framebuffer");
    }

    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
        Serial.printf("[CAM] Initialisierung fehlgeschlagen: 0x%x\n", err);
        return false;
    }

    // Sensorparameter für Formicarium-Bedingungen optimieren
    // (schwaches Restlicht + IR-Beleuchtung)
    sensor_t *s = esp_camera_sensor_get();
    if (s) {
        s->set_brightness(s, 1);       // leicht heller
        s->set_saturation(s, -1);      // entsättigter (IR-Licht ist ohnehin grau)
        s->set_gainceiling(s, GAINCEILING_4X); // Verstärkung für Schwachlicht
        s->set_whitebal(s, 1);         // Auto-Weißabgleich an
        s->set_awb_gain(s, 1);
        s->set_exposure_ctrl(s, 1);    // Auto-Belichtung an
        s->set_aec2(s, 1);             // AEC DSP-Algorithmus
    }

    Serial.println("[CAM] OV3660 initialisiert");
    return true;
}

// ============================================================
// MQTT-Callbacks und Verbindungsmanagement
// ============================================================

// Eingehende MQTT-Nachrichten verarbeiten
static void mqtt_callback(char *topic, byte *payload, unsigned int length) {
    if (strcmp(topic, TOPIC_IR_CMD) == 0) {
        char buf[8] = {0};
        size_t len = min((unsigned int)(sizeof(buf) - 1), length);
        memcpy(buf, payload, len);
        int val = atoi(buf);
        ir_set((uint8_t)constrain(val, 0, 255));
        Serial.printf("[MQTT] IR-Befehl empfangen: %u\n", g_ir_level);
    }
}

static void mqtt_connect() {
    if (mqtt.connected()) return;

    Serial.print("[MQTT] Verbinde mit Broker...");
    if (mqtt.connect(MQTT_CLIENT_ID,
                     MQTT_USER, MQTT_PASS,
                     TOPIC_STATUS, 0, true,  // Last-Will: Status-Topic, retain
                     "{\"online\":false}")) {
        Serial.println(" OK");
        mqtt.subscribe(TOPIC_IR_CMD);
        Serial.printf("[MQTT] Subscribed: %s\n", TOPIC_IR_CMD);

        // Aktuellen IR-Stand nach Reconnect publizieren
        char buf[4];
        snprintf(buf, sizeof(buf), "%u", g_ir_level);
        mqtt.publish(TOPIC_IR_LEVEL, buf, true);
    } else {
        Serial.printf(" FEHLER (rc=%d), nächster Versuch in 5 s\n", mqtt.state());
    }
}

// Heartbeat-Payload zusammenbauen und publizieren
static void mqtt_publish_heartbeat() {
    char ip_str[16];
    STATIC_IP.toString().toCharArray(ip_str, sizeof(ip_str));

    JsonDocument doc;
    doc["online"]    = true;
    doc["ip"]        = ip_str;
    doc["ir_level"]  = g_ir_level;
    doc["uptime_s"]  = g_uptime_s;
    if (g_lux >= 0) doc["lux"] = g_lux;

    char buf[128];
    serializeJson(doc, buf, sizeof(buf));
    mqtt.publish(TOPIC_STATUS, buf, /*retain=*/true);
    Serial.printf("[MQTT] Heartbeat: %s\n", buf);
}

// ============================================================
// WiFi + mDNS einrichten
// ============================================================
static void wifi_setup() {
    WiFi.mode(WIFI_STA);
    WiFi.config(STATIC_IP, GATEWAY, SUBNET, DNS_SERVER);
    WiFi.begin(WIFI_SSID, WIFI_PASS);

    Serial.printf("[WIFI] Verbinde mit '%s'", WIFI_SSID);
    uint8_t attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\n[WIFI] Verbunden! IP: %s\n", WiFi.localIP().toString().c_str());
    } else {
        Serial.println("\n[WIFI] FEHLER — prüfe SSID/Passwort und starte neu");
        ESP.restart();
    }

    if (MDNS.begin(MDNS_HOSTNAME)) {
        MDNS.addService("http", "tcp", 80);
        Serial.printf("[mDNS] Erreichbar als http://%s.local\n", MDNS_HOSTNAME);
    }
}

// ============================================================
// setup()
// ============================================================
void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n=== FORMICA-OS Kameranode ===");

    // --- IR-LED via LEDC-PWM ------------------------------------
    // Kanal 0, 5 kHz, 8 Bit (0-255)
    ledcSetup(LEDC_CHANNEL_IR, LEDC_FREQ_HZ, LEDC_RESOLUTION);
    ledcAttachPin(IR_LED_PIN, LEDC_CHANNEL_IR);
    ledcWrite(LEDC_CHANNEL_IR, 0);  // IR aus beim Start
    Serial.printf("[IR] LED auf GPIO %d initialisiert\n", IR_LED_PIN);

    // --- Status-LED ---------------------------------------------
    pinMode(STATUS_LED_PIN, OUTPUT);
    digitalWrite(STATUS_LED_PIN, LOW);

    // --- WiFi + mDNS --------------------------------------------
    wifi_setup();

    // --- Kamera -------------------------------------------------
    if (!camera_init()) {
        Serial.println("[FATAL] Kamera nicht initialisierbar — Neustart in 5 s");
        delay(5000);
        ESP.restart();
    }

    // --- MQTT ---------------------------------------------------
    mqtt.setServer(MQTT_BROKER, MQTT_PORT);
    mqtt.setCallback(mqtt_callback);
    mqtt.setBufferSize(256);
    mqtt_connect();

    // --- LTR-308 Ambient Light Sensor ---------------------------
    // Nach camera_init() initialisieren (teilt I2C-Bus)
    als_init();

    // --- HTTP-Server Port 80 (API) ------------------------------
    http_server_start();

    // --- MJPEG-Stream Port 81 (eigener Task) --------------------
    // 8 kB Stack reicht für MJPEG-Puffer; Core 0 = Netz/WiFi-Affinität
    xTaskCreatePinnedToCore(stream_task, "mjpeg_stream", 8192,
                            nullptr, 1, nullptr, 0);

    // Status-LED kurz blinken = bereit
    for (int i = 0; i < 3; i++) {
        digitalWrite(STATUS_LED_PIN, HIGH); delay(100);
        digitalWrite(STATUS_LED_PIN, LOW);  delay(100);
    }

    Serial.println("[FORMICA] Kameranode bereit");
    g_last_hb = millis();
}

// ============================================================
// loop()  — MQTT-Polling und Heartbeat
// ============================================================
void loop() {
    uint32_t now = millis();
    g_uptime_s = now / 1000;

    // MQTT reconnect wenn nötig (nicht-blockierend: 5 s Cooldown)
    static uint32_t last_reconnect = 0;
    if (!mqtt.connected()) {
        if (now - last_reconnect > 5000) {
            last_reconnect = now;
            mqtt_connect();
        }
    } else {
        mqtt.loop();
    }

    // Heartbeat alle HEARTBEAT_MS — inkl. Lux-Messung
    if (now - g_last_hb >= HEARTBEAT_MS) {
        g_last_hb = now;
        als_read_publish();
        mqtt_publish_heartbeat();
    }

    // IR Auto-Off Watchdog (Firmware-Fallback, unabhängig von HA/MQTT)
    if (g_ir_on_since > 0 && (now - g_ir_on_since) >= IR_AUTO_OFF_MS) {
        Serial.println("[IR] Auto-Off (60s Timer)");
        ir_set(0);
    }

    // WiFi-Watchdog: bei Verbindungsverlust neu verbinden
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[WIFI] Verbindung verloren — reconnect...");
        WiFi.reconnect();
        delay(1000);
    }

    delay(10); // loop() nicht zu aggressiv pollen
}
