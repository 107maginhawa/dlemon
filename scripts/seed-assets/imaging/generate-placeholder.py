"""Generate a tiny synthetic lateral-cephalogram placeholder JPEG for demo seeding.
Pixel content is irrelevant to ceph math (which runs on landmark x/y); this exists
only so the imaging viewer has something to load. Output kept <100KB. MIT-safe (synthetic)."""
from PIL import Image, ImageDraw, ImageFont

W, H = 800, 1000
img = Image.new("L", (W, H), 16)
d = ImageDraw.Draw(img)
# soft radial-ish vignette so it reads like a radiograph, not a flat block
for y in range(H):
    shade = 10 + int(28 * (1 - abs(y - H/2) / (H/2)))
    d.line([(0, y), (W, y)], fill=shade)
# faint profile curve (skull silhouette hint)
prof = [(250,120),(330,150),(390,230),(410,330),(395,430),(430,520),(470,560),
        (430,610),(360,650),(330,720),(345,800),(300,860)]
d.line(prof, fill=120, width=3)
# label
try:
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 30)
    small = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 18)
except Exception:
    font = ImageFont.load_default(); small = ImageFont.load_default()
d.text((40, 40), "DEMO LATERAL CEPH", fill=210, font=font)
d.text((40, 80), "synthetic placeholder — not a real radiograph", fill=150, font=small)
d.text((40, H-50), "dentalemon seed asset", fill=120, font=small)
out = "scripts/seed-assets/imaging/ceph-lateral-demo.jpg"
img.save(out, "JPEG", quality=72, optimize=True)
print("wrote", out)
