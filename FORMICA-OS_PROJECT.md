# FORMICA-OS — Smart Formicarium Project
### *Camponotus ligniperda · Marly, CH · Gründung 27.05.2026*

---

## 1. Projektübersicht

**FORMICA-OS** ist ein iteratives Entwicklungsprojekt mit zwei parallelen Strängen:

| Strang | Beschreibung |
|--------|-------------|
| **BIO** | Dokumentation und Analyse der Kolonieentwicklung einer *Camponotus ligniperda*-Königin (Wildfang, Marly CH, 27.05.2026) |
| **HARDWARE** | Konstruktion und Automatisierung eines modularen Smart Formicarium mit ESP32-Sensorik, Raspberry Pi als Gateway und Home Assistant Integration |

Ziel ist ein vollständig dokumentiertes, reproduzierbares System — von der Reagenzglas-Gründung bis zum fertig automatisierten, klimageregelten Korknest.

---

## 2. Biologie — Koloniedaten

```
Spezies:        Camponotus ligniperda (Zimmermann-Ameise)
Herkunft:       Marly, Kanton Freiburg, Schweiz
Funddatum:      27. Mai 2026
Typ:            Einzelkönigin, claustral (keine Arbeiterinnen bei Gründung)
Diapause:       erforderlich (Oktober–November, ~8–12 °C)
Setup Phase 1:  Reagenzglas, dunkle Ecke, Büro ~23 °C
```

### Entwicklungs-Zeitplan (Baseline ~23 °C)

| Meilenstein | Kolonie-Tag | Erwartetes Datum | Toleranz |
|---|---|---|---|
| Königin gefunden | T+0 | 27.05.2026 | — |
| Erste Eier | T+7 | ~03.06.2026 | ±5 d |
| L1-Larven | T+35 | ~01.07.2026 | ±7 d |
| L3-Larven | T+56 | ~22.07.2026 | ±10 d |
| Erste Puppen | T+84 | ~19.08.2026 | ±14 d |
| Erste Nanitics (Pygmäen) | T+112 | ~16.09.2026 | ±14 d |
| Minor Workers | T+150 | ~24.10.2026 | ±21 d |
| **Diapause** | ~T+155–160 | Oktober/November 2026 | situativ |
| Post-Diapause Aktivierung | ~T+310 | März/April 2027 | ±30 d |

> ⚠ *Camponotus ligniperda* ist bekannt für unbeeindruckend langsame Gründungsphasen. Alle Zeitangaben sind bei 23 °C Ambient — jedes Grad weniger kostet proportional Zeit.

---

## 3. Hardware-Architektur

### 3.1 Phasenplan

```
Phase 1 │ JETZT          │ Reagenzglas, kein Sensor, manuell
Phase 2 │ Erste Nanitics │ Starter-Box + ESP32 Temp/RH Monitoring → HA
Phase 3 │ Post-Diapause  │ Korknest v1 + vollständige Automatisierung
Phase 4 │ Expansion      │ Modulares Nest-Erweiterungssystem
```

### 3.2 System-Stack

```
┌─────────────────────────────────────────────────────────┐
│                    HOME ASSISTANT OS                    │
│              (Raspberry Pi 4 / lokales Netz)            │
│  Dashboards · Automations · Logbook-Sync · Alerts       │
└────────────────────┬────────────────────────────────────┘
                     │ MQTT (broker: HA built-in Mosquitto)
          ┌──────────┴──────────┐
          │      ESP32 Node      │
          │  (im Formicarium)   │
          │                     │
          │  SHT40  → Temp/RH   │
          │  DS18B20 → Nestkern │
          │  TSL2591 → Lux      │
          │  Servo  → Feeding   │
          │  LED PWM → Rotlicht │
          └─────────────────────┘
```

### 3.3 Sensor-Mapping

| Sensor | Modell | Messgrösse | Einbauort |
|--------|--------|-----------|-----------|
| Temperatur + Feuchte | SHT40 | °C / %RH | Aussenkammer (Arena) |
| Nestkernsensor | DS18B20 | °C | Korknest-Innenkanal |
| Helligkeitssensor | TSL2591 | Lux | Nestdeckel |
| CO₂ (optional Phase 4) | SCD40 | ppm | Arena |

### 3.4 Aktorik

| Aktor | Typ | Funktion |
|-------|-----|----------|
| Rotlicht-LED | WS2812B / 660 nm | Beobachtungslicht ohne Stress |
| Automatische Fütterung | Servo + Reservoir | Honigwasser-Dispenser |
| Feuchtigkeitsregulierung | Kapillar-System passiv | Kork-Wasserkanal |
| Lüftungssteuerung | Mini-Fan (optional) | CO₂-Management Phase 4 |

---

## 4. Korknest — Designziele & Anforderungen

### 4.1 Materialwahl: Kork

Kork wurde gegenüber Ytong (Gips) und 3D-Druck als Primärmaterial gewählt:

| Kriterium | Kork | Ytong | PETG/Resin |
|-----------|------|-------|------------|
| Feuchtigkeitspuffer | ✅ Exzellent (natürliche Kapillarität) | ✅ Gut | ❌ Null |
| Wärmedämmung | ✅ Sehr gut | ✅ Gut | ❌ Schwach |
| Bearbeitbarkeit (CNC/Laser) | ✅ Einfach | ✅ Einfach | ⚠ Komplex |
| Optik / Natürlichkeit | ✅ Ideal | ⚠ Neutral | ❌ Artifiziell |
| Geruch / Chemie | ✅ Neutral | ✅ Neutral | ⚠ Ausgasungen |
| Modularität | ✅ Schichtbar | ⚠ Monolithisch | ✅ Parametrisch |

