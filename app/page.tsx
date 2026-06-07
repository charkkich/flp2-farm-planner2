'use client';

import { useEffect, useState, useMemo } from 'react';
import { fetchCropPlans, getPlotStatus, type CropPlan } from '@/lib/farmData';

interface DayForecast {
  date: string;
  dayTh: string;
  prob: number;
  mm: number;
  tMax: number;
  tMin: number;
  cls: 'safe' | 'warn' | 'danger';
}
const CLS_COLOR = { safe: '#155d31', warn: '#a0560a', danger: '#b52b1e' };

export default function DashboardPage() {
  const [plans, setPlans] = useState<CropPlan[]>([]);
  const [forecast, setForecast] = useState<DayForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const YEAR = 2026;

  useEffect(() => {
    Promise.all([
      fetchCropPlans(),
      fetch('https://api.open-meteo.com/v1/forecast?latitude=18.7&longitude=98.9&daily=precipitation_probability_max,precipitation_sum,temperature_2m_max,temperature_2m_min&timezone=Asia%2FBangkok&forecast_days=7')
        .then(r => r.json()).catch(() => null),
    ]).then(([csv, wx]) => {
      setPlans(csv);
      if (wx?.daily) {
        const d = wx.daily;
        const DAY_TH = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์'];
        setForecast((d.time as string[]).map((dt: string, i: number) => {
          const prob = d.precipitation_probability_max[i] ?? 0;
          const mm   = Math.round((d.precipitation_sum[i] ?? 0) * 10) / 10;
          return { date: dt, dayTh: DAY_TH[new Date(dt + 'T00:00:00').getDay()],
            prob, mm, tMax: Math.round(d.temperature_2m_max[i] ?? 0),
            tMin: Math.round(d.temperature_2m_min[i] ?? 0),
            cls: prob >= 70 ? 'danger' : prob >= 40 ? 'warn' : 'safe' };
        }));
      }
      setLoading(false);
    });
  }, []);

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const yr = useMemo(() => plans.filter(r => r.year === YEAR), [plans]);

  const kpi = useMemo(() => {
    const total = yr.length;
    const tilled = yr.filter(r => r.landPrep && new Date(r.landPrep+'T00:00:00') <= today).length;
    const readyToPlant = yr.filter(r => {
      const lp = r.landPrep ? new Date(r.landPrep+'T00:00:00') : null;
      return lp && lp <= today && !r.transplantActual && !r.removalActual;
    }).length;
    const rainRisk = yr.filter(r => {
      if (r.transplantActual || r.removalActual) return false;
      const tp = r.transplantPlan ? new Date(r.transplantPlan+'T00:00:00') : null;
      if (!tp) return false;
      const diff = Math.round((tp.getTime() - today.getTime()) / 86400000);
      if (diff < 0 || diff > 5) return false;
      return forecast.slice(0,3).some(d => d.prob >= 60);
    }).length;
    return { total, tilled, readyToPlant, rainRisk };
  }, [yr, today, forecast]);

  const alertDay = forecast.find(d => d.cls === 'danger');
  const warnDay = !alertDay ? forecast.find(d => d.cls === 'warn') : null;

  const aiRecs = useMemo(() => {
    const recs: { msg: string; type: 'ok' | 'warn' | 'stop' }[] = [];
    const rainTomorrow = forecast[1]?.prob >= 60;
    const noRainNow = !forecast.length || forecast[0].prob < 40;

    const readyNow = yr.filter(r => {
      if (r.transplantActual || r.removalActual || r.landPrep) return false;
      const tp = r.transplantPlan ? new Date(r.transplantPlan+'T00:00:00') : null;
      if (!tp) return false;
      const diff = Math.round((tp.getTime() - today.getTime()) / 86400000);
      return diff >= 2 && diff <= 10;
    });
    const readyPlot = yr.filter(r => {
      const lp = r.landPrep ? new Date(r.landPrep+'T00:00:00') : null;
      return lp && lp <= today && !r.transplantActual && !r.removalActual;
    });
    const late = yr.filter(r => {
      if (r.transplantActual || r.removalActual) return false;
      const tp = r.transplantPlan ? new Date(r.transplantPlan+'T00:00:00') : null;
      return tp && tp < today;
    });

    if (readyNow.length && noRainNow)
      recs.push({ msg: `เตรียมดินได้เลย — ดินแห้ง ฝนน้อย: ${readyNow.slice(0,5).map(r=>r.plot).join(', ')}${readyNow.length>5?' ...':''}`, type: 'ok' });
    if (readyPlot.length)
      recs.push({ msg: `ยกกร่องเสร็จ รอลงกล้า ${readyPlot.length} แปลง: ${readyPlot.slice(0,5).map(r=>r.plot).join(', ')}${readyPlot.length>5?' ...':''}`, type: 'ok' });
    if (late.length)
      recs.push({ msg: `ล่าช้า! ${late.length} แปลงเลยวันปลูกแล้ว ควรเร่งดำเนินการ: ${late.slice(0,4).map(r=>r.plot).join(', ')}`, type: 'warn' });
    if (rainTomorrow)
      recs.push({ msg: `คาดฝนพรุ่งนี้ (${forecast[1]?.prob}%) — ไม่ควรเริ่มงานในแปลงที่ยังไม่ยกกร่อง`, type: 'stop' });
    if (!recs.length)
      recs.push({ msg: 'ทุกแปลงอยู่ในแผนปกติ ไม่มีเหตุเร่งด่วน', type: 'ok' });
    return recs;
  }, [yr, today, forecast]);

  if (loading) return (
    <div className="p-4 animate-pulse space-y-3">
      <div className="grid grid-cols-4 gap-2.5">{[...Array(4)].map((_,i)=><div key={i} className="h-16 bg-muted rounded-lg"/>)}</div>
      <div className="h-20 bg-muted rounded-lg"/><div className="flex gap-2 overflow-hidden">{[...Array(7)].map((_,i)=><div key={i} className="h-28 w-24 flex-shrink-0 bg-muted rounded-lg"/>)}</div>
      <div className="h-28 bg-muted rounded-lg"/>
    </div>
  );

  return (
    <div className="p-3 lg:p-4 space-y-4 max-w-3xl mx-auto">

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { v: kpi.total,        l: 'แปลงทั้งหมด', c: 'text-foreground' },
          { v: kpi.tilled,       l: 'ยกกร่องแล้ว', c: 'text-[#155d31]' },
          { v: kpi.readyToPlant, l: 'พร้อมปลูก',   c: 'text-[#155d31]' },
          { v: kpi.rainRisk,     l: 'เสี่ยงฝน',    c: 'text-[#b52b1e]' },
        ].map(k => (
          <div key={k.l} className="bg-card border border-border rounded-lg px-3 py-2.5 text-center">
            <div className={`text-2xl font-medium ${k.c}`}>{k.v}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{k.l}</div>
          </div>
        ))}
      </div>

      {/* Alert */}
      {(alertDay || warnDay) && (() => {
        const d = alertDay || warnDay!;
        const isAlert = !!alertDay;
        return (
          <div className="rounded-lg px-3 py-2.5" style={{ background:'#fff8f0', border:'0.5px solid #e8960a' }}>
            <div className="text-[11px] font-medium flex items-center gap-1.5 mb-1" style={{ color:'#6b3600' }}>
              <span>⚠</span> {isAlert ? 'แจ้งเตือน: ' : 'เตือน: '}ฝน{isAlert?'หนัก':'ปานกลาง'} {d.dayTh}นี้ ({d.prob}% / {d.mm} mm)
            </div>
            <div className="text-[10px]" style={{ color:'#7c4500', lineHeight:1.6 }}>
              {isAlert ? `แนะนำ เร่งเตรียมดินแปลงที่ค้างอยู่ก่อน ${d.dayTh}นี้` : `ติดตามสถานการณ์อย่างใกล้ชิด`}
            </div>
          </div>
        );
      })()}

      {/* 7-day weather */}
      <div>
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mb-2">🌧 พยากรณ์ฝน 7 วัน</div>
        {forecast.length === 0
          ? <div className="text-xs text-muted-foreground py-3 text-center">โหลดข้อมูลอากาศไม่ได้</div>
          : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {forecast.map(d => {
              const col = CLS_COLOR[d.cls];
              return (
                <div key={d.date} className="flex-shrink-0 w-[86px] rounded-lg px-2 py-2.5"
                  style={{ background:'var(--card)', border:`0.5px solid ${col}33`, borderTop:`3px solid ${col}` }}>
                  <div className="text-[10px] text-muted-foreground">{d.dayTh}</div>
                  <div className="text-[19px] font-medium mt-0.5" style={{ color: col }}>{d.prob}%</div>
                  <div className="text-[10px] text-muted-foreground">{d.mm} mm</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">{d.tMax}°/{d.tMin}°</div>
                  <div className="h-1 rounded-full mt-1.5 overflow-hidden bg-border">
                    <div className="h-full rounded-full" style={{ width:`${Math.min(100,d.prob)}%`, background:col }}/>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI recommendations */}
      <div>
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mb-2">🤖 AI แนะนำวันนี้</div>
        <div className="rounded-lg border border-border overflow-hidden bg-card divide-y divide-border">
          {aiRecs.map((rec, i) => {
            const ico = rec.type==='ok'?'✓':rec.type==='warn'?'!':'✕';
            const bg  = rec.type==='ok'?'#e6f3ec':rec.type==='warn'?'#fff3e0':'#fdecea';
            const col = rec.type==='ok'?'#155d31':rec.type==='warn'?'#a0560a':'#b52b1e';
            return (
              <div key={i} className="flex items-start gap-2.5 px-3 py-2.5">
                <div className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5"
                  style={{ background:bg, color:col }}>{ico}</div>
                <div className="text-[11px] leading-relaxed">{rec.msg}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status breakdown */}
      <div>
        <div className="text-[11px] text-muted-foreground mb-2">สรุปสถานะแปลงปี {YEAR}</div>
        <div className="rounded-lg border border-border overflow-hidden bg-card divide-y divide-border">
          {[
            { l:'เสร็จสิ้น (เก็บเกี่ยวแล้ว)', count: yr.filter(r=>!!r.removalActual).length, c:'#64748b' },
            { l:'ปลูกแล้ว รออยู่ในแปลง',        count: yr.filter(r=>r.transplantActual&&!r.removalActual).length, c:'#16a34a' },
            { l:'เตรียมดินแล้ว รอปลูก',          count: yr.filter(r=>{ const lp=r.landPrep?new Date(r.landPrep+'T00:00:00'):null; return lp&&lp<=today&&!r.transplantActual&&!r.removalActual; }).length, c:'#d97706' },
            { l:'รอเตรียมดิน (มีกำหนดวัน)',       count: yr.filter(r=>{ const lp=r.landPrep?new Date(r.landPrep+'T00:00:00'):null; return lp&&lp>today&&!r.transplantActual&&!r.removalActual; }).length, c:'#0284c7' },
            { l:'ยังไม่กำหนดวันไถ',               count: yr.filter(r=>!r.landPrep&&!r.transplantActual&&!r.removalActual).length, c:'#8b5cf6' },
          ].map(s => {
            const pct = kpi.total > 0 ? Math.round(s.count/kpi.total*100) : 0;
            return (
              <div key={s.l} className="px-3 py-2 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background:s.c }}/>
                <div className="flex-1 text-[11px]">{s.l}</div>
                <div className="text-[11px] font-medium tabular-nums w-6 text-right">{s.count}</div>
                <div className="w-20 h-1.5 rounded-full overflow-hidden bg-border">
                  <div className="h-full rounded-full" style={{ width:`${pct}%`, background:s.c }}/>
                </div>
                <div className="text-[10px] text-muted-foreground w-7 text-right tabular-nums">{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
