import sys, itertools, math
sys.path.insert(0,'.')
from palette import T
def rgb(h): h=h.lstrip('#'); return [int(h[i:i+2],16)/255 for i in (0,2,4)]
def lin(c): return [x/12.92 if x<=0.04045 else ((x+0.055)/1.055)**2.4 for x in c]
def lum(h): r,g,b=lin(rgb(h)); return .2126*r+.7152*g+.0722*b
def cr(a,b): x,y=sorted([lum(a),lum(b)]); return (y+.05)/(x+.05)
def v(name,m): 
  x=T[name][m]
  return v(x[6:-1].replace('--',''),m) if x.startswith('var(') else x
fails=0; rows=[]
def chk(fg,bg,minr,m):
  global fails
  r=cr(v(fg,m),v(bg,m)); ok=r>=minr; fails+=not ok
  rows.append((m and 'sombre' or 'clair',fg,bg,round(r,2),minr,'OK' if ok else 'ÉCHEC'))
for m in (0,1):
  for fg in ['text','text-strong','text-neutral','text-moderate','text-primary','text-accent','text-blue','primary-fg']:
    for bg in ['bg-page','bg-surface','bg-surface-minimal','bg-brand-minimal']: chk(fg,bg,4.5,m)
  for s in ['success','critical','warning','info']:
    chk(s+'-text',s+'-bg',4.5,m); chk(s+'-text','bg-surface',4.5,m); chk(s,'bg-surface',3,m)
  for fg,bg in [('text-reverse','brand-primary'),('text-reverse','brand-primary-hover'),('text-reverse','brand-primary-pressed'),('text-reverse','brand-accent'),('text-reverse-muted','brand-accent'),('text-reverse','notification'),('text-reverse','critical'),('text-primary','bg-brand-moderate'),('text','bg-brand-moderate')]: chk(fg,bg,4.5,m)
  for fg in ['border','border-primary','focus-indicator','brand-primary','lean-left','lean-center','lean-right','chart-axis']:
    for bg in ['bg-page','bg-surface']: chk(fg,bg,3,m)
  chk('brand-tertiary','brand-accent',3,m)
  for s in [k for k in T if k.startswith('sector-')]:
    for bg in ['bg-page','bg-surface']: chk(s,bg,4.5,m)
# distinction des secteurs (OKLab) en vision normale, deutéranopie, protanopie
def oklab(h):
  r,g,b=lin(rgb(h))
  l=.4122214708*r+.5363325363*g+.0514459929*b; m_=.2119034982*r+.6806995451*g+.1073969566*b; s=.0883024619*r+.2817188376*g+.6299787005*b
  l,m_,s=[x**(1/3) for x in (l,m_,s)]
  return (.2104542553*l+.7936177850*m_-.0040720468*s, 1.9779984951*l-2.4285922050*m_+.4505937099*s, .0259040371*l+.7827717662*m_-.8086757660*s)
MAT={'deuteranopie':[[.367322,.860646,-.227968],[.280085,.672501,.047413],[-.011820,.042940,.968881]],
     'protanopie':[[.152286,1.052583,-.204868],[.114503,.786281,.099216],[-.003882,-.048116,1.051998]]}
def sim(h,M):
  c=lin(rgb(h)); o=[max(0,min(1,sum(M[i][j]*c[j] for j in range(3)))) for i in range(3)]
  o=[12.92*x if x<=0.0031308 else 1.055*x**(1/2.4)-0.055 for x in o]
  return '#'+''.join(f'{round(x*255):02X}' for x in o)
def d(a,b): A,B=oklab(a),oklab(b); return math.dist(A,B)
sect=[k for k in T if k.startswith('sector-')]+['brand-primary']
dist=[]
for m in (0,1):
  for vis in ['normale','deuteranopie','protanopie']:
    f=(lambda h:h) if vis=='normale' else (lambda h,M=MAT[vis]:sim(h,M))
    pairs=sorted(((d(f(T[a][m]),f(T[b][m])),a,b) for a,b in itertools.combinations(sect,2)))[:3]
    dist.append((m and 'sombre' or 'clair',vis,[(round(x,3),a.replace('sector-',''),b.replace('sector-','')) for x,a,b in pairs]))
if __name__=='__main__':
  for r in rows:
    if r[5]!='OK' or '-v' in sys.argv: print(r)
  print('échecs :',fails,'/',len(rows))
  for x in dist: print(x)
