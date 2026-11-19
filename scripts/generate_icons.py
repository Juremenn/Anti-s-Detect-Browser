#!/usr/bin/env python3
"""
Generate bespoke, pixel-crisp geometric icons for:
- extensions/anti-detect-browser/icons/ (icon16.png, icon32.png, icon48.png, icon128.png, icon.svg)
- frontend/public/assets/logo.png & web_ui/assets/logo.png
- app.ico (multi-resolution Windows application icon)
"""

import math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
EXT_ICONS = ROOT / "extensions" / "anti-detect-browser" / "icons"
FRONTEND_LOGO = ROOT / "frontend" / "public" / "assets" / "logo.png"
WEBUI_LOGO = ROOT / "web_ui" / "assets" / "logo.png"
APP_ICO = ROOT / "app.ico"

EXT_ICONS.mkdir(parents=True, exist_ok=True)
FRONTEND_LOGO.parent.mkdir(parents=True, exist_ok=True)
WEBUI_LOGO.parent.mkdir(parents=True, exist_ok=True)

# Master Vector SVG
SVG_CONTENT = '''<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0F172A"/>
      <stop offset="60%" stop-color="#1E1B4B"/>
      <stop offset="100%" stop-color="#312E81"/>
    </linearGradient>
    <linearGradient id="facetLeft" x1="128" y1="120" x2="256" y2="390" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#818CF8"/>
      <stop offset="100%" stop-color="#4F46E5"/>
    </linearGradient>
    <linearGradient id="facetRight" x1="384" y1="120" x2="256" y2="390" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#6366F1"/>
      <stop offset="100%" stop-color="#3730A3"/>
    </linearGradient>
    <linearGradient id="visorGrad" x1="180" y1="210" x2="332" y2="280" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#EEF2FF"/>
      <stop offset="100%" stop-color="#C7D2FE"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Squircle Base -->
  <rect x="24" y="24" width="464" height="464" rx="104" fill="url(#bgGrad)"/>
  <rect x="24" y="24" width="464" height="464" rx="104" stroke="#4F46E5" stroke-width="4" stroke-opacity="0.8"/>

  <!-- Precision Shield Facet Left -->
  <path d="M 256 96 L 140 148 L 140 264 C 140 336 188 396 256 424 L 256 96 Z" fill="url(#facetLeft)"/>

  <!-- Precision Shield Facet Right -->
  <path d="M 256 96 L 372 148 L 372 264 C 372 336 324 396 256 424 L 256 96 Z" fill="url(#facetRight)"/>

  <!-- Angular Stealth Visor Cutout -->
  <path d="M 190 220 L 256 184 L 322 220 L 286 276 L 256 260 L 226 276 Z" fill="url(#visorGrad)"/>

  <!-- Center Active Shield Dot (Emerald) -->
  <circle cx="256" cy="226" r="14" fill="#10B981" filter="url(#glow)"/>
</svg>
'''

(EXT_ICONS / "icon.svg").write_text(SVG_CONTENT, encoding="utf-8")
print("[+] Wrote master icon.svg")

def render_icon(size: int) -> Image.Image:
    """Render the high-craft geometric icon at a target pixel size using Pillow supersampling."""
    render_scale = 4 if size <= 64 else 2
    canvas_size = size * render_scale
    img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pad = int(canvas_size * 0.05)
    w = canvas_size - pad * 2
    h = canvas_size - pad * 2
    radius = int(canvas_size * 0.22)

    # 1. Base squircle
    draw.rounded_rectangle([pad, pad, pad + w, pad + h], radius=radius, fill=(15, 23, 42, 255))
    draw.rounded_rectangle([pad, pad, pad + w, pad + h], radius=radius, outline=(79, 70, 229, 220), width=max(1, int(canvas_size * 0.012)))

    # 2. Shield coordinates
    cx = canvas_size // 2
    top_y = int(canvas_size * 0.20)
    wing_y = int(canvas_size * 0.30)
    wing_w = int(canvas_size * 0.24)
    mid_y = int(canvas_size * 0.52)
    bot_y = int(canvas_size * 0.82)

    left_shield = [
        (cx, top_y),
        (cx - wing_w, wing_y),
        (cx - wing_w, mid_y),
        (cx, bot_y)
    ]
    right_shield = [
        (cx, top_y),
        (cx + wing_w, wing_y),
        (cx + wing_w, mid_y),
        (cx, bot_y)
    ]

    draw.polygon(left_shield, fill=(99, 102, 241, 255))
    draw.polygon(right_shield, fill=(67, 56, 202, 255))

    # 3. Visor Cutout
    visor_top = (cx, int(canvas_size * 0.38))
    visor_left = (cx - int(canvas_size * 0.14), int(canvas_size * 0.44))
    visor_right = (cx + int(canvas_size * 0.14), int(canvas_size * 0.44))
    visor_bot_l = (cx - int(canvas_size * 0.07), int(canvas_size * 0.54))
    visor_mid = (cx, int(canvas_size * 0.50))
    visor_bot_r = (cx + int(canvas_size * 0.07), int(canvas_size * 0.54))

    visor_poly = [visor_top, visor_right, visor_bot_r, visor_mid, visor_bot_l, visor_left]
    draw.polygon(visor_poly, fill=(238, 242, 255, 255))

    # 4. Center Emerald Dot
    dot_r = max(2, int(canvas_size * 0.035))
    dot_cy = int(canvas_size * 0.44)
    draw.ellipse([cx - dot_r, dot_cy - dot_r, cx + dot_r, dot_cy + dot_r], fill=(16, 185, 129, 255))

    # Downsample with Lanczos for anti-aliasing
    final_img = img.resize((size, size), Image.Resampling.LANCZOS)
    return final_img

# Generate Extension PNG Icons
sizes = [16, 32, 48, 128, 256]
images = {}
for s in sizes:
    im = render_icon(s)
    images[s] = im
    out_p = EXT_ICONS / f"icon{s}.png"
    im.save(out_p, "PNG")
    print(f"[+] Generated {out_p.name} ({s}x{s})")

# Update frontend and web_ui logos
logo_img = render_icon(256)
logo_img.save(FRONTEND_LOGO, "PNG")
logo_img.save(WEBUI_LOGO, "PNG")
print(f"[+] Updated frontend and web_ui logo.png")

# Generate Multi-Resolution Windows .ico
ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
ico_images = [render_icon(sz[0]) for sz in ico_sizes]
ico_images[0].save(
    APP_ICO,
    format="ICO",
    sizes=ico_sizes,
    append_images=ico_images[1:]
)
print(f"[+] Generated multi-resolution Windows {APP_ICO.name}")
