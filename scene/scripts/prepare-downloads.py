"""Package only explicitly selected Takmak assets for the local website."""
from pathlib import Path
import hashlib, json, math, struct, zipfile

root = Path(__file__).resolve().parents[2]
public = root / 'scene/public'
out = public / 'downloads'
out.mkdir(exist_ok=True)
manifest = json.loads((public / 'models/manifest.json').read_text())
notice = '''Takmak — файлы проекта

Автор проекта: seniorsoftwarevlogger
https://github.com/seniorsoftwarevlogger/ssv_split
Исходный README запрещает коммерческое использование:
“You may not use this for any commercial purpose.”
Не предполагается единая лицензия на сторонние библиотеки или прошивку.
'''

def stl(part):
    raw = (public / part['file']).read_bytes()
    n = struct.unpack_from('<I', raw, 12)[0]
    gltf = json.loads(raw[20:20+n])
    start = 20+n+8
    def accessor(index):
        a = gltf['accessors'][index]
        v = gltf['bufferViews'][a['bufferView']]
        fmt = {5126:'f', 5125:'I', 5123:'H', 5121:'B'}[a['componentType']]
        count = {'VEC3':3, 'SCALAR':1}[a['type']]
        size = struct.calcsize('<'+fmt*count)
        stride = v.get('byteStride', size)
        offset = start + v.get('byteOffset', 0) + a.get('byteOffset', 0)
        return [struct.unpack_from('<'+fmt*count, raw, offset+i*stride) for i in range(a['count'])]
    primitive = gltf['meshes'][0]['primitives'][0]
    vertices = [tuple(x*1000 for x in p) for p in accessor(primitive['attributes']['POSITION'])]
    indices = [p[0] for p in accessor(primitive['indices'])] if 'indices' in primitive else list(range(len(vertices)))
    result = bytearray(b'Takmak / STEP tessellation / millimetres'.ljust(80,b'\0'))
    result += struct.pack('<I', len(indices)//3)
    for i in range(0,len(indices),3):
        a,b,c = (vertices[j] for j in indices[i:i+3])
        u,v = [b[j]-a[j] for j in range(3)], [c[j]-a[j] for j in range(3)]
        normal = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
        length = math.sqrt(sum(x*x for x in normal)) or 1
        result += struct.pack('<12fH', *(x/length for x in normal), *a, *b, *c, 0)
    assert len(result) == 84 + len(indices)//3*50
    return result

files = []
def record(name, label):
    p = out/name
    files.append({'file':name, 'label':label, 'bytes':p.stat().st_size, 'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})

for profile in ['low','regular']:
    ids = [f'takmak-{side}-{piece}' for side in ['left','right'] for piece in [f'{profile}-top','universal-bottom','reset-button']]
    ids += [f'encoder-knob-16mm-3mm-{kind}' for kind in (['low-profile-screen','low-profile-button'] if profile=='low' else ['regular'])]
    name = f'takmak-{profile}-case.zip'
    sources = []
    with zipfile.ZipFile(out/name,'w',zipfile.ZIP_DEFLATED) as archive:
        for id in ids:
            part = manifest['parts'][id]
            source = Path(part['source'])
            digest = hashlib.sha256(source.read_bytes()).hexdigest()
            assert digest == part['sourceSha256']
            archive.write(source,'STEP/'+source.name)
            archive.writestr('STL/'+id+'.stl',stl(part))
            sources.append({'part':id,'source':source.name,'sha256':digest})
        archive.writestr('sources.json',json.dumps(sources,ensure_ascii=False,indent=2))
        archive.writestr('NOTICE.txt',notice)
        archive.writestr('README.txt',f'''Takmak / {profile}

Корпус обеих половинок: верх, универсальное дно, reset-кнопки и крутилки.
STEP — оригинальные экспорты автора. STL — та же триангуляция, что в 3D-сцене, в миллиметрах.
Каждую деталь размещайте на столе слайсера отдельно: сохранены исходные координаты CAD.
Настройки печати и механическая совместимость с PCB 3.1 пока не подтверждены.
Кейкапы, свитчи, плата и электроника в архив не входят.
{'Regular knob: напечатать один или два экземпляра по комплектации.' if profile=='regular' else 'Low Profile Screen — слева, Low Profile Button — справа при установке энкодера.'}
''')
    record(name, profile)

with zipfile.ZipFile(out/'takmak-pcb-3.1-source.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for name in ['takmak.kicad_pcb','takmak.kicad_sch','takmak.kicad_pro','takmak-cache.lib']:
        archive.write(root/'kicad'/name,name)
    archive.writestr('NOTICE.txt',notice)
    archive.writestr('README.txt','''Takmak PCB 3.1 — исходники, не производственный комплект.
Последняя изготовленная плата — 3.0. Точный архив 3.0 ещё не идентифицирован.
3.1 добавляет увеличенные посадки под Choc hotswap; эта ревизия ещё не изготовлена.
В архиве PCB, схема, проект KiCad и имеющаяся библиотека символов.
Внешние библиотеки footprints и 3D-модели не включены. Gerber-файлов здесь нет.
DRC содержит известные замечания совмещённых посадок и пересечения с вырезами.
Владелец принимает конструкцию посадки SW40 под цилиндрическую hotswap-втулку;
это не является подтверждением изготовления 3.1.
Перед заказом нужны проверка конкретной комплектации и производственных файлов.
''')
record('takmak-pcb-3.1-source.zip','PCB 3.1')
(out/'manifest.json').write_text(json.dumps(files,ensure_ascii=False,indent=2)+'\n')
print('\n'.join(f"{f['file']}: {f['bytes']:,} bytes" for f in files))
