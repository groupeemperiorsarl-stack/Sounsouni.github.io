import json, subprocess, numpy as np, sys, wave
CUTS={"a1135":[(49.58,50.12),(80.96,81.66),(153.76,154.62),(166.80,167.72),(190.10,191.02),(202.70,203.42),(206.06,207.42),(215.24,216.34),(220.06,221.78)],
      "a1142":[(153.84,155.60),(169.72,170.60),(206.00,206.52),(273.76,274.38)]}
def load(f):
    raw=subprocess.run(["ffmpeg","-v","error","-i",f,"-ac","1","-ar","24000","-f","s16le","-"],capture_output=True,check=True).stdout
    return np.frombuffer(raw,np.int16).astype(np.float32)
SR=24000
def rms(x,t):  # énergie autour de t (fenêtre 20 ms)
    i=int(t*SR); w=x[max(0,i-240):i+240]; return float(np.sqrt(np.mean(w*w)+1e-9))
def best(x,lo,hi):
    ts=np.arange(lo,hi,0.01); return float(min(ts,key=lambda t:rms(x,t)))
out={}
for name,cuts in CUTS.items():
    x=load("audio/%s.wav"%name); refined=[]
    for a,b in cuts:
        a2=best(x,a-0.30,a+0.06); b2=best(x,b-0.25,b+0.02)
        refined.append((round(a2,2),round(b2,2)))
        seg=x[int(a2*SR):int(b2*SR)].astype(np.int16)
        with wave.open("audio/cut_%s_%d.wav"%(name,int(a)),"wb") as w: w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes(seg.tobytes())
    out[name]=refined; print(name,refined)
json.dump(out,open("cuts.json","w"))
