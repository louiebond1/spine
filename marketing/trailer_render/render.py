#!/usr/bin/env python3
"""Spine Gone Quiet: source-faithful 75-second product trailer preview.
Uses ONLY original repo MP4s. No invented product screens. Soundtrack is original synthesis.
"""
from pathlib import Path
import subprocess, math, wave, os, textwrap
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'output'
OUT.mkdir(exist_ok=True)
CLIPS=ROOT.parent/'clips'
W,H,FPS=1280,720,30
NAVY=(14,22,41)
CREAM=(250,249,246)
BLUE=(59,91,219)
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

def run(cmd):
    print('RUN', ' '.join(map(str,cmd))[:240],flush=True)
    subprocess.run([str(x) for x in cmd],check=True)

def font(size,bold=False):
    return ImageFont.truetype(BOLD if bold else FONT,size)

def textfit(draw,text,maxwidth,initial=58,minsize=28,bold=False):
    for size in range(initial,minsize-1,-1):
        f=font(size,bold)
        if draw.textbbox((0,0),text,font=f)[2]<=maxwidth: return f
    return font(minsize,bold)

def panel(path,heading,sub='',label='',duration=3,light=False):
    im=Image.new('RGB',(W,H),CREAM if light else NAVY)
    d=ImageDraw.Draw(im)
    fg=NAVY if light else CREAM
    d.rounded_rectangle((92,89,150,101),radius=6,fill=BLUE)
    if label:
        d.text((92,130),label.upper(),font=font(22,True),fill=BLUE)
    lines=textwrap.wrap(heading,width=31,break_long_words=False)
    y=238-(len(lines)-1)*28
    for line in lines:
        f=textfit(d,line,W-180,65,34,True)
        d.text((92,y),line,font=f,fill=fg)
        y+=84
    if sub:
        for line in textwrap.wrap(sub,width=60):
            d.text((94,y+28),line,font=font(26),fill=(145,158,185) if not light else (92,102,122))
            y+=38
    d.text((93,650),'SPINE  /  GONE QUIET',font=font(16,True),fill=BLUE)
    im.save(path)
    return path

def banner(path,chapter,headline,idx,accent=BLUE):
    im=Image.new('RGBA',(W,H),(0,0,0,0))
    d=ImageDraw.Draw(im)
    d.rectangle((0,0,W,93),fill=(14,22,41,237))
    d.rectangle((0,0,9,93),fill=accent+(255,))
    d.text((38,15),chapter.upper(),font=font(18,True),fill=(137,162,244))
    f=textfit(d,headline,W-80,32,23,True)
    d.text((38,42),headline,font=f,fill=CREAM)
    d.text((W-155,676),'DEMO DATA',font=font(14,True),fill=(52,61,80,205))
    if 5<=idx<=14:
        d.rounded_rectangle((35,641,945,650),radius=4,fill=(206,211,224,220))
        stages=6
        progress={5:2,6:3,7:4,8:4,9:4,10:4,11:5,12:6,13:6,14:6}.get(idx,1)
        for j in range(progress):
            color=(190,45,40,255) if idx in (8,9) and j==3 else accent+(255,)
            d.rounded_rectangle((35+j*152,641,35+j*152+145,650),radius=3,fill=color)
    im.save(path)
    return path

def ffprobe_duration(p):
    q=subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(p)])
    return float(q)

def video_from_image(img,dur,dest):
    run(['ffmpeg','-hide_banner','-loglevel','error','-y','-loop','1','-framerate',str(FPS),'-i',img,'-t',str(dur),
         '-vf',f'fps={FPS},format=yuv420p','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-an',dest])

def product_segment(src,dur,dest,overlay):
    actual=ffprobe_duration(src)
    speed=actual/dur
    # Display the genuine interface without changing any UI or claiming nonexistent interactions.
    # Mild centre crop retains the product's central content.
    vf=(f'setpts=(PTS-STARTPTS)/{speed:.8f},fps={FPS},'
        f'scale=1280:720:flags=lanczos,setsar=1,format=yuv420p')
    run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',src,'-loop','1','-framerate',str(FPS),'-i',overlay,
         '-filter_complex',f'[0:v]{vf}[base];[base][1:v]overlay=0:0:shortest=1,format=yuv420p[v]',
         '-map','[v]','-t',str(dur),'-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-an',dest])

