import numpy as np, scipy.signal as sg, scipy.io.wavfile as wf, subprocess, soundfile as sf
SR=48000; D="/root/son/dl"; K=D+"/kis/addons/kenney_interface_sounds/"; O=D+"/mos/corpora/oculus-audio-pack/ogg/"
def load(p):
    x,sr=sf.read(p,always_2d=True); x=x.mean(1)
    if sr!=SR: x=sg.resample_poly(x,SR,sr)
    return x
def pitch(x,r):  # r>1 plus aigu
    return sg.resample(x,int(len(x)/r))
def fade(x,a=.01,b=.3):
    n=len(x); e=np.ones(n); na=int(a*SR); nb=min(n,int(b*SR))
    e[:na]=np.linspace(0,1,na); e[-nb:]*=np.linspace(1,0,nb); return x*e
drops=[load(K+f"drop_00{i}.wav") for i in range(1,5)]
def mix(events,T=5.2,peak=.22,rev=.25,name="x"):
    N=int(T*SR); L=np.zeros(N); R=np.zeros(N)
    for x,t0,g,pan in events:
        i=int(max(0,t0-.15)*SR); j=min(N,i+len(x)); s=x[:j-i]*g
        L[i:j]+=s*(1-max(0,pan)*.6); R[i:j]+=s*(1+min(0,pan)*.6)
    rng=np.random.default_rng(2); m=int(1.6*SR); t=np.arange(m)/SR
    irL=rng.standard_normal(m)*np.exp(-t/.4); irR=rng.standard_normal(m)*np.exp(-t/.42)
    b,a=sg.butter(2,5000/(SR/2)); irL=sg.lfilter(b,a,irL); irR=sg.lfilter(b,a,irR); irL/=np.sqrt(np.sum(irL**2)); irR/=np.sqrt(np.sum(irR**2))
    L2=L*.85+sg.fftconvolve(L,irL)[:N]*rev; R2=R*.85+sg.fftconvolve(R,irR)[:N]*rev
    out=np.stack([L2,R2],1); f=np.ones(N); f[-int(.9*SR):]=np.linspace(1,0,int(.9*SR)); out*=f[:,None]
    out=out/np.max(np.abs(out))*peak
    wf.write(f"{name}.wav",SR,(out*32767).astype(np.int16))
    subprocess.run(["ffmpeg","-y","-loglevel","error","-i",f"{name}.wav","-b:a","96k",f"{name}.mp3"],check=True)
# moments de l'animation : graine touche le sol 1.1 s ; fruit pousse 1.2-2.4 ; feuille 2.45 ; nom 3.15-3.8
base=[(pitch(drops[3],.8),1.10,1.0,0),(pitch(drops[1],1.1),1.55,.5,-.35),(pitch(drops[3],1.05),1.95,.45,.35),
      (pitch(drops[1],1.35),2.45,.55,.1),(pitch(drops[3],1.2),3.20,.42,-.2),(pitch(drops[1],1.5),3.55,.36,.25)]
mix(base,name="P1-gouttes")
creek=fade(load(O+"WATRFlow_CreekInWoods_LOOP_01.ogg")[:int(5.2*SR)],1.2,1.6)
mix(base+[(creek,0,.18,0)],name="P2-gouttes-ruisseau",rev=.18)
ch=load(O+"MUSCChim_WindChimes_LOOP_01.ogg"); chs=fade(ch[int(1*SR):int(3.8*SR)],.4,1.6)
mix(base+[(chs,3.0,.35,0)],name="P3-gouttes-carillon")
bird=load(O+"AMBForst_ForestBirds_OS_01.ogg"); bs=fade(bird[:int(4.5*SR)],.6,1.5)
mix([(pitch(drops[3],.8),1.10,1.0,0),(pitch(drops[1],1.35),2.45,.6,.1),(bs,1.6,.30,0)],name="P4-goutte-oiseaux",rev=.15)
# P5 : vraies gouttes modélisées (modèle physique de bulle, van den Doel) + écho de grotte
def phys(r_mm, xi=.3, amp=1.0, seed=0):
    r=r_mm/1000; f0=3/r; d=.13/r+.0072*r**-1.5; sig=xi*d
    n=int(.25*SR); t=np.arange(n)/SR; f=f0*(1+sig*t)
    ph=2*np.pi*np.cumsum(f)/SR; x=np.sin(ph)*np.exp(-d*t)
    rng=np.random.default_rng(seed); imp=rng.standard_normal(int(.004*SR))*np.exp(-np.arange(int(.004*SR))/SR/.0008)*.15
    b,a=sg.butter(2,[1500/(SR/2),9000/(SR/2)],'band'); x[:len(imp)]+=sg.lfilter(b,a,imp)
    return x*amp
ev=[(phys(4.2,.35),1.10,1,0),(phys(3.0,.3,seed=1),1.55,.55,-.35),(phys(3.4,.4,seed=2),1.95,.5,.35),(phys(2.4,.3,seed=3),2.45,.6,.1),(phys(2.8,.35,seed=4),3.20,.45,-.2),(phys(2.2,.3,seed=5),3.55,.4,.25)]
mix(ev,name="P5-gouttes-grotte",rev=.45)
print("ok")
