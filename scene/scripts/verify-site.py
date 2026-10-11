"""Check deployable HTML/CSS paths and packaged download checksums."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import hashlib, json, re, sys
root = Path(__file__).resolve().parents[1] / 'dist'
base = sys.argv[1] if len(sys.argv) > 1 else '/'
checked = set()
def check(url, source):
    parts = urlsplit(url)
    if parts.scheme or parts.netloc or not parts.path:
        return
    path = unquote(parts.path)
    if path.startswith('/'):
        assert path.startswith(base), f'{source}: URL outside deployment base: {url}'
        target = root / path[len(base):]
    else:
        target = source.parent / path
    assert target.exists(), f'{source}: missing {url}'
    checked.add(str(target))
class Links(HTMLParser):
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in ('href', 'src') and value:
                check(value, self.source)
for name in ['index.html', 'studio.html']:
    source = root / name
    text = source.read_text()
    assert '%BASE_URL%' not in text and '60%' not in text
    parser = Links(); parser.source = source; parser.feed(text)
for source in (root / 'assets').glob('*.css'):
    for url in re.findall(r'url\([\'"]?([^\)\'\"]+)', source.read_text()):
        check(url, source)
# Assets fetched by the scene at runtime.
for path in ['models/manifest.json', 'models/layout.json', 'textures/oled-status.json', 'poses/user-01.json', 'poses/user-02.json']:
    check(base + path, root / 'studio.html')
manifest = json.loads((root / 'models/manifest.json').read_text())
for part in manifest['parts'].values():
    check(base + part['file'], root / 'studio.html')
for item in json.loads((root / 'downloads/manifest.json').read_text()):
    data = (root / 'downloads' / item['file']).read_bytes()
    assert len(data) == item['bytes']
    assert hashlib.sha256(data).hexdigest() == item['sha256']
print(f'PASS: {len(checked)} published paths under {base}, download sizes and SHA-256 hashes')
