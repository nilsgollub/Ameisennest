"""
Fusion 360 Script — Layer 02: Feuchtigkeitszone (Worker-Kammern)

Öffnen via: Fusion 360 → Tools → Scripts and Add-Ins → Run

Erzeugt:
  - Komponente "Layer_02_Feuchtigkeitszone"
  - Sketch "L02_Kontur" mit:
      - Plattenumriss 200×200 mm
      - 4× Führungsstift-Loch ∅6 mm (identische Positionen zu Layer 01)
      - 2 Worker-Kammern (Pill-Form, 6 mm Pocket-Tiefe)
      - Worker-Tunnel ∅3.5 mm (Kammer-Verbindungen)
      - Sensorkanal ∅4.5 mm (Fortsetzung von Layer 01)
      - Arena-Port ∅8 mm (Flucht von Layer 01)

ANPASSUNGSHINWEISE:
  Kammer-Layout ist ein Template — Position und Anzahl der Kammern
  bitte in Fusion 360 interaktiv anpassen.
  Tunnel-Verbindungen werden nach Kammer-Finalisierung via MCP ergänzt.

DXF-Export: MCP → export_dxf(sketch="L02_Kontur")
  → cad/korknest_v1/exports/layer_02_humidity_zone.dxf
"""

import adsk.core
import adsk.fusion
import traceback
import math


# ── Dimensionen (mm) ────────────────────────────────────────────────────
PLATE_W, PLATE_H, PLATE_T  = 200.0, 200.0, 20.0
NEST_W,  NEST_H             = 120.0,  80.0
GUIDE_PIN, PIN_MARGIN       =   6.0,  10.0
PORT_DIA                    =   8.0
SENSOR_CH                   =   4.5
TUNNEL_WORKER               =   3.5
CHAMBER_DEPTH               =   6.0   # Pocket-Tiefe dieser Schicht

# Worker-Kammer Template-Layout (zentriert im Nest-Bereich, anpassbar)
# Pill-Form: Rechteck + Halbkreis an beiden Enden
CHAMBERS = [
    {"cx": -22.0, "cy": 8.0,  "w": 28.0, "h": 14.0},  # Kammer A (links)
    {"cx":  22.0, "cy": 8.0,  "w": 28.0, "h": 14.0},  # Kammer B (rechts)
]


def mm(v: float) -> float:
    """mm → cm."""
    return v / 10.0


def add_pill(sketch: adsk.fusion.Sketch, cx: float, cy: float, w: float, h: float) -> None:
    """Zeichnet eine Pill-Form (Kammer) als Linien + Halbkreise.

    cx, cy: Mittelpunkt in mm
    w: Gesamtbreite (inkl. Halbkreise), h: Höhe
    Ausrichtung: horizontal (Längsachse = X)
    """
    lines   = sketch.sketchCurves.sketchLines
    arcs    = sketch.sketchCurves.sketchArcs
    P = adsk.core.Point3D.create

    r = mm(h / 2)
    half_straight = mm(w / 2 - h / 2)  # halbe Länge des geraden Mittelteils
    cx_cm = mm(cx)
    cy_cm = mm(cy)

    # Gerade Linien oben/unten
    lines.addByTwoPoints(P(cx_cm - half_straight, cy_cm + r, 0),
                         P(cx_cm + half_straight, cy_cm + r, 0))
    lines.addByTwoPoints(P(cx_cm - half_straight, cy_cm - r, 0),
                         P(cx_cm + half_straight, cy_cm - r, 0))

    # Halbkreise links/rechts
    # Fusion 360 Bogen: Mittelpunkt, Start, Winkel
    center_l = P(cx_cm - half_straight, cy_cm, 0)
    arcs.addByCenterStartSweep(
        center_l,
        P(cx_cm - half_straight, cy_cm + r, 0),
        math.pi,  # 180° im Uhrzeigersinn
    )
    center_r = P(cx_cm + half_straight, cy_cm, 0)
    arcs.addByCenterStartSweep(
        center_r,
        P(cx_cm + half_straight, cy_cm - r, 0),
        math.pi,
    )


