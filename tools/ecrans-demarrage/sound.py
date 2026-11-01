import numpy as np, scipy.signal as sg, scipy.io.wavfile as wf
SR=44100; T=7.0; N=int(SR*T)
rng=np.random.default_rng(7)
def env(n,a,d): t=np.arange(n)/SR; return np.minimum(1,t/max(a,1e-4))*np.exp(-t/d)
def add(buf,sig,start,gain=1.0,pan=0.0):
    i=int(start*SR); j=min(N,i+len(sig)); s=sig[:j-i]*gain
    buf[0,i:j]+=s*(1-max(0,pan)); buf[1,i:j]+=s*(1+min(0,pan))
def tone(f,dur,a=.005,d=.4,harm=((1,1),(2.0,.25),(3.98,.12))):
    n=int(dur*SR); t=np.arange(n)/SR; s=sum(g*np.sin(2*np.pi*f*h*t) for h,g in harm); return s*env(n,a,d)
def balafon(f,dur=1.0): return tone(f,dur,.003,.28,((1,1),(3.95,.35),(9.8,.08)))
def bell(f,dur=3.0): return tone(f,dur,.002,1.1,((1,1),(2.76,.4),(5.4,.2),(8.9,.08)))
def noise(dur,lo,hi,order=2): n=int(dur*SR); b,a=sg.butter(order,[lo/(SR/2),hi/(SR/2)],'band'); return sg.lfilter(b,a,rng.standard_normal(n))
def swell(n,peak_at,total): t=np.arange(n)/SR; return np.clip(np.where(t<peak_at,t/peak_at,1-(t-peak_at)/max(total-peak_at,1e-3)),0,1)**2
def thump(f=65,dur=.6): n=int(dur*SR); t=np.arange(n)/SR; fr=f*(1+2.5*np.exp(-t*30)); return np.sin(2*np.pi*np.cumsum(fr)/SR)*np.exp(-t*7)
def sweep(f0,f1,dur,amp=1): n=int(dur*SR); t=np.arange(n)/SR; fr=f0*(f1/f0)**(t/dur); return amp*np.sin(2*np.pi*np.cumsum(fr)/SR)*np.sin(np.pi*t/dur)
def pad(fs,dur,start_fade=.8):
    n=int(dur*SR); t=np.arange(n)/SR; s=sum(np.sin(2*np.pi*f*t+np.sin(2*np.pi*.3*t)*.4) for f in fs)/len(fs); return s*np.clip(t/start_fade,0,1)*np.clip((dur-t)/1.2,0,1)
MOTIF=[(523.25,0),(659.25,.14),(783.99,.28),(1046.5,.46)]
def save(name,buf):
    buf=buf/np.max(np.abs(buf))*0.85; fade=np.ones(N); fade[-int(.4*SR):]=np.linspace(1,0,int(.4*SR)); buf*=fade
    wf.write(f"/root/splash/{name}.wav",SR,(buf.T*32767).astype(np.int16))
# c1 Éclosion
b=np.zeros((2,N))
add(b,noise(7,200,900)*swell(int(7*SR),2,7),0,.05)
add(b,sweep(1800,600,.85,1)*.5,.25,.18)
add(b,thump(70,.8),1.1,.9); add(b,noise(.5,300,2500)*env(int(.5*SR),.002,.12),1.1,.25)
for i,f in enumerate([392,440,523.25,587.33,659.25,783.99]): add(b,tone(f,1.2,.01,.5,((1,1),(2,.2))),1.25+i*.22,.13,(-.5+i*.2))
add(b,balafon(1318.5,.5),2.45,.25,.3)
for f,dt in MOTIF: add(b,balafon(f),3.15+dt,.42)
add(b,pad([261.63,329.63,392,523.25],4.2),2.8,.12)
add(b,bell(1046.5),4.0,.12)
save("c1",b)
# c2 Harmattan
b=np.zeros((2,N))
w=noise(4,150,1200)*swell(int(4*SR),2.6,4); add(b,w,0,.35,-.3); add(b,noise(4,800,4000)*swell(int(4*SR),2.8,4),0,.08,.3)
for k in range(140):
    tt=rng.uniform(.3,3.4); add(b,tone(rng.uniform(2500,6000),.08,.001,.03,((1,1),)),tt,.05*rng.uniform(.3,1),rng.uniform(-.8,.8))
add(b,sweep(200,900,3.3,1),.3,.08)
for f in [523.25,659.25,783.99,1046.5]: add(b,bell(f,3.5),3.55,.16)
add(b,thump(55,1.0),3.55,.5)
for f,dt in MOTIF: add(b,balafon(f),4.3+dt,.3)
add(b,pad([261.63,392,523.25],3.4),3.6,.12)
save("c2",b)
# c3 Mosaïque
b=np.zeros((2,N))
add(b,noise(1,500,3000)*swell(int(SR),.5,1),0,.1)
for k in range(220):
    d=rng.uniform(0,1); tt=.95+d*1.05+rng.uniform(0,.15); add(b,tone(rng.uniform(1800,3200),.05,.0005,.012,((1,1),(2.3,.4))),tt,.12,rng.uniform(-.9,.9))
add(b,noise(1.2,300,4000)*swell(int(1.2*SR),.5,1.2),2.55,.35)
add(b,sweep(300,1200,1.0,1),2.6,.08)
add(b,thump(60,.7),3.95,.5)
for f in [659.25,783.99,1046.5]: add(b,bell(f,3),4.05,.14)
for i in range(9): add(b,balafon([523.25,587.33,659.25,783.99,880,783.99,659.25,783.99,1046.5][i],.6),4.0+i*.07,.2,(-.6+i*.15))
add(b,pad([293.66,440,587.33],3),4.0,.1)
save("c3",b)
# c4 Bogolan
b=np.zeros((2,N))
add(b,noise(1.6,80,600)*swell(int(1.6*SR),.9,1.6),.4,.4)
add(b,sweep(120,60,1.2,1),.75,.15)
for tt in [1.45,1.95,2.45,2.95]: add(b,thump(90,.35),tt,.45)
for tt in [1.7,2.2,2.7,3.2]: add(b,noise(.12,1500,6000)*env(int(.12*SR),.001,.03),tt,.18)
for i in range(7): add(b,balafon([783.99,880,1046.5,1174.66,1318.5,1567.98,1760][i],.6),3.77+i*.1,.28,(-.6+i*.2))
add(b,thump(50,1.2),4.05,1.0); add(b,bell(523.25,3),4.05,.2); add(b,bell(784,3),4.05,.12)
for i in range(9): add(b,thump(110,.18),4.15+i*.05,.08)
add(b,pad([196,293.66,392],3),4.1,.12)
save("c4",b)
print("sons ok")
