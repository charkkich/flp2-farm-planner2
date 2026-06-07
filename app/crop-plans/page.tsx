'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, type CropPlan, STATUS_COLORS, fmtDate, fmtDateShort, daysUntil, getPlanRowColor } from '@/lib/supabase';

type SortKey = 'required_ready_date' | 'planned_plant_date' | 'field_code' | 'cp_no';
const STATUS_LIST = ['Planned','Preparing','Ready','Planted','Harvested','Overdue'] as const;
const YEARS = [2026,2025,2024,2023];

export default function CropPlansPage() {
  const [plans, setPlans] = useState<CropPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(2026);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('required_ready_date');
  const [expanded, setExpanded] = useState<string|null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('crop_plans').select('*').order('required_ready_date',{nullsLast:true});
    setPlans(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    return plans
      .map(p => {
        // Auto-compute overdue
        if (!['Ready','Planted','Harvested'].includes(p.status) && p.required_ready_date) {
          const rrd = new Date(p.required_ready_date+'T00:00:00');
          if (rrd < today && p.status !== 'Overdue') return {...p, status:'Overdue' as const};
        }
        return p;
      })
      .filter(p => {
        if (p.year !== year) return false;
        if (statusFilter !== 'all' && p.status !== statusFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          return (p.cp_no||'').toLowerCase().includes(q)||(p.field_code||'').toLowerCase().includes(q)||(p.crop_name||'').toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a,b)=>{
        if (sortKey==='field_code') return (a.field_code||'').localeCompare(b.field_code||'');
        if (sortKey==='cp_no') return (a.cp_no||'').localeCompare(b.cp_no||'');
        const da = a[sortKey]||'9999-99-99', db = b[sortKey]||'9999-99-99';
        return da<db?-1:da>db?1:0;
      });
  }, [plans, year, statusFilter, search, sortKey]);

  const counts = useMemo(()=>{
    const today = new Date(); today.setHours(0,0,0,0);
    return STATUS_LIST.reduce((acc,s)=>{
      acc[s]=plans.filter(p=>{
        if (p.year!==year) return false;
        if (s==='Overdue') {
          return !['Ready','Planted','Harvested'].includes(p.status) && p.required_ready_date && new Date(p.required_ready_date+'T00:00:00')<today;
        }
        return p.status===s;
      }).length;
      return acc;
    }, {} as Record<string,number>);
  }, [plans, year]);

  if (loading) return (
    <div className="p-4 animate-pulse space-y-3">
      <div className="flex gap-2">{[...Array(6)].map((_,i)=><div key={i} className="h-7 w-20 bg-muted rounded-full"/>)}</div>
      <div className="space-y-1">{[...Array(10)].map((_,i)=><div key={i} className="h-10 bg-muted rounded"/>)}</div>
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-base font-bold">Crop Plans</h1>
          <p className="text-[11px] text-muted-foreground">{filtered.length} plans — sorted by Required Ready Date</p>
        </div>
        <div className="flex gap-1">
          {YEARS.map(y=>(
            <button key={y} onClick={()=>{setYear(y);setStatusFilter('all');setSearch('');}}
              className={['px-2.5 py-1 rounded text-[11px] font-medium border',y===year?'bg-[#155d31] text-white border-[#155d31]':'border-border text-muted-foreground'].join(' ')}>
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Status chips */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={()=>setStatusFilter('all')}
          className={['text-[10px] px-2.5 py-1 rounded-full border',statusFilter==='all'?'bg-[#e6f3ec] border-[#155d31] text-[#155d31] font-medium':'border-border text-muted-foreground'].join(' ')}>
          All ({plans.filter(p=>p.year===year).length})
        </button>
        {STATUS_LIST.map(s=>{
          const st=STATUS_COLORS[s];
          return (
            <button key={s} onClick={()=>setStatusFilter(s)}
              className={['text-[10px] px-2.5 py-1 rounded-full border font-medium transition-colors',statusFilter===s?'':'border-border text-muted-foreground'].join(' ')}
              style={statusFilter===s?{background:st.bg,borderColor:st.border,color:st.text}:{}}>
              {s} ({counts[s]||0})
            </button>
          );
        })}
      </div>

      {/* Filters + sort */}
      <div className="flex flex-wrap gap-2 items-center">
        <input type="text" placeholder="Search CP No / Field / Crop…" value={search}
          onChange={e=>setSearch(e.target.value)}
          className="h-7 px-2.5 rounded border border-border bg-card text-[11px] w-52 focus:outline-none focus:ring-1 focus:ring-[#155d31]"/>
        <div className="flex gap-1 ml-auto">
          {([['required_ready_date','Ready Date'],['planned_plant_date','Plant Date'],['field_code','Field'],['cp_no','CP No']] as [SortKey,string][]).map(([k,l])=>(
            <button key={k} onClick={()=>setSortKey(k)}
              className={['px-2 py-1 rounded text-[10px] border',sortKey===k?'bg-[#155d31] text-white border-[#155d31]':'border-border text-muted-foreground'].join(' ')}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden text-[11px]">
        <div className="hidden md:grid px-3 py-2 bg-muted/40 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wide gap-2"
          style={{gridTemplateColumns:'90px 120px 130px 110px 110px 100px 90px'}}>
          <div>Field</div><div>CP No</div><div>Crop</div><div>Plant Date</div><div>Ready Date</div><div>Days Left</div><div>Status</div>
        </div>
        <div className="divide-y divide-border">
          {filtered.length===0
            ? <div className="py-10 text-center text-muted-foreground">No plans found</div>
            : filtered.map(p=>{
              const st=STATUS_COLORS[p.status]||STATUS_COLORS['Planned'];
              const rowBg=getPlanRowColor(p);
              const dl=daysUntil(p.required_ready_date);
              const isOpen=expanded===p.id;
              return (
                <div key={p.id} style={{background:rowBg||undefined}}>
                  {/* Desktop */}
                  <div className="hidden md:grid px-3 py-2 items-center gap-2 cursor-pointer hover:opacity-90"
                    style={{gridTemplateColumns:'90px 120px 130px 110px 110px 100px 90px'}}
                    onClick={()=>setExpanded(isOpen?null:p.id)}>
                    <div className="font-mono font-semibold">{p.field_code}</div>
                    <div className="text-muted-foreground">{p.cp_no}</div>
                    <div className="truncate">{p.crop_name}</div>
                    <div>{fmtDateShort(p.planned_plant_date)}</div>
                    <div>{fmtDateShort(p.required_ready_date)}</div>
                    <div className={dl!==null&&dl<0?'text-red-500 font-semibold':dl!==null&&dl<=7?'text-amber-500 font-medium':''}>
                      {dl!==null?(dl===0?'Today':dl>0?`${dl}d left`:`${-dl}d over`):'—'}
                    </div>
                    <div><span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={{background:st.bg,color:st.text}}>{p.status}</span></div>
                  </div>
                  {/* Mobile */}
                  <div className="md:hidden px-3 py-2 cursor-pointer" onClick={()=>setExpanded(isOpen?null:p.id)}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-[12px]">{p.field_code}</span>
                      <span className="text-muted-foreground text-[10px] flex-1 truncate">{p.crop_name}</span>
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={{background:st.bg,color:st.text}}>{p.status}</span>
                    </div>
                    <div className="flex gap-3 mt-0.5 text-[10px] text-muted-foreground">
                      <span>{p.cp_no}</span>
                      {p.planned_plant_date&&<span>Plant {fmtDateShort(p.planned_plant_date)}</span>}
                      {p.required_ready_date&&<span>Ready by {fmtDateShort(p.required_ready_date)}</span>}
                    </div>
                  </div>
                  {isOpen&&(
                    <div className="px-4 py-3 border-t border-border bg-card grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-[11px]">
                      {[
                        ['CP No',p.cp_no],['Crop',p.crop_name||'—'],['Field',p.field_code||'—'],
                        ['Area',p.area_m2?`${p.area_m2.toLocaleString()} m²`:'—'],
                        ['Plant Date (Plan)',fmtDate(p.planned_plant_date)],
                        ['Plant Date (Actual)',fmtDate(p.actual_plant_date)],
                        ['Required Ready Date',fmtDate(p.required_ready_date)],
                        ['Land Prep Date',fmtDate(p.land_prep_date)],
                        ['Status',p.status],['Year',String(p.year||'—')],
                      ].map(([l,v])=>(
                        <div key={l}><div className="text-[10px] text-muted-foreground">{l}</div><div className="font-medium mt-0.5">{v}</div></div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
