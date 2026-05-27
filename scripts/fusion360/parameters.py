"""
Master-Parameter für Korknest v1.0 — Single Source of Truth.

In Sync halten mit:
- Fusion 360 User Parameters (manuell oder via MCP)
- CLAUDE.md → Korknest Design-Parameter Tabelle
"""

# fmt: off
PARAMS: dict[str, float] = {
    # Platten-Geometrie
    "plate_w":        200.0,   # mm  Gesamtbreite Korkplatte
    "plate_h":        200.0,   # mm  Gesamthöhe Korkplatte
    "plate_t":         20.0,   # mm  Plattendicke pro Layer

    # Nest-Bereich (zentriert auf Plattenursprung)
    "nest_w":         120.0,   # mm  Breite Nest-Bereich
    "nest_h":          80.0,   # mm  Höhe Nest-Bereich

    # Tunnel-Durchmesser
    "tunnel_worker":    3.5,   # mm  Worker-Tunnel ∅
    "tunnel_queen":     6.0,   # mm  Queen-Passage ∅

    # Kammer-Tiefe (Pocket-Tiefe im Layer)
    "chamber_worker_h": 6.0,   # mm  Worker-Kammern
    "chamber_queen_h": 10.0,   # mm  Queen/Brut-Kammern

    # Kanäle und Ports
    "water_ch_w":       4.0,   # mm  Wasserkanal Breite (Layer 1)
    "water_ch_h":       4.0,   # mm  Wasserkanal Tiefe (Layer 1)
    "sensor_ch":        4.5,   # mm  Sensorkanal ∅ für DS18B20 (Layer 1→2)
    "port_dia":         8.0,   # mm  Arena-/Erweiterungs-Port ∅

    # Mechanik
    "guide_pin":        6.0,   # mm  Führungsstift-Loch ∅
    "pin_margin":      10.0,   # mm  Führungsstift-Abstand von Plattenecke
}
# fmt: on


def guide_pin_positions(p: dict[str, float] | None = None) -> list[tuple[float, float]]:
    """Führungsstift-Positionen (mm, Ursprung = Plattenmitte).

    Konsistent auf ALLEN Layern — nicht ändern ohne alle Layer neu zu exportieren.
    """
    if p is None:
        p = PARAMS
    m = p["pin_margin"]
    hw = p["plate_w"] / 2
    hh = p["plate_h"] / 2
    return [
        (-hw + m, -hh + m),  # unten-links
        ( hw - m, -hh + m),  # unten-rechts
        (-hw + m,  hh - m),  # oben-links
        ( hw - m,  hh - m),  # oben-rechts
    ]


def nest_bounds(p: dict[str, float] | None = None) -> tuple[float, float, float, float]:
    """Nest-Bereich: (x_min, y_min, x_max, y_max) in mm."""
    if p is None:
        p = PARAMS
    hw = p["nest_w"] / 2
    hh = p["nest_h"] / 2
    return (-hw, -hh, hw, hh)
