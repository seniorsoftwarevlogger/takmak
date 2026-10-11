"""Generate a static English page, failing on any missing Russian translation."""
from pathlib import Path
from html.parser import HTMLParser
from html import escape
import json, re, sys
root = Path(__file__).resolve().parents[1]
translations = json.loads((root / 'locales/en.json').read_text())
def translate(text):
    core = text.strip()
    if not re.search('[А-Яа-яЁё]', core):
        return text
    if core not in translations:
        raise ValueError(f'Missing English translation: {core}')
    return text.replace(core, translations[core], 1)
class English(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.output = []
    def handle_decl(self, text): self.output.append(f'<!{text}>')
    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == 'html': values['lang'] = 'en'
        if 'data-language' in values:
            values.pop('aria-current', None)
            if values['data-language'] == 'en': values['aria-current'] = 'page'
        if tag == 'iframe': values['src'] += '&lang=en'
        if values.get('href', '').endswith('downloads/takmak-assembly.md'):
            values['href'] = values['href'].replace('takmak-assembly.md', 'takmak-assembly.en.md')
        encoded = ''.join(f' {key}' if value is None else f' {key}="{escape(translate(value), quote=True)}"' for key, value in values.items())
        self.output.append(f'<{tag}{encoded}>')
    def handle_endtag(self, tag): self.output.append(f'</{tag}>')
    def handle_data(self, text): self.output.append(escape(translate(text), quote=False))
    def handle_entityref(self, name): self.output.append(f'&{name};')
    def handle_charref(self, name): self.output.append(f'&#{name};')
    def handle_comment(self, text): self.output.append(f'<!--{text}-->')
parser = English(); parser.feed((root / 'index.html').read_text())
result = ''.join(parser.output).replace('0,91″', '0.91″')
output = root / 'en.html'
if '--check' in sys.argv:
    assert output.exists() and output.read_text() == result, 'Run npm --prefix scene run translate'
else:
    output.write_text(result)
print(f'English page: {len(translations)} translated strings')
