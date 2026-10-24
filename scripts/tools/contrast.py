#!/usr/bin/env python3
"""Vérifie les contrastes WCAG des couleurs de secteurs (texte >= 4,5:1) : python3 scripts/tools/contrast.py"""
import sys, re, json

def lum(h):
    h = h.lstrip('#'); r, g, b = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)

def ratio(a, b):
    la, lb = lum(a), lum(b)
    if la < lb: la, lb = lb, la
    return (la + 0.05) / (lb + 0.05)

def mix(fg, bg, p):
    f = fg.lstrip('#'); b = bg.lstrip('#')
    return '#' + ''.join('%02X' % round(int(f[i:i+2], 16) * p + int(b[i:i+2], 16) * (1 - p)) for i in (0, 2, 4))

SECTORS = {
  'politique':     ('#C2185B', '#EC6297'),
  'international': ('#1565C0', '#4A96EB'),
  'europe':        ('#3949AB', '#8C9EFF'),
  'economie':      ('#965A00', '#D47F00'),
  'climat':        ('#2C7730', '#3EA843'),
  'science':       ('#8E24AA', '#C96FE1'),
  'ia':            ('#455A64', '#7D98A5'),
  'espace':        ('#00737D', '#00A1B1'),
  'aero':          ('#BD360F', '#F0673F'),
  'metier':        ('#6C6C00', '#979700'),
}
LIGHT = ('#FFFFFF', '#F5F6FA'); DARK = ('#171A2E', '#1E2238')
if len(sys.argv) > 1: SECTORS = json.loads(sys.argv[1])
bad = 0
for k, (l, d) in SECTORS.items():
    rl = [ratio(l, s) for s in LIGHT] + [ratio(l, mix(l, '#FFFFFF', 0.12))]
    rd = [ratio(d, s) for s in DARK] + [ratio(d, mix(d, '#171A2E', 0.12))]
    ok = min(rl) >= 4.5 and min(rd) >= 4.5
    bad += not ok
    print(f"{k:14} clair {l} {min(rl):4.1f}  sombre {d} {min(rd):4.1f}  {'OK' if ok else '<< À CORRIGER'}")
sys.exit(1 if bad else 0)
