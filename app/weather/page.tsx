'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

interface HourlyData { time: string; mm: number }
interface DayData { date: string; dayTh: string; prob: number; mm: number; tMax: number; tMin: number; cls: 'safe'|'warn'|'danger' }

const CLS_COLOR = { safe:'#155d31', warn:'#a0560a', danger:'#b52b1e' };
const DAY_TH = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์'];

type RadarView = 'now' | 'past' | 'fc';

export default function WeatherPage() {
  const [daily, setDaily] = useState<DayData[]>([]);
  const [hourly, setHourly] = useState<HourlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [radarV, setRadarV] = useState<RadarView>('now');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const radarWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const now = new Date();
    const tz = 'Asia%2FBangkok';
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=18.7&longitude=98.9&daily=precipitation_probability_max,precipitation_sum,temperature_2m_max,temperature_2m_min&hourly=precipitation&timezone=${tz}&forecast_days=7`)
      .then(r=>r.json())
      .then(wx => {
        if (wx?.daily) {
          const d = wx.daily;
          setDaily((d.time as string[]).map((dt:string,i:number)=>{
            const prob = d.precipitation_probability_max[i]??0;
            const mm   = Math.round((d.precipitation_sum[i]??0)*10)/10;
            return { date:dt, dayTh:DAY_TH[new Date(dt+'T00:00:00').getDay()],
              prob, mm, tMax:Math.round(d.temperature_2m_max[i]??0), tMin:Math.round(d.temperature_2m_min[i]??0),
              cls: prob>=70?'danger':prob>=40?'warn':'safe' };
          }));
        }
        if (wx?.hourly) {
          const h = wx.hourly;
          const startH = now.getHours();
          // Show next 24 hours
          const items: HourlyData[] = [];
          for (let i = 0; i < h.time.length && items.length < 24; i++) {
            const t = new Date(h.time[i]);
            if (t >= now) {
              items.push({ time: h.time[i].slice(11,16), mm: Math.round((h.precipitation[i]??0)*10)/10 });
            }
          }
          setHourly(items);
        }
      })
      .catch(()=>{})
      .finally(()=>setLoading(false));
  }, []);

  const drawRadar = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = radarWrapRef.current;
    if (!canvas || !wrap) return;
    canvas.width = wrap.offsetWidth || 400;
    canvas.height = wrap.offsetHeight || 300;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);

    // Overlay on satellite map
    ctx.fillStyle = 'rgba(5,12,25,0.30)';
    ctx.fillRect(0,0,W,H);

    // Grid
    ctx.strokeStyle = 'rgba(100,140,200,0.10)'; ctx.lineWidth = 0.5;
    for (let x=0; x<W; x+=W/10) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y=0; y<H; y+=H/8) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    [0.2,0.38,0.56].forEach(r=>{
      ctx.beginPath(); ctx.arc(W/2,H/2,r*Math.min(W,H),0,Math.PI*2); ctx.stroke();
    });

    function rainCell(cx:number,cy:number,rx:number,ry:number,intensity:number,alpha:number) {
      const RAMP: [number,number,number][] = [[41,182,246],[67,160,71],[253,216,53],[251,140,0],[229,57,53],[123,31,162]];
      const idx = Math.min(5,Math.floor(intensity*5.9));
      const [r,g,b] = RAMP[idx];
      const g2 = ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(rx,ry));
      g2.addColorStop(0,`rgba(${r},${g},${b},${alpha})`);
      g2.addColorStop(0.55,`rgba(${r},${g},${b},${alpha*0.5})`);
      g2.addColorStop(1,`rgba(${r},${g},${b},0)`);
      ctx.save();
      const maxR = Math.max(rx,ry);
      ctx.scale(rx/maxR,ry/maxR);
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.arc(cx*(maxR/rx),cy*(maxR/ry),maxR,0,Math.PI*2);
      ctx.fill(); ctx.restore();
    }

    if (radarV==='now') {
      rainCell(W*.66,H*.27,W*.20,H*.17,0.72,0.88);
      rainCell(W*.71,H*.38,W*.11,H*.09,0.52,0.75);
      rainCell(W*.28,H*.72,W*.13,H*.11,0.38,0.65);
      rainCell(W*.87,H*.52,W*.09,H*.08,0.82,0.78);
    } else if (radarV==='past') {
      rainCell(W*.80,H*.20,W*.15,H*.13,0.62,0.82);
      rainCell(W*.50,H*.62,W*.11,H*.09,0.42,0.68);
      rainCell(W*.18,H*.78,W*.10,H*.08,0.32,0.58);
    } else {
      rainCell(W*.52,H*.42,W*.24,H*.20,0.78,0.92);
      rainCell(W*.57,H*.52,W*.15,H*.13,0.92,0.88);
      rainCell(W*.36,H*.67,W*.16,H*.14,0.55,0.72);
      rainCell(W*.76,H*.62,W*.11,H*.09,0.68,0.78);
    }

    // Range rings label
    ctx.fillStyle='rgba(160,190,230,0.5)'; ctx.font='9px sans-serif'; ctx.textAlign='left';
    ctx.fillText('50km',W/2+0.2*Math.min(W,H)+3,H/2);
    ctx.fillText('100km',W/2+0.38*Math.min(W,H)+3,H/2);

    // Farm marker
    ctx.beginPath(); ctx.arc(W/2,H/2,6,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,0.95)'; ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.arc(W/2,H/2,15,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.font='bold 10px sans-serif'; ctx.textAlign='center';
    ctx.fillText('FLP2',W/2,H/2-20);

    // Compass
    const dPos:[[number,number]][] = [[W/2,13],[W-9,H/2],[W/2,H-5],[9,H/2]] as any;
    ctx.fillStyle='rgba(200,220,255,0.5)'; ctx.font='10px sans-serif';
    ['N','E','S','W'].forEach((l,i)=>{ ctx.textAlign='center'; ctx.fillText(l,dPos[i][0],dPos[i][1]); });
  }, [radarV]);

  useEffect(() => { drawRadar(); }, [drawRadar]);

  const nowStr = new Date().toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'});
  const lblMap: Record<RadarView,string> = {
    now: `${nowStr} — ปัจจุบัน`,
    past: `${nowStr} — 1 ชม.ที่แล้ว`,
    fc: `${nowStr} — พยากรณ์ +3 ชม.`,
  };

  const hasRain = daily.some(d=>d.cls==='danger');
  const maxMm = Math.max(...hourly.map(h=>h.mm), 1);

  if (loading) return (
    <div className="p-4 animate-pulse space-y-3">
      <div className="flex gap-2">{[...Array(3)].map((_,i)=><div key={i} className="h-8 w-24 bg-muted rounded-full"/>)}</div>
      <div className="h-64 bg-muted rounded-lg"/>
      <div className="space-y-1">{[...Array(8)].map((_,i)=><div key={i} className="h-8 bg-muted rounded"/>)}</div>
    </div>
  );

  return (
    <div className="p-3 lg:p-4 space-y-4 max-w-2xl mx-auto">

      {/* Radar controls */}
      <div className="flex gap-2">
        {(['now','past','fc'] as RadarView[]).map(v => (
          <button key={v} onClick={()=>setRadarV(v)}
            className={['px-3 py-1.5 rounded-full text-[11px] border transition-colors',
              radarV===v?'bg-[#0d1b36] text-[#8cb8f0] border-[#1a3a6c]':'border-border text-muted-foreground hover:text-foreground'].join(' ')}>
            {v==='now'?'ปัจจุบัน':v==='past'?'1 ชม.ที่แล้ว':'พยากรณ์ +3 ชม.'}
          </button>
        ))}
      </div>

      {/* Radar map */}
      <div ref={radarWrapRef} className="relative rounded-lg overflow-hidden border border-border" style={{ height:300 }}>
        <iframe
          src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d150000!2d98.9!3d18.7!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e1!3m2!1sth!2sth!4v1717680000000!5m2!1sth!2sth"
          className="absolute inset-0 w-full h-full border-none opacity-70"
          allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade"
          title="แผนที่ดาวเทียมพื้นหลัง radar"
        />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none"/>

        {/* Time label */}
        <div className="absolute top-2 left-2 z-10 text-[10px] px-2 py-1 rounded-full"
          style={{ background:'rgba(15,20,35,0.8)', color:'#e0e0e0', backdropFilter:'blur(4px)' }}>
          {lblMap[radarV]}
        </div>

        {/* Rain alert badge */}
        {hasRain && (
          <div className="absolute top-2 right-2 z-10 text-[10px] px-2 py-1 rounded-md"
            style={{ background:'rgba(160,60,10,0.88)', color:'#fff' }}>
            ⚠ ฝนเข้าฟาร์ม
          </div>
        )}

        {/* Scale */}
        <div className="absolute bottom-2 right-2 z-10 flex flex-col gap-0.5">
          {[['#7B1FA2','>50mm/hr'],['#E53935','25–50'],['#FB8C00','10–25'],['#FDD835','5–10'],['#43A047','1–5'],['#29B6F6','<1mm']].map(([c,l])=>(
            <div key={l} className="flex items-center gap-1 text-[9px]" style={{ color:'#e0e0e0' }}>
              <div className="w-4 h-1.5 rounded-sm" style={{ background:c }}/>
              {l}
            </div>
          ))}
        </div>

        {/* Coords */}
        <div className="absolute bottom-2 left-2 z-10 text-[9px] px-1.5 py-0.5 rounded"
          style={{ background:'rgba(10,18,32,0.7)', color:'#c0c8d8' }}>
          FLP2 · Chiang Mai · 18.7°N 98.9°E
        </div>
      </div>

      {/* Hourly (24h) */}
      <div>
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mb-2">⏰ รายชั่วโมง 24 ชม.</div>
        <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
          {hourly.length === 0
            ? <div className="py-6 text-center text-[11px] text-muted-foreground">ไม่มีข้อมูล</div>
            : hourly.map(h => {
              const p = Math.round(h.mm/maxMm*100);
              const c = h.mm>15?'#E53935':h.mm>8?'#FB8C00':h.mm>2?'#FDD835':'#43A047';
              return (
                <div key={h.time} className="flex items-center gap-2 px-3 py-1.5">
                  <div className="w-12 font-mono text-[10px] text-muted-foreground">{h.time}</div>
                  <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
                    <div className="h-full rounded" style={{ width:`${p}%`, background:c }}/>
                  </div>
                  <div className="w-10 text-right text-[10px]" style={{ color:c }}>{h.mm.toFixed(1)}</div>
                </div>
              );
            })}
        </div>
      </div>

      {/* 7-day table */}
      <div>
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mb-2">📅 พยากรณ์ 7 วัน</div>
        <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
          {daily.length === 0
            ? <div className="py-6 text-center text-[11px] text-muted-foreground">โหลดข้อมูลไม่ได้</div>
            : daily.map((d,i) => {
              const col = CLS_COLOR[d.cls];
              const p = Math.min(100, d.prob);
              return (
                <div key={d.date} className="flex items-center gap-3 px-3 py-2.5"
                  style={i===0?{background:'rgba(0,0,0,0.03)'}:{}}>
                  <div className="w-12 text-[11px] font-medium" style={{ color: i===0?col:undefined }}>{d.dayTh}</div>
                  <div className="w-10 text-[15px] font-medium tabular-nums" style={{ color:col }}>{d.prob}%</div>
                  <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                    <div className="h-full rounded-full" style={{ width:`${p}%`, background:col }}/>
                  </div>
                  <div className="w-12 text-right text-[10px] text-muted-foreground">{d.mm} mm</div>
                  <div className="w-14 text-right text-[10px] text-muted-foreground tabular-nums">{d.tMax}°/{d.tMin}°</div>
                </div>
              );
            })}
        </div>
      </div>

    </div>
  );
}
