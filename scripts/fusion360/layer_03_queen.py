"""
Fusion 360 Script — Layer 03: Queen-/Brutkammer

Öffnen via: Fusion 360 → Tools → Scripts and Add-Ins → Run

Erzeugt:
  - Komponente "Layer_03_Queenkammer"
  - Sketch "L03_Kontur" mit:
      - Plattenumriss 200×200 mm
      - 4× Führungsstift-Loch ∅6 mm (identische Positionen zu Layer 01+02)
      - Queen-Hauptkammer (Pill-Form, 10 mm Pocket-Tiefe)
      - Brut-Nebenkammer (Pill-Form, 10 mm Pocket-Tiefe)
      - Queen-Tunnel ∅6 mm (Verbindung zur Arena)
      - Erweiterungs-Port ∅8 mm (für zukünftige Nest-Module)

ANPASSUNGSHINWEISE:
  Kammer-Layout ist ein Template — vor DXF-Export in F360 prüfen.
  Pocket-Tiefe = 10 mm (vs. 6 mm in Layer 02 — CNC muss tiefer fräsen).

DXF-Export: MCP → export_dxf(sketch="L03_Kontur")
  → cad/korknest_v1/exports/layer_03_queen_chamber.dxf
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
TUNNEL_QUEEN                =   6.0
CHAMBER_DEPTH               =  10.0   # Queen/Brut: 10 mm Pocket-Tiefe

# Queen-Kammer Layout (größer als Worker-Kammern)
QUEEN_CHAMBER  = {"cx":  0.0, "cy": 10.0, "w": 45.0, "h": 20.0}  # Hauptkammer
BROOD_CHAMBER  = {"cx":  0.0, "cy":-18.0, "w": 30.0, "h": 15.0}  # Brutkammer


def mm(v: float) -> float:
    """mm → cm."""
    return v / 10.0


def add_pill(sketch: adsk.fusion.Sketch, cx: float, cy: float, w: float, h: float) -> None:
    """Pill-Form (horizontal): cx, cy Mitte in mm, w Gesamtbreite, h Höhe."""
    lines = sketch.sketchCurves.sketchLines
    arcs  = sketch.sketchCurves.sketchArcs
    P = adsk.core.Point3D.create

    r = mm(h / 2)
    hs = mm(w / 2 - h / 2)
    cxc, cyc = mm(cx), mm(cy)

    lines.addByTwoPoints(P(cxc - hs, cyc + r, 0), P(cxc + hs, cyc + r, 0))
    lines.addByTwoPoints(P(cxc - hs, cyc - r, 0), P(cxc + hs, cyc - r, 0))
    arcs.addByCenterStartSweep(P(cxc - hs, cyc, 0),
                                P(cxc - hs, cyc + r, 0), math.pi)
    arcs.addByCenterStartSweep(P(cxc + hs, cyc, 0),
                                P(cxc + hs, cyc - r, 0), math.pi)


def run(context):  # noqa: ANN001
    ui = None
    try:
        app = adsk.core.Application.get()
        ui  = app.userInterface
        design: adsk.fusion.Design = app.activeProduct
        root = design.rootComponent

        occ  = root.occurrences.addNewComponent(adsk.core.Matrix3D.create())
        comp = occ.component
        comp.name = "Layer_03_Queenkammer"

        sketch = comp.sketches.add(comp.xYConstructionPlane)
        sketch.name = "L03_Kontur"
        lines   = sketch.sketchCurves.sketchLines
        circles = sketch.sketchCurves.sketchCircles
        P = adsk.core.Point3D.create

        hw = mm(PLATE_W / 2)
        hh = mm(PLATE_H / 2)

        # ── Plattenumriss ──────────────────────────────────────────────
        lines.addTwoPointRectangle(P(-hw, -hh, 0), P(hw, hh, 0))

        # ── 4× Führungsstift-Loch (identisch alle Layer) ──────────────
        pr = mm(GUIDE_PIN / 2)
        pm = mm(PIN_MARGIN)
        for x, y in [(-hw + pm, -hh + pm), (hw - pm, -hh + pm),
                     (-hw + pm,  hh - pm), (hw - pm,  hh - pm)]:
            circles.addByCenterRadius(P(x, y, 0), pr)

        # ── Erweiterungs-Port (rechts, für zukünftige Tandem-Module) ───
        circles.addByCenterRadius(P(mm(70), 0, 0), mm(PORT_DIA / 2))

        # ── Queen-Hauptkammer ──────────────────────────────────────────
        add_pill(sketch, **QUEEN_CHAMBER)

        # ── Brut-Nebenkammer ──────────────────────────────────────────
        add_pill(sketch, **BROOD_CHAMBER)

        # ── Queen-Tunnel (Verbindung Hauptkammer → Brutkammer) ─────────
        # Vertikaler Kanal ∅6mm zwischen beiden Kammern
        qr = mm(TUNNEL_QUEEN / 2)
        qy_top = mm(QUEEN_CHAMBER["cy"] - QUEEN_CHAMBER["h"] / 2)
        qy_bot = mm(BROOD_CHAMBER["cy"] + BROOD_CHAMBER["h"] / 2)
        # Als Rechteck (Fräskanal)
        lines.addTwoPointRectangle(
            P(-qr, qy_bot, 0),
            P( qr, qy_top, 0),
        )

        ui.messageBox(
            "✅ Layer_03_Queenkammer erstellt.\n\n"
            f"⚠ Pocket-Tiefe: {CHAMBER_DEPTH} mm (CNC tiefer als Layer 02).\n"
            "Kammer-Layout vor DXF-Export visuell prüfen.\n\n"
            "Nächster Schritt:\n"
            "  MCP → export_dxf(sketch='L03_Kontur')\n"
            "  → cad/korknest_v1/exports/layer_03_queen_chamber.dxf"
        )

    except Exception:
        if ui:
            ui.messageBox(f"Fehler:\n{traceback.format_exc()}")
