import numpy as np, scipy.signal as sg, scipy.io.wavfile as wf
SR=44100; rng=np.random.default_rng(7)
def buf(sec,ch=1): return np.zeros((int(SR*sec),ch))
def bp(x,f,q): b,a=sg.iirpeak(f/(SR/2),q); return sg.lfilter(b,a,x)
def hp(x,f,o=2): s=sg.butter(o,f/(SR/2),'high',output='sos'); return sg.sosfilt(s,x)
def lp(x,f,o=2): s=sg.butter(o,f/(SR/2),'low',output='sos'); return sg.sosfilt(s,x)
def add(dst,sig,t,pan=0.0,gain=1.0):
    i=int(t*SR); n=min(len(sig),len(dst)-i)
    if n<=0: return
    if dst.shape[1]==1: dst[i:i+n,0]+=sig[:n]*gain
    else:
        l=np.cos((pan+1)*np.pi/4); r=np.sin((pan+1)*np.pi/4)
        dst[i:i+n,0]+=sig[:n]*gain*l*1.414; dst[i:i+n,1]+=sig[:n]*gain*r*1.414
def modes(n,fl,fh,dl,dh,dur,amp=1.0):
    t=np.arange(int(dur*SR))/SR; s=np.zeros_like(t)
    for _ in range(n):
        f=np.exp(rng.uniform(np.log(fl),np.log(fh))); d=rng.uniform(dl,dh)
        s+=rng.uniform(.3,1)*np.sin(2*np.pi*f*t+rng.uniform(0,6.28))*np.exp(-t/d)
    return s/n*amp
def burst(dur,tau,f1=600):
    t=np.arange(int(dur*SR))/SR; return hp(rng.standard_normal(len(t))*np.exp(-t/tau),f1)
def click(amp=1.0,bright=1.0):
    # 單張紙牌彈過拇指：短促雜訊激發紙板共振
    x=burst(.016,rng.uniform(.0012,.0026),700)
    x=bp(x,rng.uniform(1800,3200)*bright,2.2)+.5*bp(x,rng.uniform(3800,6000)*bright,3)+.35*lp(x,8000)
    x+=modes(4,1200,4200,.0008,.002,.016,.35)
    return x*amp
def slap(amp=1.0):
    # 紙牌平拍在桌上：寬頻瞬態＋紙板模態＋桌面低頻
    s=burst(.04,.0028,400)
    s=lp(s,7000)+.5*bp(s,1800,1.5)
    s+=modes(14,700,4500,.0012,.0045,.04,1.1)
    t=np.arange(int(.05*SR))/SR; s2=np.zeros(int(.05*SR)); s2[:len(s)]+=s
    s2+=.45*np.sin(2*np.pi*120*t)*np.exp(-t/.009)*(1-np.exp(-t/.0006))
    return s2*amp
def swish(dur=.09,f0=1200,f1=4200,f2=2000,amp=.35):
    n=int(dur*SR); t=np.linspace(0,1,n); x=rng.standard_normal(n)
    fc=np.where(t<.5,f0+(f1-f0)*(t/.5),f1+(f2-f1)*((t-.5)/.5))
    out=np.zeros(n); blk=256
    for i in range(0,n,blk):
        seg=x[max(0,i-1024):i+blk]; y=bp(seg,fc[min(i,n-1)],1.6); out[i:i+blk]=y[-len(out[i:i+blk]):]
    env=np.sin(np.pi*t)**1.6
    return lp(hp(out,700),7000)*env*amp
def friction(dur,amp=.4,fc=2200):
    n=int(dur*SR); t=np.linspace(0,1,n); x=rng.standard_normal(n)
    x=lp(bp(x,fc,1.1),5500)+.4*hp(x,3000)*.3
    env=(1-np.exp(-t*18))*np.exp(-np.maximum(0,t-.55)*9)
    # 細微的顫動（紙面與桌面摩擦的不平均）
    env*=1+.35*np.sin(2*np.pi*t*dur*rng.uniform(28,40))
    return x*env*amp
