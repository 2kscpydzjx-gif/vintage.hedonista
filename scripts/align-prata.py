"""Build the Hero-only Prata variant: same advances/kerning, level cap contours.

Requires fonttools[woff]. Original font and OFL are included in the repository.
No letter spacing, wrapping, point sizes or horizontal coordinates are changed.
"""
from pathlib import Path
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
font = TTFont(ROOT / 'scripts/font-sources/Prata-Regular.ttf', recalcTimestamp=False)
cap = font['OS/2'].sCapHeight
changed = []
for char in dict.fromkeys('VINTAGE HEDONISTA МИСТЕЦТВО БУТИ СОБОЮ'):
    if char.isspace():
        continue
    name = font.getBestCmap()[ord(char)]
    glyph = font['glyf'][name]
    bottom = glyph.yMin if -30 <= glyph.yMin < 0 else 0
    top = glyph.yMax
    if bottom == 0 and top == cap:
        continue
    # Preserve intentional descenders (Ц); only optical overshoot is levelled.
    if glyph.isComposite():
        coordinates, endpoints, flags = glyph.getCoordinates(font['glyf'])
        del glyph.components
        glyph.numberOfContours = len(endpoints)
        glyph.coordinates, glyph.endPtsOfContours, glyph.flags = coordinates, endpoints, flags
    for index, (x, y) in enumerate(glyph.coordinates):
        glyph.coordinates[index] = (x, round((y - bottom) * cap / (top - bottom)))
    glyph.recalcBounds(font['glyf'])
    changed.append(char)

# Original TrueType instructions assume the original contour coordinates.
for glyph in font['glyf'].glyphs.values():
    glyph.removeHinting()
for tag in ('cvt ', 'fpgm', 'prep'):
    if tag in font:
        del font[tag]
for name_id, value in {
    1: 'VH Prata Aligned', 2: 'Regular', 3: 'VH Prata Aligned Regular 1.0',
    4: 'VH Prata Aligned Regular', 6: 'VHPrataAligned-Regular',
    16: 'VH Prata Aligned', 17: 'Regular',
}.items():
    font['name'].removeNames(nameID=name_id)
    font['name'].setName(value, name_id, 3, 1, 0x409)
font.flavor = 'woff2'
font.save(ROOT / 'assets/fonts/prata/hero-aligned.woff2')
print('Aligned capital contours:', ''.join(changed))
