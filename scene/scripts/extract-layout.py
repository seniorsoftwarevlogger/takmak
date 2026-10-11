"""Read actual switch apertures from STEP B-rep loops, without modifying CAD."""
from pathlib import Path
import re, math, json
root=Path(__file__).resolve().parents[2]
result={'source':'Square switch aperture loops in supplied Regular Top STEP files (z=0). Thumb choices match owner photo.','sides':{}}
for side in ['Left','Right']:
 p=root/'3d models/step'/f'Takmak - {side} Regular Top.step'
 entries=dict(re.findall(r'#(\d+)=(.*?);',p.read_text(),re.S))
 refs=lambda t:re.findall(r'#(\d+)',t)
 points={k:[float(v)*1000 for v in re.findall(r'\(([^()]*)\)',t)[-1].split(',')] for k,t in entries.items() if t.startswith('CARTESIAN_POINT')}
 keys=[]
 for k,t in entries.items():
  if not t.startswith('EDGE_LOOP'):continue
  edges=[]
  for oe in refs(t):
   curve=entries[refs(entries[oe])[0]]
   edges.append([points[refs(entries[vp])[0]] for vp in refs(curve)[:2]])
  if len(edges)!=4:continue
  ps=[p for e in edges for p in e]
  if any(abs(p[2])>.001 for p in ps):continue
  lengths=[math.dist(*e) for e in edges]
  if not all(13.9<l<14.1 for l in lengths):continue
  center=[sum(p[i] for p in ps)/len(ps) for i in range(3)]
  a,b=edges[0];angle=math.degrees(math.atan2(b[1]-a[1],b[0]-a[0]));angle=(angle+45)%90-45
  x,y,z=center
  if side=='Right' and x<35 and y<0:continue # central alternative replaced by encoder + separate thumb key
  if side=='Left' and x>-35:continue # encoder and stabilised thumb geometry added below
  keys.append({'x':round(x,4),'y':round(y,4),'angle':round(angle,3),'width':1,'height':1,'step_loop':k})
 # Preserve the 1.25u bottom key and the right 2u shift observed in the photo.
 for key in keys:
  if (side=='Left' and -90<key['x']<-70 and key['y']<-25) or (side=='Right' and 65<key['x']<80 and key['y']<-25):key['width']=1.25
  if side=='Right' and key['x']>140 and -20<key['y']<-8:key['width']=2
 thumb={'x':-29.232,'y':-29.582,'angle':-30,'width':1,'height':2,'role':'thumb'} if side=='Left' else {'x':30.522,'y':-39.537,'angle':30,'width':1,'height':1,'role':'thumb'}
 keys.append(thumb)
 keys.sort(key=lambda v:(-v['y'],v['x']))
 encoder={'x':-25.573,'y':3.116} if side=='Left' else {'x':18.505,'y':-18.710}
 result['sides'][side.lower()]={'keys':keys,'encoder':encoder,'display':{'x':-25.573,'y':32.616,'width':11.5,'height':35} if side=='Left' else None}
 print(side,len(keys),'keys',[(k['x'],k['y'],k['angle']) for k in keys if k['y']<-20])
(root/'scene/public/models/layout.json').write_text(json.dumps(result,indent=2)+'\n')