def make_audio(path,total):
    sr=24000
    n=total*sr
    t=np.arange(n,dtype=np.float64)/sr
    a=np.zeros(n,dtype=np.float64)
    # Ambient cinematic pad with clear music drop during blocked/Pulse.
    for k,frequency in enumerate([110,164.81,220,329.63]):
        osc=np.sin(2*np.pi*frequency*t + 0.04*np.sin(2*np.pi*0.17*t))
        a+=0.025*osc/(k+1)
    a+=0.009*np.sin(2*np.pi*0.6*t)*np.sin(2*np.pi*220*t)
    env=np.zeros(n)
    def ramp(start,end):
        lo,hi=int(start*sr),int(end*sr)
        if hi>lo: env[lo:hi]=np.linspace(0,1,hi-lo)
    ramp(6,12)
    env[int(12*sr):int(38*sr)]=1
    env[int(38*sr):int(47*sr)]=0
    ramp(47,49)
    env[int(49*sr):int(69*sr)]=1
    env[int(69*sr):]=np.linspace(1,0,n-int(69*sr))
    a*=env
    # Crisp, non-speech sound cues on meaningful beats.
    for sec in [6,11,21,25,29,33,47,50,54,59,65]:
        pos=int(sec*sr)
        size=min(int(.19*sr),n-pos)
        tt=np.arange(size)/sr
        click=.075*np.sin(2*np.pi*(740 if sec!=47 else 520)*tt)*np.exp(-26*tt)
        a[pos:pos+size]+=click
    a=np.clip(a,-.7,.7)
    with wave.open(str(path),'wb') as wf:
        wf.setnchannels(1);wf.setsampwidth(2);wf.setframerate(sr)
        wf.writeframes((a*32767).astype('<i2').tobytes())

def main():
    shots=[
      ('01-home-what-needs-you.mp4',3,'ASK','Your company’s AI questions, in one place'),
      ('02-ask-a-question.mp4',5,'ASK','Ask privately. Get the right guidance.'),
      ('03-champion-answers.mp4',7,'ASK','A Champion answers with company-specific rules'),
      ('15-playbook.mp4',2,'ASK','Grounded in your company Playbook'),
      ('04-answer-helps-someone-else.mp4',4,'ASK','Answered once. Useful again.'),
      ('05-approve-the-idea.mp4',4,'BUILD','Good ideas get a decision'),
      ('06-someone-joins.mp4',3,'BUILD','The right people join the team'),
      ('07-plan-moves-forward.mp4',5,'BUILD','AI drafts the plan. People own the work.'),
      ('08-blocked.mp4',4,'UNBLOCK','A missing SAP export blocks progress'),
      ('09-pulse-catches-it.mp4',4,'UNBLOCK','Pulse notices when work gets stuck'),
      ('10-unblocked.mp4',3,'UNBLOCK','Back on track'),
      ('11-goes-live.mp4',3,'PROVE','The project goes Live'),
      ('12-team-reports-hours.mp4',4,'PROVE','12 hours reported. Not yet verified.'),
      ('13-verified-outside-the-team.mp4',4,'PROVE','An independent check makes it count'),
      ('14-leadership-sees-it.mp4',4,'PROVE','Leadership sees verified impact'),
    ]
    # 6 + 59 + 10 = 75 seconds.
    assert sum(x[1] for x in shots)==59
    segments=[]
    p=OUT/'opening.png'
    panel(p,'Most AI ideas don’t fail.','They go quiet.','THE PROBLEM')
    video_from_image(p,6,OUT/'seg00.mp4')
    segments.append(OUT/'seg00.mp4')
    for idx,(filename,duration,chapter,headline) in enumerate(shots):
        src=CLIPS/filename
        if not src.exists(): raise FileNotFoundError(src)
        overlay=OUT/f'overlay{idx:02}.png'
        banner(overlay,chapter,headline,idx,accent=(190,45,40) if idx in (8,9) else BLUE)
        dst=OUT/f'seg{idx+1:02}.mp4'
        product_segment(src,duration,dst,overlay)
        segments.append(dst)
    end=OUT/'closing.png'
    panel(end,'Spine','Where your company’s AI ideas get answered, built and proven.','BOOK A DEMO',light=True)
    video_from_image(end,10,OUT/'seg16.mp4')
    segments.append(OUT/'seg16.mp4')
    manifest=OUT/'concat.txt'
    manifest.write_text(''.join("file '"+str(x.resolve())+"'\n" for x in segments))
    silent=OUT/'silent.mp4'
    run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',manifest,
         '-c','copy',silent])
    soundtrack=OUT/'score.wav'
    make_audio(soundtrack,75)
    final=OUT/'spine_gone_quiet_75s_preview.mp4'
    run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',silent,'-i',soundtrack,
         '-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','160k','-t','75',
         '-movflags','+faststart',final])
    print('FINAL',final,final.stat().st_size)

if __name__=='__main__': main()
