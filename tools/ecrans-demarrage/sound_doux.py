import numpy as np, scipy.signal as sg, scipy.io.wavfile as wf
SR=44100; T=7.0; N=int(SR*T); rng=np.random.default_rng(3)
b=np.zeros((2,N))
def add(sig,start,gain=1.0,pan=0.0):
    i=int(start*SR); j=min(N,i+len(sig)); s=sig[:j-i]*gain
    b[0,i:j]+=s*(1-max(0,pan)*.6); b[1,i:j]+=s*(1+min(0,pan)*.6)
def soft(f,dur,att=.02,dec=1.2,h3=.06):
    n=int(dur*SR); t=np.arange(n)/SR; e=np.minimum(1,t/att)*np.exp(-t/dec)
    return (np.sin(2*np.pi*f*t)+h3*np.sin(2*np.pi*f*3*t)+.15*np.sin(2*np.pi*f*2*t))*e
def pad(fs,dur,att=1.5,rel=1.8):
    n=int(dur*SR); t=np.arange(n)/SR; s=sum(np.sin(2*np.pi*f*t+.3*np.sin(2*np.pi*.2*t+k)) for k,f in enumerate(fs))/len(fs)
    return s*np.clip(t/att,0,1)*np.clip((dur-t)/rel,0,1)
# nappe douce tout du long
add(pad([130.81,196.0,261.63],7.0,2.0,2.0),0,.10)
add(pad([329.63,392.0],5.0,1.5,2.0),2.0,.05)
# souffle d'air très léger
n=int(7*SR); bb,aa=sg.butter(2,[300/(SR/2),1400/(SR/2)],'band'); air=sg.lfilter(bb,aa,rng.standard_normal(n))*np.clip(np.sin(np.pi*np.arange(n)/n),0,1)**2
add(air,0,.012)
# graine qui descend : glissando très doux
d=.85; m=int(d*SR); t=np.arange(m)/SR; fr=1568*(784/1568)**(t/d); g=np.sin(2*np.pi*np.cumsum(fr)/SR)*np.sin(np.pi*t/d)**2
add(g,.25,.035)
# arrivée au sol : floraison basse, sans choc
m=int(1.6*SR); t=np.arange(m)/SR; add(np.sin(2*np.pi*98*t)*np.minimum(1,t/.08)*np.exp(-t/.6),1.1,.22)
# pousse : notes de harpe douces (pentatonique)
for i,f in enumerate([392.0,440.0,523.25,587.33,659.25]): add(soft(f,1.6,.03,1.0),1.3+i*.24,.07,-.4+i*.2)
# feuille
add(soft(1046.5,1.0,.01,.5),2.5,.05,.3)
# motif Sounsouni façon kalimba, doux
for f,dt in [(523.25,0),(659.25,.16),(783.99,.32),(1046.5,.52)]: add(soft(f,2.0,.008,.9,.12),3.15+dt,.13)
add(soft(1567.98,2.5,.02,1.4,.02),3.75,.03)
# réverbération douce
ir_n=int(1.8*SR); ir=rng.standard_normal(ir_n)*np.exp(-np.arange(ir_n)/SR/0.5); ir/=np.sqrt(np.sum(ir**2))
wet=np.stack([sg.fftconvolve(b[c],ir)[:N] for c in range(2)])
out=b*.75+wet*.35
fade=np.ones(N); fade[-int(.6*SR):]=np.linspace(1,0,int(.6*SR)); out*=fade
out=out/np.max(np.abs(out))*.6
wf.write("/root/splash/c1_doux.wav",SR,(out.T*32767).astype(np.int16)); print("ok")
