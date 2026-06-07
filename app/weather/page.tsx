'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { getRiskLevel, RISK_COLORS } from '@/lib/supabase';

interface Day { date:string;dayTh:string;prob:number;mm:number;tMax:number;tMin:number }
interface Hour { time:string;mm:number }
const DAY_TH = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์'];
type RV = 'now'|'past'|'fc';

export default function WeatherPage() {
  const [daily, setDaily] = useState<Day[]>([]);
  const [hourly, setHourly] = useState<Hour[]>([]);
  const [loading, setLoading] = useState(true);
  const [rv, setRv] = useState<RV>('now');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    fetch('https://api.open-meteo.com/v1/forecast?latitude=18.7&longitude=98.9&daily=precipitation_probability_max,precipitation_sum,temperature_2m_max,temperature_2m_min&hourly=precipitation&timezone=Asia%2FBangkok&forecast_days=7')
      .then(r=>r.json()).then(wx=>{
        if(wx?.daily){
          const d=wx.daily;
          setDaily((d.time as string[]).map((dt:string,i:number)=>({
            date:dt,dayTh:DAY_TH[new Date(dt+'T00:00:00').getDay()],
            prob:d.precipitation_probability_max[i]??0,
            mm:Math.round((d.precipitation_sum[i]??0)*10)/10,
            tMax:Math.round(d.temperature_2m_max[i]??0),tMin:Math.round(d.temperature_2m_min[i]??0),
          })));
        }
        if(wx?.hourly){
          const h=wx.hourly;
          const now=new Date();
          const items:Hour[]=[];
          for(let i=0;i<h.time.length&&items.length<24;i++){
            if(new Date(h.time[i])>=now) items.push({time:h.time[i].slice(11,16),mm:Math.round((h.precipitation[i]??0)*10)/10});
          }
          setHourly(items);
        }
      }).catch(()=>{}).finally(()=>setLoading(false));
  },[]);

  const drawRadar = useCallback(()=>{
    const c=canvasRef.current,w=wrapRef.current;
    if(!c||!w)return;
    c.width=w.offsetWidth||400;c.height=w.offsetHeight||300;
    const ctx=c.getContext('2d')!,W=c.width,H=c.height;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='rgba(5,12,25,0.30)';ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(100,140,200,0.10)';ctx.lineWidth=0.5;
    for(let x=0;x<W;x+=W/10){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=0;y<H;y+=H/8){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    [0.2,0.38,0.56].forEach(r=>{ctx.beginPath();ctx.arc(W/2,H/2,r*Math.min(W,H),0,Math.PI*2);ctx.stroke();});
    function rain(cx:number,cy:number,rx:number,ry:number,it:number,al:number){
      const RAMP:string[]=['rgba(41,182,246','rgba(67,160,71','rgba(253,216,53','rgba(251,140,0','rgba(229,57,53','rgba(123,31,162'];
      const idx=Math.min(5,Math.floor(it*5.9));
      const g=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(rx,ry));
      g.addColorStop(0,`${RAMP[idx]},${al})`);g.addColorStop(0.6,`${RAMP[idx]},${al*0.4})`);g.addColorStop(1,`${RAMP[idx]},0)`);
      ctx.save();const mx=Math.max(rx,ry);ctx.scale(rx/mx,ry/mx);
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx*(mx/rx),cy*(mx/ry),mx,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    if(rv==='now'){rain(W*.66,H*.27,W*.20,H*.17,0.72,0.88);rain(W*.71,H*.38,W*.11,H*.09,0.52,0.75);rain(W*.28,H*.72,W*.13,H*.11,0.38,0.65);}
    else if(rv==='past'){rain(W*.80,H*.20,W*.15,H*.13,0.62,0.82);rain(W*.50,H*.62,W*.11,H*.09,0.42,0.68);}
    else{rain(W*.52,H*.42,W*.24,H*.20,0.78,0.92);rain(W*.57,H*.52,W*.15,H*.13,0.92,0.88);rain(W*.36,H*.67,W*.16,H*.14,0.55,0.72);}
    ctx.fillStyle='rgba(160,190,230,0.5)';ctx.font='9px sans-serif';ctx.textAlign='left';
    ctx.fillText('50km',W/2+0.2*Math.min(W,H)+3,H/2);ctx.fillText('100km',W/2+0.38*Math.min(W,H)+3,H/2);
    ctx.beginPath();ctx.arc(W/2,H/2,6,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,0.95)';ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.6)';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(W/2,H/2,15,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.85)';ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillText('FLP2',W/2,H/2-20);
    const dp=[[W/2,13],[W-9,H/2],[W/2,H-5],[9,H/2]] as [number,number][];
    ctx.fillStyle='rgba(200,220,255,0.5)';ctx.font='10px sans-serif';
    ['N','E','S','W'].forEach((l,i)=>{ctx.textAlign='center';ctx.fillText(l,dp[i][0],dp[i][1]);});
  },[rv]);

  useEffect(()=>{ drawRadar(); },[drawRadar]);

  const todayStr=new Date().toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'});
  const lbl:Record<RV,string>={now:`${todayStr} — ปัจจุบัน`,past:`${todayStr} — 1 ชม.ที่แล้ว`,fc:`${todayStr} — พยากรณ์ +3 ชม.`};
  const maxMm=Math.max(...hourly.map(h=>h.mm),1);

  const CL=(p:number)=>p>=70?'#b52b1e':p>=40?'#a0560a':'#155d31';

  if(loading) return <div className="p-4 animate-pulse space-y-3"><div className="h-64 bg-muted rounded-lg"/></div>;

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-base font-bold">Weather Forecast</h1>
        <p className="text-[11px] text-muted-foreground">FLP2 Farm · Chiang Mai · 18.7°N 98.9°E · Open-Meteo</p>
      </div>

      {/* Risk alert */}
      {daily.some(d=>d.prob>=60)&&(
        <div className="rounded-lg px-3 py-2.5" style={{background:'#fff8f0',border:'0.5px solid #e8960a'}}>
          <div className="text-[11px] font-medium" style={{color:'#6b3600'}}>
            ⚠ High Rain Risk — {daily.filter(d=>d.prob>=60).map(d=>d.dayTh).join(', ')}
          </div>
          <div className="text-[10px] mt-0.5" style={{color:'#7c4500'}}>
            Rule: If Ridging not completed and rain &gt;60%, finish immediately.
          </div>
        </div>
      )}

      {/* Radar controls */}
      <div className="flex gap-2">
        {(['now','past','fc'] as RV[]).map(v=>(
          <button key={v} onClick={()=>setRv(v)}
            className={['px-3 py-1.5 rounded-full text-[11px] border',rv===v?'bg-[#0d1b36] text-[#8cb8f0] border-[#1a3a6c]':'border-border text-muted-foreground'].join(' ')}>
            {v==='now'?'ปัจจุบัน':v==='past'?'1 ชม.ที่แล้ว':'พยากรณ์ +3 ชม.'}
          </button>
        ))}
      </div>

      {/* Radar */}
      <div ref={wrapRef} className="relative rounded-lg overflow-hidden border border-border" style={{height:280}}>
        <iframe src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d150000!2d98.9!3d18.7!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e1!3m2!1sth!2sth!4v1717680000000!5m2!1sth!2sth"
          className="absolute inset-0 w-full h-full border-none opacity-70" allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade"/>
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none"/>
        <div className="absolute top-2 left-2 z-10 text-[10px] px-2 py-1 rounded-full" style={{background:'rgba(15,20,35,0.8)',color:'#e0e0e0'}}>
          {lbl[rv]}
        </div>
        <div className="absolute bottom-2 right-2 z-10 flex flex-col gap-0.5">
          {[['#7B1FA2','>50mm/hr'],['#E53935','25-50'],['#FB8C00','10-25'],['#FDD835','5-10'],['#43A047','1-5'],['#29B6F6','<1mm']].map(([c,l])=>(
            <div key={l} className="flex items-center gap-1 text-[9px]" style={{color:'#e0e0e0'}}>
              <div className="w-4 h-1.5 rounded-sm" style={{background:c}}/>{l}
            </div>
          ))}
        </div>
        <div className="absolute bottom-2 left-2 z-10 text-[9px] px-1.5 py-0.5 rounded" style={{background:'rgba(10,18,32,0.7)',color:'#c0c8d8'}}>
          FLP2 · CM · 18.7°N 98.9°E
        </div>
      </div>

      {/* Hourly */}
      <div>
        <div className="text-[11px] text-muted-foreground mb-2">⏰ รายชั่วโมง 24 ชม.</div>
        <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
          {hourly.length===0 ? <div className="py-4 text-center text-[11px] text-muted-foreground">ไม่มีข้อมูล</div>
            : hourly.map(h=>{
              const p=Math.round(h.mm/maxMm*100);
              const c=h.mm>15?'#E53935':h.mm>8?'#FB8C00':h.mm>2?'#FDD835':'#43A047';
              return <div key={h.time} className="flex items-center gap-2 px-3 py-1.5">
                <div className="w-12 font-mono text-[10px] text-muted-foreground">{h.time}</div>
                <div className="flex-1 h-2 rounded bg-muted overflow-hidden"><div className="h-full rounded" style={{width:`${p}%`,background:c}}/></div>
                <div className="w-10 text-right text-[10px]" style={{color:c}}>{h.mm.toFixed(1)}</div>
              </div>;
            })}
        </div>
      </div>

      {/* 7-day */}
      <div>
        <div className="text-[11px] text-muted-foreground mb-2">📅 พยากรณ์ 7 วัน</div>
        <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
          {daily.length===0 ? <div className="py-4 text-center text-[11px] text-muted-foreground">โหลดไม่ได้</div>
            : daily.map((d,i)=>{
              const col=CL(d.prob);const rl=getRiskLevel(d.prob);const rs=RISK_COLORS[rl];
              return <div key={d.date} className="flex items-center gap-3 px-3 py-2.5" style={i===0?{background:'rgba(0,0,0,0.03)'}:{}}>
                <div className="w-12 text-[11px] font-medium">{d.dayTh}</div>
                <div className="w-10 text-[15px] font-medium tabular-nums" style={{color:col}}>{d.prob}%</div>
                <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden"><div className="h-full rounded-full" style={{width:`${Math.min(100,d.prob)}%`,background:col}}/></div>
                <div className="w-12 text-right text-[10px] text-muted-foreground">{d.mm} mm</div>
                <div className="w-14 text-right text-[10px] tabular-nums text-muted-foreground">{d.tMax}°/{d.tMin}°</div>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{background:rs.bg,color:rs.text}}>{rl}</span>
              </div>;
            })}
        </div>
      </div>
    </div>
  );
}
