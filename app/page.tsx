'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, type CropPlan, type WeatherForecast, STATUS_COLORS, RISK_COLORS, getRiskLevel, fmtDateShort, daysUntil } from '@/lib/supabase';

interface DashKPI {
  total: number;
  preparing: number;
  ready: number;
  overdue: number;
  highRisk: number;
  upcomingCount: number;
}

interface DayForecast { date: string; dayTh: string; prob: number; mm: number; tMax: number; tMin: number }
const DAY_TH = ['อา','จ','อ','พ','พฤ','ศ','ส'];

export default function DashboardPage() {
  const [kpi, setKpi] = useState<DashKPI>({ total:0, preparing:0, ready:0, overdue:0, highRisk:0, upcomingCount:0 });
  const [upcoming, setUpcoming] = useState<CropPlan[]>([]);
  const [forecast, setForecast] = useState<DayForecast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split('T')[0];
      const plus14 = new Date(Date.now()+14*86400000).toISOString().split('T')[0];

      const [{ data: plans }, wxRes] = await Promise.all([
        supabase.from('crop_plans').select('*').neq('status','Harvested').order('required_ready_date'),
        fetch('https://api.open-meteo.com/v1/forecast?latitude=18.7&longitude=98.9&daily=precipitation_probability_max,precipitation_sum,temperature_2m_max,temperature_2m_min&timezone=Asia%2FBangkok&forecast_days=7').then(r=>r.json()).catch(()=>null),
      ]);

      const cp = (plans || []) as CropPlan[];
      const now = new Date(); now.setHours(0,0,0,0);

      const overduePlans = cp.filter(p => {
        if (!p.required_ready_date || ['Ready','Planted','Harvested'].includes(p.status)) return false;
        return new Date(p.required_ready_date+'T00:00:00') < now;
      });

      let highRiskCount = 0;
      let wxDays: DayForecast[] = [];
      if (wxRes?.daily) {
        const d = wxRes.daily;
        wxDays = (d.time as string[]).map((dt:string,i:number)=>({
          date:dt, dayTh:DAY_TH[new Date(dt+'T00:00:00').getDay()],
          prob:d.precipitation_probability_max[i]??0, mm:Math.round((d.precipitation_sum[i]??0)*10)/10,
          tMax:Math.round(d.temperature_2m_max[i]??0), tMin:Math.round(d.temperature_2m_min[i]??0),
        }));
        const highRainDays = wxDays.slice(0,3).filter(d=>d.prob>=60).length;
        if (highRainDays > 0) {
          highRiskCount = cp.filter(p => {
            if (['Ready','Planted','Harvested'].includes(p.status)) return false;
            if (!p.planned_plant_date) return false;
            const dl = daysUntil(p.planned_plant_date);
            return dl !== null && dl >= 0 && dl <= 7;
          }).length;
        }
        setForecast(wxDays);
      }

      const upcomingPlans = cp.filter(p => p.planned_plant_date && p.planned_plant_date >= today && p.planned_plant_date <= plus14)
        .sort((a,b)=>(a.planned_plant_date||'').localeCompare(b.planned_plant_date||''))
        .slice(0,8);

      setKpi({
        total: cp.length,
        preparing: cp.filter(p=>p.status==='Preparing').length,
        ready: cp.filter(p=>p.status==='Ready').length,
        overdue: overduePlans.length,
        highRisk: highRiskCount,
        upcomingCount: cp.filter(p=>p.planned_plant_date&&p.planned_plant_date>=today&&p.planned_plant_date<=plus14).length,
      });
      setUpcoming(upcomingPlans);
      setLoading(false);
    }
    load();
  }, []);

  const CLS = (prob:number) => prob>=70?'#b52b1e':prob>=40?'#a0560a':'#155d31';

  if (loading) return (
    <div className="p-4 animate-pulse space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">{[...Array(5)].map((_,i)=><div key={i} className="h-16 bg-muted rounded-lg"/>)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><div className="h-48 bg-muted rounded-lg"/><div className="h-48 bg-muted rounded-lg"/></div>
    </div>
  );

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold">Executive Dashboard</h1>
          <p className="text-[11px] text-muted-foreground">Farm Lert Phan 2 — FOMS v1.0</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { l:'Total Plans',     v:kpi.total,         c:'text-foreground',  href:'/crop-plans' },
          { l:'Preparing',       v:kpi.preparing,      c:'text-sky-500',     href:'/planning' },
          { l:'Ready',           v:kpi.ready,          c:'text-[#155d31]',   href:'/planning?status=Ready' },
          { l:'Overdue',         v:kpi.overdue,        c:'text-red-500',     href:'/planning?status=Overdue' },
          { l:'High Rain Risk',  v:kpi.highRisk,       c:'text-orange-500',  href:'/weather' },
        ].map(k=>(
          <Link key={k.l} href={k.href}
            className="bg-card border border-border rounded-lg px-3 py-2.5 text-center hover:bg-muted/30 transition-colors">
            <div className={`text-2xl font-semibold ${k.c}`}>{k.v}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{k.l}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming plantings 14 days */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <div className="text-[12px] font-semibold">🌱 Upcoming Plantings (14 days) — {kpi.upcomingCount} plans</div>
            <Link href="/planning" className="text-[10px] text-[#155d31]">ดูทั้งหมด →</Link>
          </div>
          {upcoming.length === 0
            ? <div className="py-8 text-center text-[11px] text-muted-foreground">ไม่มีแผนปลูกใน 14 วัน</div>
            : (
            <div className="divide-y divide-border">
              {upcoming.map(p=>{
                const dl = daysUntil(p.planned_plant_date);
                const st = STATUS_COLORS[p.status];
                return (
                  <div key={p.id} className="flex items-center gap-2 px-3 py-2">
                    <span className="font-mono text-[11px] font-medium w-20">{p.field_code}</span>
                    <span className="text-[10px] text-muted-foreground flex-1 truncate">{p.crop_name}</span>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px]" style={{color:st.text,background:st.bg}}>{p.status}</span>
                    <span className="text-[10px] font-mono tabular-nums w-16 text-right text-muted-foreground">
                      {dl!==null ? (dl===0?'วันนี้':dl>0?`อีก ${dl}d`:`เกิน ${-dl}d`) : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 7-day rain */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <div className="text-[12px] font-semibold">🌧 Rain Forecast 7 Days</div>
          </div>
          {forecast.length === 0
            ? <div className="py-8 text-center text-[11px] text-muted-foreground">โหลดข้อมูลอากาศไม่ได้</div>
            : (
            <div className="p-3 flex gap-2 overflow-x-auto">
              {forecast.map(d=>{
                const col = CLS(d.prob);
                return (
                  <div key={d.date} className="flex-shrink-0 w-[78px] rounded-lg px-2 py-2"
                    style={{border:`1px solid ${col}33`, borderTop:`3px solid ${col}`, background:'var(--card)'}}>
                    <div className="text-[9px] text-muted-foreground">{d.dayTh}</div>
                    <div className="text-[17px] font-medium" style={{color:col}}>{d.prob}%</div>
                    <div className="text-[9px] text-muted-foreground">{d.mm}mm</div>
                    <div className="text-[9px] text-muted-foreground">{d.tMax}°/{d.tMin}°</div>
                    {d.prob>=60&&<div className="text-[8px] font-medium mt-0.5" style={{color:'#b52b1e'}}>⚠ HIGH</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Preparation status summary */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-3 py-2 border-b border-border">
          <div className="text-[12px] font-semibold">📊 Preparation Status Summary</div>
        </div>
        <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {(['Planned','Preparing','Ready','Planted','Overdue'] as const).map(s=>{
            const st = STATUS_COLORS[s];
            return (
              <Link key={s} href={`/planning?status=${s}`}
                className="rounded-lg border px-3 py-2 text-center hover:opacity-80 transition-opacity"
                style={{background:st.bg,borderColor:st.border}}>
                <div className="text-lg font-semibold" style={{color:st.text}}>
                  {s==='Planned'?kpi.total-kpi.preparing-kpi.ready-(kpi.overdue)
                    :s==='Preparing'?kpi.preparing
                    :s==='Ready'?kpi.ready
                    :s==='Planted'?'—'
                    :kpi.overdue}
                </div>
                <div className="text-[10px] mt-0.5" style={{color:st.text}}>{s}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
