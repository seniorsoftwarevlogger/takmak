"""Convert the supplied planar DXF splines via de Boor evaluation. No CAD edits."""
from pathlib import Path
from collections import Counter
import json, hashlib, math
root = Path(__file__).resolve().parents[2]
source = root / 'assets/decoration/takmak-silkscreen.dxf'
lines = source.read_text().splitlines()
pairs = [(int(k), v.strip()) for k, v in zip(lines[::2], lines[1::2])]
start = next(i for i, p in enumerate(pairs) if p == (2, 'ENTITIES')) + 1
entities = []
for code, value in pairs[start:]:
    if code == 0:
        if value == 'ENDSEC': break
        entities.append((value, []))
    else: entities[-1][1].append((code, value))

def vals(data, code): return [float(v) for k,v in data if k == code]
def spline(data):
    degree = int(vals(data, 71)[0]); knots = vals(data, 40)
    points = list(zip(vals(data, 10), vals(data, 20)))
    weights = vals(data, 41) or [1.] * len(points)
    assert len(weights) == len(points) and len(knots) == len(points)+degree+1
    assert all(abs(z)<1e-8 for z in vals(data,30))
    def at(t):
        k = len(points)-1 if t >= knots[len(points)] else next(i for i in range(degree,len(points)) if knots[i] <= t < knots[i+1])
        d = [[points[j][0]*weights[j], points[j][1]*weights[j], weights[j]] for j in range(k-degree,k+1)]
        for r in range(1,degree+1):
            for j in range(degree,r-1,-1):
                i = j+k-degree; den = knots[i+degree-r+1]-knots[i]
                a = (t-knots[i])/den if den else 0
                d[j] = [(1-a)*d[j-1][c]+a*d[j][c] for c in range(3)]
        return (d[degree][0]/d[degree][2],d[degree][1]/d[degree][2])
    # Sample each nonzero knot span, preserving short curves as well as long ones.
    samples=[]
    for a,b in zip(knots[degree:len(points)],knots[degree+1:len(points)+1]):
        if b>a: samples.extend(at(a+(b-a)*i/24) for i in range(24))
    samples.append(at(knots[len(points)])); return samples
paths=[]
for kind,data in entities:
    if kind=='SPLINE': pts=spline(data)
    elif kind=='LINE': pts=[(vals(data,10)[0],vals(data,20)[0]),(vals(data,11)[0],vals(data,21)[0])]
    else: raise ValueError('Unsupported DXF entity: '+kind)
    assert all(math.isfinite(v) for pt in pts for v in pt)
    paths.append((kind,pts))
allpoints=[p for _,pts in paths for p in pts]
x0=min(x for x,y in allpoints); x1=max(x for x,y in allpoints)
y0=min(y for x,y in allpoints); y1=max(y for x,y in allpoints)
out=root/'scene/public/decoration'; out.mkdir(parents=True,exist_ok=True)
for name,selected in [('takmak-full',paths),('takmak-contours',[p for p in paths if p[0]=='SPLINE'])]:
    body='\n'.join('<path d="'+' '.join(('M' if i==0 else 'L')+f'{x:.4f},{-y:.4f}' for i,(x,y) in enumerate(pts))+'"/>' for _,pts in selected)
    (out/(name+'.svg')).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0-1} {-y1-1} {x1-x0+2} {y1-y0+2}" fill="none" stroke="#777" stroke-width="0.22" stroke-linecap="round" stroke-linejoin="round">\n<title>Takmak — topography from the supplied silkscreen DXF</title>\n{body}\n</svg>\n')
metadata={'source':'assets/decoration/takmak-silkscreen.dxf','sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'entities':dict(Counter(k for k,_ in entities)),'bounds':[x0,y0,x1,y1],'conversion':'Planar spline evaluation with 24 samples per nonzero knot span; Y inverted for SVG. Full SVG retains LINE entities; contours SVG omits straight segments for website decoration.'}
(out/'source.json').write_text(json.dumps(metadata,indent=2)+'\n');print(json.dumps(metadata,indent=2))
