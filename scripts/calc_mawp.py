#!/usr/bin/env python3
# ASME Section VIII Shell MAWP Calculation
# MAWP = SEt / (R + 0.6t)

# Given values
t = 0.8006  # Current actual thickness (inches) - from 2025 UT readings
S = 20000   # Allowable stress (psi) for SA-612 at 125F
E = 1.0     # Joint efficiency (full RT)
D = 130.26  # Inside diameter (inches)
R = D / 2   # Inside radius = 65.13 inches

# Shell MAWP calculation
MAWP_shell = (S * E * t) / (R + 0.6 * t)

print("=" * 60)
print("SHELL MAWP CALCULATION (ASME Section VIII)")
print("=" * 60)
print(f"Current Thickness (t): {t:.4f} in")
print(f"Allowable Stress (S): {S:,} psi")
print(f"Joint Efficiency (E): {E}")
print(f"Inside Diameter (D): {D} in")
print(f"Inside Radius (R): {R:.2f} in")
print()
print("Formula: MAWP = SEt / (R + 0.6t)")
print(f"MAWP = ({S} x {E} x {t:.4f}) / ({R:.2f} + 0.6 x {t:.4f})")
print(f"MAWP = {S * E * t:.2f} / {R + 0.6 * t:.4f}")
print()
print(f">>> CALCULATED SHELL MAWP = {MAWP_shell:.1f} psi <<<")
print()

# Compare to design pressure
design_pressure = 280
print(f"Design Pressure: {design_pressure} psi")
if MAWP_shell >= design_pressure:
    print(f"SAFE: MAWP ({MAWP_shell:.1f} psi) >= Design Pressure ({design_pressure} psi)")
else:
    print(f"UNSAFE: MAWP ({MAWP_shell:.1f} psi) < Design Pressure ({design_pressure} psi)")
    print(f"  Vessel must be de-rated to {MAWP_shell:.0f} psi or repaired")

# Calculate minimum thickness required for 280 psi
t_min = (design_pressure * R) / (S * E - 0.6 * design_pressure)
print()
print(f"Minimum thickness required for {design_pressure} psi: {t_min:.4f} in")
print(f"Current thickness: {t:.4f} in")
print(f"Thickness deficit: {t_min - t:.4f} in")

# Also calculate for heads
print()
print("=" * 60)
print("HEAD MAWP CALCULATION (2:1 Ellipsoidal)")
print("=" * 60)
t_head = 0.5070  # Current head thickness from 2025 UT
# For 2:1 ellipsoidal head: MAWP = 2SEt / (D + 0.2t)
MAWP_head = (2 * S * E * t_head) / (D + 0.2 * t_head)
print(f"Current Head Thickness: {t_head:.4f} in")
print(f"Formula: MAWP = 2SEt / (D + 0.2t)")
print(f">>> HEAD MAWP = {MAWP_head:.1f} psi <<<")

# Governing MAWP
governing_mawp = min(MAWP_shell, MAWP_head)
print()
print("=" * 60)
print(f">>> GOVERNING MAWP = {governing_mawp:.1f} psi <<<")
print("=" * 60)
