"""Rebuild WebP derivatives from immutable public source URLs; never writes to Supabase.

Requires Pillow with WebP support. Proxy/CA settings use the execution environment.
"""
import hashlib
import io
import json
from pathlib import Path
import re
import urllib.request
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
manifest_path = ROOT / 'assets/optimized/manifest.json'
manifest = json.loads(manifest_path.read_text())
runtime = {}
for entry in manifest['images']:
    source = entry['source']
    if not source.startswith('https://yffwjgwwkapdrpwyjwfp.supabase.co/storage/v1/object/public/'):
        raise ValueError('Only observed public media sources are allowed')
    with urllib.request.urlopen(source, timeout=45) as response:
        data = response.read()
    digest = hashlib.sha256(data).hexdigest()
    original = ImageOps.exif_transpose(Image.open(io.BytesIO(data)))
    original = original.convert('RGBA' if 'A' in original.getbands() else 'RGB')
    entry.update(originalBytes=len(data), sha256=digest, width=original.width, height=original.height)
    outputs = []
    for width in sorted({min(original.width, target) for target in (640, 1280, 1920)}):
        image = original.resize((width, round(original.height * width / original.width)), Image.Resampling.LANCZOS)
        name = f'{digest[:12]}-{width}.webp'
        target = ROOT / 'assets/optimized' / name
        image.save(target, 'WEBP', quality=88, method=6)
        outputs.append({'src': 'assets/optimized/' + name, 'width': width, 'bytes': target.stat().st_size})
    entry['variants'] = outputs
    runtime[source] = [{'src': v['src'], 'width': v['width']} for v in outputs]
    print(f'{len(data)} bytes -> {outputs[-1]["bytes"]} bytes ({original.width}x{original.height})')
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
script = ROOT / 'image-variants.js'
text = script.read_text()
text, count = re.subn(r'/\* VH_VARIANTS_START \*/.*?/\* VH_VARIANTS_END \*/',
                    lambda _: '/* VH_VARIANTS_START */' + json.dumps(runtime, ensure_ascii=False, separators=(',', ':')) + '/* VH_VARIANTS_END */', text, flags=re.S)
if count != 1:
    raise ValueError('Expected exactly one image manifest slot')
script.write_text(text)