def room(y,rt=.22,wet=.10):
    n=int(rt*SR); t=np.arange(n)/SR
    ir=rng.standard_normal(n)*np.exp(-t/(rt/6.9)); ir=lp(ir,4500); ir/=np.sqrt((ir**2).sum())
    out=np.zeros((len(y)+n-1,y.shape[1]))
    for c in range(y.shape[1]):
        out[:,c]=np.pad(y[:,c],(0,n-1))+wet*sg.fftconvolve(y[:,c],ir if c==0 else np.roll(ir,37))
    return out
def finish(y,name,peak=-3.0,sr=SR):
    y=room(y); y=hp(y.T,40).T
    tail=int(.02*SR); y[-tail:]*=np.linspace(1,0,tail)[:,None]
    e=np.abs(y).max(1); last=np.nonzero(e>e.max()*10**(-60/20))[0][-1]; y=y[:min(len(y),last+int(.03*SR))]
    tail=int(.02*SR); y[-tail:]*=np.linspace(1,0,tail)[:,None]
    y=y/np.abs(y).max()*10**(peak/20)
    if sr!=SR: y=sg.resample_poly(y,sr,SR,axis=0)
    wf.write(name,sr,(y*32767).astype(np.int16)); print(name,f'{len(y)/sr:.2f}s')
# 翻牌：拇指撥起 → 空中翻面的氣流 → 拍桌
for v in range(3):
    y=buf(.32); add(y,click(.55,1.1),.0); add(y,swish(.085+.01*v,1100,3600+300*v,1800,.22),.008)
    add(y,slap(1.0),.098+.006*v); add(y,click(.12,.7),.118+.006*v); finish(y,f'flip{v}.wav')
# 發牌：牌滑過桌面＋落定
for v in range(2):
    y=buf(.32); add(y,friction(.16+.02*v,.42,2000+300*v),.0); add(y,slap(.55),.15+.02*v); finish(y,f'deal{v}.wav')
# 洗牌（鴿尾洗牌 riffle + 彎牌回推 bridge + 整牌敲桌）
def shuffle(total,name,riffle_n,riffle_dur):
    y=buf(total,2)
    add(y,friction(.12,.25,1700),0.0,0,1)                # 拿起牌
    t=.14; L=riffle_n; t0=t
    for k in range(L):
        u=k/(L-1); dt=(riffle_dur/L)*(1.45-.9*np.sin(np.pi*min(1,u*1.1)))  # 起頭慢、中段最快
        side=-.4 if rng.random()<.5 else .4
        a=rng.uniform(.35,1.0)*(0.7+.3*np.sin(np.pi*u))
        add(y,click(a,rng.uniform(.9,1.15)),t+rng.uniform(-.0025,.0025),side+rng.uniform(-.15,.15))
        if rng.random()<.35: add(y,click(a*.5,1.0),t+rng.uniform(.002,.005),-side)   # 左右兩疊同時落下的雙響
        t+=dt
    add(y,friction(t-t0+.04,.10,2600),t0-.02,0,1)
    # bridge：彎起的牌瀑布般落下
    tb=t+.05; dur=min(.32,total-tb-.2); n=int(dur/0.004)
    for k in range(n):
        u=k/n; add(y,click(.35*(1-.6*u)*rng.uniform(.6,1),rng.uniform(.8,1.0)),tb+u*dur+rng.uniform(0,.002),rng.uniform(-.5,.5))
    add(y,friction(dur+.05,.18,1500),tb,0,1)
    te=tb+dur+.06; add(y,slap(.75),te,0); add(y,slap(.35),te+.09,0)  # 整牌兩下敲桌
    finish(y,name,-3.5,32000)
shuffle(1.85,'shuffle.wav',52,.72)
shuffle(1.05,'shuffle_short.wav',30,.38)