def run(context):  # noqa: ANN001
    ui = None
    try:
        app = adsk.core.Application.get()
        ui  = app.userInterface
        design: adsk.fusion.Design = app.activeProduct
        root = design.rootComponent

        occ  = root.occurrences.addNewComponent(adsk.core.Matrix3D.create())
        comp = occ.component
        comp.name = "Layer_02_Feuchtigkeitszone"

        sketch = comp.sketches.add(comp.xYConstructionPlane)
        sketch.name = "L02_Kontur"
        lines   = sketch.sketchCurves.sketchLines
        circles = sketch.sketchCurves.sketchCircles
        P = adsk.core.Point3D.create

        hw = mm(PLATE_W / 2)
        hh = mm(PLATE_H / 2)

        # ── Plattenumriss ──────────────────────────────────────────────
        lines.addTwoPointRectangle(P(-hw, -hh, 0), P(hw, hh, 0))

        # ── 4× Führungsstift-Loch (identisch Layer 01) ────────────────
        pr = mm(GUIDE_PIN / 2)
        pm = mm(PIN_MARGIN)
        for x, y in [(-hw + pm, -hh + pm), (hw - pm, -hh + pm),
                     (-hw + pm,  hh - pm), (hw - pm,  hh - pm)]:
            circles.addByCenterRadius(P(x, y, 0), pr)

        # ── Arena-Port + Sensorkanal (Flucht von Layer 01) ────────────
        circles.addByCenterRadius(P(mm(-70), 0, 0), mm(PORT_DIA / 2))
        circles.addByCenterRadius(P(mm(40), mm(-20), 0), mm(SENSOR_CH / 2))

        # ── Worker-Kammern (Template, bitte anpassen) ─────────────────
        for ch in CHAMBERS:
            add_pill(sketch, ch["cx"], ch["cy"], ch["w"], ch["h"])

        # ── Worker-Tunnel zwischen Kammer A und B ─────────────────────
        # Einfache Kreisdarstellung für CNC-Fräsweg
        # Verbindungslinie zwischen Kammer-Mitten, Breite = tunnel_worker
        # → wird als schmaler Kanal gefräst; hier als Rechteck dargestellt
        tr = mm(TUNNEL_WORKER / 2)
        y_tunnel = mm(CHAMBERS[0]["cy"])  # gleiche Y-Höhe wie Kammern
        x0 = mm(CHAMBERS[0]["cx"] + CHAMBERS[0]["w"] / 2 - CHAMBERS[0]["h"] / 2)
        x1 = mm(CHAMBERS[1]["cx"] - CHAMBERS[1]["w"] / 2 + CHAMBERS[1]["h"] / 2)
        lines.addTwoPointRectangle(P(x0, y_tunnel - tr, 0), P(x1, y_tunnel + tr, 0))

        # ── Extrusion als Pocket (Kammern + Tunnel in Plattenmaterial) ─
        # Pocket-Tiefe = CHAMBER_DEPTH (6mm in 20mm Platte)
        # Hinweis: Profil-Selektion bei mehreren Profilen ist komplex.
        # Kammern bitte nach Sketch-Finalisierung via MCP oder manuell extrudieren.
        ui.messageBox(
            "✅ Layer_02_Feuchtigkeitszone erstellt.\n\n"
            "⚠ Kammer-Layout anpassen wenn nötig (interaktiv in F360).\n\n"
            "Pocket-Tiefe für Kammern + Tunnel: 6 mm\n\n"
            "Nächster Schritt:\n"
            "  MCP → export_dxf(sketch='L02_Kontur')\n"
            "  → cad/korknest_v1/exports/layer_02_humidity_zone.dxf"
        )

    except Exception:
        if ui:
            ui.messageBox(f"Fehler:\n{traceback.format_exc()}")
