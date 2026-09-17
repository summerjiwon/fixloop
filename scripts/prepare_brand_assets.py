from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
source = ROOT / "frontend" / "public" / "brand-space-record.png"
target = ROOT / "frontend" / "public" / "brand-mark.png"

# Crop the cube mark from the supplied wordmark while retaining a small white margin.
image = Image.open(source).convert("RGBA")
image.crop((360, 65, 665, 360)).save(target, optimize=True)
print(target)