### 4.2 Konstruktionsprinzip — Geschichteter Korkblock

```
┌─────────────────────────┐  ← Deckelplatte (Acryl / Kork, abnehmbar)
│  ░░░ Beobachtungszone ░░│
│  ┌──────────────────┐   │
│  │  Kammer 3 (oben) │   │  ← Brut-Warmzone
│  │  ┌────────────┐  │   │
│  │  │ Kammer 2   │  │   │  ← Hauptkammer, Queen
│  │  │ ┌────────┐ │  │   │
│  │  │ │Kammer 1│ │  │   │  ← Feuchtzone / Wasserkanal
│  │  │ └────────┘ │  │   │
│  │  └────────────┘  │   │
│  └──────────────────┘   │
│        Arena            │
└─────────────────────────┘
```

### 4.3 Designanforderungen v1.0 (Iteration I)

- **Modulare Schichten:** 3–4 gefräste Korkplatten (ca. 20 mm dick), CNC-gefräst oder Lasercut, stapelbar und erweiterbar
- **Feuchtigkeitsgradient:** Wasserkanal im untersten Layer, Kapillarwirkung des Korks erzeugt natürlichen Gradienten (trocken oben, feucht unten)
- **Sensor-Kanäle:** Integrierte Führungskanäle ∅4 mm für DS18B20-Probe und Kabelführung zum ESP32
- **Tunnelgeometrie:** *C. ligniperda*-gerecht — Tunnel-∅ ca. 3–4 mm, Kammerhöhe ca. 5–8 mm
- **Beobachtungsfenster:** Rote Acrylglasplatte (>630 nm) als Deckel, abnehmbar ohne Nest-Öffnung
- **Verbindung zur Arena:** Standardisierter Schlauch-Port ∅8 mm mit Verschlussstopfen
- **Erweiterungsport:** Zweiter Port für zukünftige Nest-Module (Tandem-Erweiterung)

### 4.4 Fertigungsweg (geplant)

```
Design:      Fusion 360 → parametrisches Modell, alle Layer einzeln
Export:      DXF pro Layer → CNC-Router (oder Laser-Cutter)
Material:    Korkplatten 200×200×20 mm (Naturkork, unbehandelt)
Finish:      Keine Oberflächenbehandlung, kein Kleber (mechanische Verbindung via Führungsstifte)
```

---

## 5. Home Assistant Integration

### 5.1 Geplante Entities

```yaml
# Beispiel-Entity-Struktur (wird in Phase 2 konkretisiert)
sensor.formicarium_temp_arena         # °C, SHT40
sensor.formicarium_humidity_arena     # %RH, SHT40
sensor.formicarium_temp_nest_core     # °C, DS18B20
sensor.formicarium_lux                # Lux, TSL2591
light.formicarium_observation_light   # WS2812B Rotlicht
switch.formicarium_feeder             # Servo-Trigger
```

### 5.2 Automationen (geplant)

- **Temperatur-Alert:** Benachrichtigung wenn Nestkern < 18 °C oder > 28 °C
- **Diapause-Assistent:** Automatische Rampe Oktober (Temperatur-Logging + Erinnerung)
- **Tageslichtsimulation:** Rotlicht-Dimmer nach Sonnenuntergang (Lokaldaten Marly, CH)
- **Feeder-Schedule:** Honigwasser-Dispenser 2×/Woche ab Phase "Minor Workers"

---

## 6. Softwarekomponenten

| Komponente | Sprache | Repo-Pfad | Status |
|---|---|---|---|
| ESP32 Firmware | C++ (Arduino) | `firmware/esp32_formicarium/` | 🔲 Geplant |
| HA YAML Config | YAML | `homeassistant/` | 🔲 Geplant |
| Kolonie-Logbuch | React (Artifact) | `logbook/` | ✅ Aktiv |
| Fustion 360 Design | F3D | `cad/korknest_v1/` | 🔲 Geplant |
| Daten-Logger | Python | `scripts/datalogger.py` | 🔲 Geplant |

---

## 7. Projektlog & Entscheidungen

| Datum | Entscheidung | Begründung |
|-------|-------------|-----------|
| 27.05.2026 | Büro statt Garage für Reagenzglas-Phase | Temperaturvorteil ~5–8 °C → ~30% schnellere Entwicklung |
| 27.05.2026 | Kork als Nest-Primärmaterial | Feuchtigkeitspuffer, Bearbeitbarkeit, Ästhetik |
| 27.05.2026 | MQTT + Home Assistant als Integrationsstack | Nils' bestehende HA-Infrastruktur, lokales Netz, keine Cloud |

---

## 8. Ressourcen & Referenzen

- **Myrmecos Wiki** — *Camponotus ligniperda* Haltungsberichte
- **Fusion 360** — Parametrisches CAD für Nest-Iterationen
- **ESPHome / custom firmware** — Evaluation läuft (ESPHome vs. custom MQTT)
- **Home Assistant MQTT Integration** — [docs.ha-integration-mqtt](https://www.home-assistant.io/integrations/mqtt/)

---

*Dokument gepflegt von: Nils & FORMICA-OS AI Architect*  
*Letzte Aktualisierung: 27.05.2026 — T+0*
