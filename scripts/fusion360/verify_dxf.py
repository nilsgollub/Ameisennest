"""
DXF-Verifikation nach Fusion 360 Export.

Prüft ob die exportierten DXF-Layer den Soll-Massen aus parameters.py entsprechen.

Verwendung:
    python scripts/fusion360/verify_dxf.py cad/korknest_v1/exports/layer_01_water_channel.dxf
    python scripts/fusion360/verify_dxf.py cad/korknest_v1/exports/  # alle Layer

Abhängigkeit: pip install ezdxf
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path
from typing import NamedTuple

try:
    import ezdxf
    from ezdxf.math import Vec2
except ImportError:
    print("Fehler: ezdxf nicht installiert. → pip install ezdxf")
    sys.exit(1)

# Parameter-Import (relativ zum Repo-Root)
sys.path.insert(0, str(Path(__file__).parent))
from parameters import PARAMS, guide_pin_positions


TOLERANCE_MM = 0.1  # Zulässige Massabweichung in mm


class CheckResult(NamedTuple):
    passed: bool
    message: str


def _circles_in_dxf(doc: ezdxf.document.Drawing) -> list[tuple[float, float, float]]:
    """Alle Kreise im Modelspace: Liste von (cx, cy, radius) in mm."""
    msp = doc.modelspace()
    result = []
    for entity in msp:
        if entity.dxftype() == "CIRCLE":
            cx = entity.dxf.center.x
            cy = entity.dxf.center.y
            r  = entity.dxf.radius
            result.append((cx, cy, r))
    return result


def _bounding_box(doc: ezdxf.document.Drawing) -> tuple[float, float, float, float]:
    """Bounding-Box aller Entities im Modelspace (x_min, y_min, x_max, y_max)."""
    msp = doc.modelspace()
    xs, ys = [], []
    for entity in msp:
        try:
            bbox = ezdxf.bbox.extents([entity])
            xs.extend([bbox.extmin.x, bbox.extmax.x])
            ys.extend([bbox.extmin.y, bbox.extmax.y])
        except Exception:  # noqa: BLE001
            pass
    if not xs:
        return (0, 0, 0, 0)
    return (min(xs), min(ys), max(xs), max(ys))


def check_plate_outline(doc: ezdxf.document.Drawing) -> CheckResult:
    """Plattenumriss muss 200×200 mm sein."""
    x0, y0, x1, y1 = _bounding_box(doc)
    w = x1 - x0
    h = y1 - y0
    ok = (
        abs(w - PARAMS["plate_w"]) <= TOLERANCE_MM
        and abs(h - PARAMS["plate_h"]) <= TOLERANCE_MM
    )
    return CheckResult(ok, f"Plattenumriss: {w:.2f}×{h:.2f} mm (Soll: 200×200 mm)")


def check_guide_pins(doc: ezdxf.document.Drawing) -> CheckResult:
    """Vier Führungsstift-Löcher ∅6 mm an Eckpositionen."""
    circles = _circles_in_dxf(doc)
    pin_r = PARAMS["guide_pin"] / 2
    expected_r = pin_r

    # Alle Kreise mit korrektem Durchmesser
    pin_circles = [
        (cx, cy) for cx, cy, r in circles
        if abs(r - expected_r) <= TOLERANCE_MM
    ]

    if len(pin_circles) != 4:
        return CheckResult(
            False,
            f"Führungsstifte: {len(pin_circles)} Kreise mit ∅{PARAMS['guide_pin']}mm "
            f"gefunden (Soll: 4)"
        )

    # Bounding-Box des DXF nutzen um Ursprung zu ermitteln
    x0, y0, x1, y1 = _bounding_box(doc)
    cx_plate = (x0 + x1) / 2
    cy_plate = (y0 + y1) / 2

    # Erwartete Positionen relativ zur Plattenmitte
    expected = guide_pin_positions()
    matched = 0
    for ex, ey in expected:
        # Absolute Position im DXF
        abs_x = cx_plate + ex
        abs_y = cy_plate + ey
        for px, py in pin_circles:
            if abs(px - abs_x) <= TOLERANCE_MM and abs(py - abs_y) <= TOLERANCE_MM:
                matched += 1
                break

    ok = matched == 4
    return CheckResult(ok, f"Führungsstift-Positionen: {matched}/4 korrekt platziert")


def check_port(doc: ezdxf.document.Drawing) -> CheckResult:
    """Arena-Port ∅8 mm vorhanden."""
    circles = _circles_in_dxf(doc)
    port_r = PARAMS["port_dia"] / 2
    found = sum(1 for _, _, r in circles if abs(r - port_r) <= TOLERANCE_MM)
    ok = found >= 1
    return CheckResult(ok, f"Arena-Port ∅{PARAMS['port_dia']}mm: {found} gefunden (Soll: ≥1)")


def check_min_wall(doc: ezdxf.document.Drawing) -> CheckResult:
    """Alle Kreis-Mittelpunkte ≥5 mm vom Plattenrand entfernt (CNC-Sicherheit)."""
    circles = _circles_in_dxf(doc)
    x0, y0, x1, y1 = _bounding_box(doc)
    MIN_DIST = 5.0
    violations = []
    for cx, cy, r in circles:
        dist = min(cx - x0, x1 - cx, cy - y0, y1 - cy)
        if dist < MIN_DIST - TOLERANCE_MM:
            violations.append((cx, cy, dist))
    ok = len(violations) == 0
    msg = "Mindestabstand Rand: OK" if ok else (
        f"Verletzungen ({len(violations)}×): " +
        ", ".join(f"({v[0]:.1f},{v[1]:.1f})→{v[2]:.1f}mm" for v in violations)
    )
    return CheckResult(ok, msg)


def verify_file(path: Path) -> bool:
    """Verifiziert eine DXF-Datei. Gibt True zurück wenn alle Checks bestanden."""
    print(f"\n── {path.name} ──")
    try:
        doc = ezdxf.readfile(str(path))
    except Exception as e:  # noqa: BLE001
        print(f"  ❌ DXF lesen fehlgeschlagen: {e}")
        return False

    checks = [
        check_plate_outline(doc),
        check_guide_pins(doc),
        check_port(doc),
        check_min_wall(doc),
    ]

    all_passed = True
    for result in checks:
        icon = "✅" if result.passed else "❌"
        print(f"  {icon}  {result.message}")
        if not result.passed:
            all_passed = False

    return all_passed


def main() -> None:
    parser = argparse.ArgumentParser(description="DXF-Verifikation Korknest v1")
    parser.add_argument("path", help="DXF-Datei oder Verzeichnis mit DXF-Dateien")
    args = parser.parse_args()

    target = Path(args.path)
    if target.is_dir():
        files = sorted(target.glob("*.dxf"))
        if not files:
            print(f"Keine DXF-Dateien in {target}")
            sys.exit(1)
    else:
        files = [target]

    results = [verify_file(f) for f in files]
    print(f"\n{'─' * 40}")
    passed = sum(results)
    print(f"Ergebnis: {passed}/{len(results)} Layer bestanden")
    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
