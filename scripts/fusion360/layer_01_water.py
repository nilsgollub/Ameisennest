"""
Fusion 360 Script — Layer 01: Wasserkanal

Öffnen via: Fusion 360 → Tools → Scripts and Add-Ins → Run

Erzeugt:
  - Komponente "Layer_01_Wasserkanal"
  - Sketch "L01_Kontur" mit:
      - Plattenumriss 200×200 mm
      - 4× Führungsstift-Loch ∅6 mm
      - Wasserkanal-Nut 4×4 mm (Längs, Nest-Unterkante)
      - Sensorkanal ∅4.5 mm (Durchgangsbohrung für DS18B20)
      - Arena-Port ∅8 mm (Schlauchpassung)
  - 3D-Körper (Extrusion 20 mm) zur Sichtprüfung

DXF-Export danach: Autodesk MCP → export_dxf(sketch="L01_Kontur")
  → cad/korknest_v1/exports/layer_01_water_channel.dxf
"""

import adsk.core
import adsk.fusion
import traceback


# ── Dimensionen (mm) ────────────────────────────────────────────────────
PLATE_W, PLATE_H, PLATE_T = 200.0, 200.0, 20.0
NEST_W,  NEST_H            = 120.0,  80.0
GUIDE_PIN, PIN_MARGIN      =   6.0,  10.0
PORT_DIA                   =   8.0
SENSOR_CH                  =   4.5
WATER_CH_W, WATER_CH_H     =   4.0,   4.0


def mm(v: float) -> float:
    """mm → cm (Fusion 360 interne Einheit)."""
    return v / 10.0


def run(context):  # noqa: ANN001
    ui = None
    try:
        app = adsk.core.Application.get()
        ui  = app.userInterface
        design: adsk.fusion.Design = app.activeProduct
        root = design.rootComponent

        # Neue Komponente
        occ  = root.occurrences.addNewComponent(adsk.core.Matrix3D.create())
        comp = occ.component
        comp.name = "Layer_01_Wasserkanal"

        # Sketch auf XY-Ebene
        sketch = comp.sketches.add(comp.xYConstructionPlane)
        sketch.name = "L01_Kontur"
        lines   = sketch.sketchCurves.sketchLines
        circles = sketch.sketchCurves.sketchCircles
        P = adsk.core.Point3D.create

        hw = mm(PLATE_W / 2)
        hh = mm(PLATE_H / 2)

        # ── Plattenumriss ──────────────────────────────────────────────
        lines.addTwoPointRectangle(P(-hw, -hh, 0), P(hw, hh, 0))

        # ── 4× Führungsstift-Loch ──────────────────────────────────────
        pr = mm(GUIDE_PIN / 2)
        pm = mm(PIN_MARGIN)
        for x, y in [(-hw + pm, -hh + pm), (hw - pm, -hh + pm),
                     (-hw + pm,  hh - pm), (hw - pm,  hh - pm)]:
            circles.addByCenterRadius(P(x, y, 0), pr)

        # ── Arena-Port (links, Schlauchpassung zur Arena) ──────────────
        circles.addByCenterRadius(P(mm(-70), 0, 0), mm(PORT_DIA / 2))

        # ── Sensorkanal (Durchgangsbohrung, rechte Nest-Seite) ─────────
        circles.addByCenterRadius(P(mm(40), mm(-20), 0), mm(SENSOR_CH / 2))

        # ── Wasserkanal-Nut (4×4 mm, Nest-Unterkante, Layer 1 only) ───
        #    Kanal-Mittellinie liegt auf y = -(NEST_H/2) mm
        wc_y = mm(-(NEST_H / 2))
        wc_half = mm(WATER_CH_W / 2)
        lines.addTwoPointRectangle(
            P(mm(-NEST_W / 2), wc_y - wc_half, 0),
            P(mm( NEST_W / 2), wc_y + wc_half, 0),
        )

        # ── Extrusion (Sichtprüfung, nicht für DXF relevant) ──────────
        prof = _largest_profile(sketch)
        if prof:
            ext_in = comp.features.extrudeFeatures.createInput(
                prof, adsk.fusion.FeatureOperations.NewBodyFeatureOperation
            )
            ext_in.setDistanceExtent(
                False, adsk.core.ValueInput.createByString(f"{PLATE_T} mm")
            )
            comp.features.extrudeFeatures.add(ext_in)

        ui.messageBox(
            "✅ Layer_01_Wasserkanal erstellt.\n\n"
            "Nächster Schritt:\n"
            "  MCP → export_dxf(sketch='L01_Kontur')\n"
            "  → cad/korknest_v1/exports/layer_01_water_channel.dxf"
        )

    except Exception:
        if ui:
            ui.messageBox(f"Fehler:\n{traceback.format_exc()}")


def _largest_profile(sketch: adsk.fusion.Sketch) -> adsk.fusion.Profile | None:
    """Größtes Profil im Sketch (Plattenumriss)."""
    best, best_area = None, 0.0
    for i in range(sketch.profiles.count):
        p = sketch.profiles.item(i)
        area = p.areaProperties().area
        if area > best_area:
            best, best_area = p, area
    return best
