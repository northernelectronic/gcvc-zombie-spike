# Generates icon + splash sources for @capacitor/assets (zombie volleyball face)
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import math, os
OUT='resources'; os.makedirs(OUT,exist_ok=True)
FONT='/usr/share/fonts/truetype/sand-box/google/Barlow Condensed/BarlowCondensed-ExtraBold.ttf'
def bg(w,h):
    s=4; im=Image.new('RGB',(w//s,h//s),'#0b0d0c'); d=ImageDraw.Draw(im); w2,h2=im.size
    cx,cy=w2/2,h2*0.46; R=max(w2,h2)*0.75
    for i in range(120,0,-1):
        r=R*i/120; t=i/120
        d.ellipse([cx-r,cy-r,cx+r,cy+r],fill=(int(20+40*(1-t)),int(40+150*(1-t)**2),int(28+60*(1-t)**2)))
    return im.filter(ImageFilter.GaussianBlur(w2/60)).resize((w,h),Image.BICUBIC)
def ball(size):
    L=Image.new('RGBA',(size,size),(0,0,0,0)); d=ImageDraw.Draw(L); c=size/2
    m=size*0.03; d.ellipse([m,m,size-m,size-m],fill='#eef3e6',outline='#1a1a1a',width=int(size*0.025))
    mask=Image.new('L',(size,size),0); ImageDraw.Draw(mask).ellipse([m*2,m*2,size-m*2,size-m*2],fill=255)
    P=Image.new('RGBA',(size,size),(0,0,0,0)); pd=ImageDraw.Draw(P)
    for k,col in enumerate(['#c8102e','#7ddc3c','#c8102e']):
        a=k*2*math.pi/3-math.pi/2; ox,oy=c+math.cos(a)*size*0.62,c+math.sin(a)*size*0.62; r=size*0.5
        pd.ellipse([ox-r,oy-r,ox+r,oy+r],outline=col,width=int(size*0.07))
    a=P.split()[3]; a=Image.composite(a,Image.new('L',a.size,0),mask); L.paste(P,(0,0),a)
    G=Image.new('RGBA',(size,size),(0,0,0,0)); gd=ImageDraw.Draw(G)
    for ex in (0.36,0.64):
        x,y=size*ex,size*0.47; r=size*0.085; gd.ellipse([x-r,y-r,x+r,y+r],fill=(170,255,90,255))
    glow=G.filter(ImageFilter.GaussianBlur(size*0.04)); L=Image.alpha_composite(L,glow); L=Image.alpha_composite(L,glow)
    d=ImageDraw.Draw(L)
    for ex in (0.36,0.64):
        x,y=size*ex,size*0.47; r=size*0.075; d.ellipse([x-r,y-r,x+r,y+r],fill='#1d2a10'); r2=size*0.05
        d.ellipse([x-r2,y-r2,x+r2,y+r2],fill='#c6ff6a'); r3=size*0.018; o=size*0.012
        d.ellipse([x-r3+o,y-r3-o,x+r3+o,y+r3-o],fill='white')
    d.arc([size*0.32,size*0.5,size*0.68,size*0.72],20,160,fill='#1a1a1a',width=int(size*0.025))
    for t in range(6):
        a=math.radians(30+t*24); x=c+math.cos(a)*size*0.18; y=size*0.61+math.sin(a)*size*0.11
        d.line([x,y-size*0.035,x,y+size*0.035],fill='#1a1a1a',width=int(size*0.014))
    return L
def put(im,s,cy):
    b=ball(s); w,h=im.size; x=(w-s)//2; y=int(cy-s/2)
    sh=Image.new('RGBA',im.size,(0,0,0,0)); sh.paste(Image.new('RGBA',(s,s),(0,0,0,170)),(x+s//30,y+s//20),b.split()[3])
    im=Image.alpha_composite(im,sh.filter(ImageFilter.GaussianBlur(s/40))); im.paste(b,(x,y),b); return im
S=2048
icon=put(bg(S,S).convert('RGBA'),int(S*0.72),S*0.5).convert('RGB').resize((1024,1024),Image.LANCZOS)
icon.save(f'{OUT}/icon-only.png'); icon.save(f'{OUT}/icon.png')
icon.resize((512,512),Image.LANCZOS).save('public/icon-512.png'); icon.resize((192,192),Image.LANCZOS).save('public/icon-192.png')
fg=put(Image.new('RGBA',(S,S),(0,0,0,0)),int(S*0.5),S*0.5).resize((1024,1024),Image.LANCZOS); fg.save(f'{OUT}/icon-foreground.png')
bg(1024,1024).save(f'{OUT}/icon-background.png')
W=2732; sp=put(bg(W,W).convert('RGBA'),int(W*0.26),W*0.43); d=ImageDraw.Draw(sp)
f=ImageFont.truetype(FONT,int(W*0.075))
for txt,y,col in (('ZOMBIE',0.585,'#b6ff4a'),('SPIKE',0.655,'#ffffff')):
    tw=d.textlength(txt,font=f); d.text(((W-tw)/2,W*y),txt,font=f,fill=col,stroke_width=10,stroke_fill='#0b0d0c')
f2=ImageFont.truetype(FONT,int(W*0.022)); t='GCVC UNITED'; d.text(((W-d.textlength(t,font=f2))/2,W*0.75),t,font=f2,fill='#c8102e')
sp=sp.convert('RGB'); sp.save(f'{OUT}/splash.png'); sp.save(f'{OUT}/splash-dark.png')
print('ok')
