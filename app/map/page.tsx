'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase, type CropPlan, type Field, STATUS_COLORS } from '@/lib/supabase';

// Zone prefixes → approximate offsets from farm center (18.992, 98.972)
const ZONE_CONFIG: Record<string, { latOff: number; lngOff: number; color: string; label: string }> = {
  T:    { latOff:  0.012, lngOff: -0.030, color: '#0369a1', label: 'T Zone' },
  SS:   { latOff:  0.008, lngOff: -0.015, color: '#7c3aed', label: 'SS Zone' },
  S:    { latOff: -0.005, lngOff:  0.005, color: '#15803d', label: 'S Zone' },
  W:    { latOff:  0.002, lngOff:  0.020, color: '#d97706', label: 'W Zone' },
  E:    { latOff: -0.010, lngOff:  0.030, color: '#dc2626', label: 'E Zone' },
  B:    { latOff:  0.018, lngOff: -0.005, color: '#0891b2', label: 'B Zone' },
  P:    { latOff: -0.015, lngOff: -0.020, color: '#9333ea', label: 'P Zone' },
  NH:   { latOff: -0.008, lngOff:  0.015, color: '#16a34a', label: 'NH Zone' },
  A:    { latOff:  0.020, lngOff:  0.010, color: '#ea580c', label: 'A Zone' },
  C:    { latOff: -0.020, lngOff: -0.010, color: '#0284c7', label: 'C Zone' },
  D:    { latOff: -0.012, lngOff: -0.025, color: '#ca8a04', label: 'D Zone' },
  Mongol:{ latOff: 0.025, lngOff:  0.025, color: '#be185d', label: 'Mongol' },
};

function getZone(fieldCode: string): string {
  for (const z of Object.keys(ZONE_CONFIG)) {
    if (fieldCode.startsWith(z)) return z;
  }
  return 'T';
}

export default function MapPage() {
  const [fields, setFields] = useState<Field[]>([]);
  const [plans, setPlans] = useState<CropPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedZone, setSelectedZone] = useState<string|null>(null);
  const [selectedField, setSelectedField] = useState<Field|null>(null);
  const [year] = useState(2026);
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from('fields').select('*').order('field_code'),
      supabase.from('crop_plans').select('*').order('required_ready_date', { ascending: true, nullsFirst: false }),
    ]).then(([{data:f},{data:cp}]) => {
      setFields(f||[]);
      setPlans(cp||[]);
      setLoading(false);
    });
  }, []);

  // Field → current status (2026 plan)
  const fieldStatus = useMemo(() => {
    const map: Record<string,{status:string;crop:string;cpNo:string;plan:CropPlan|null}> = {};
    const today = new Date(); today.setHours(0,0,0,0);
    fields.forEach(f => {
      const fp = plans
        .filter(p=>p.field_code===f.field_code && p.year===year)
        .sort((a,b)=>(a.required_ready_date||'9999').localeCompare(b.required_ready_date||'9999'));
      if (fp.length === 0) {
        map[f.field_code] = {status:'Empty',crop:'—',cpNo:'—',plan:null};
      } else {
        const active = fp.find(p=>!['Harvested'].includes(p.status)) || fp[fp.length-1];
        let status = active.status;
        if (!['Ready','Planted','Harvested'].includes(status) && active.required_ready_date) {
          if (new Date(active.required_ready_date+'T00:00:00') < today) status = 'Overdue';
        }
        map[f.field_code] = {status,crop:active.crop_name||'—',cpNo:active.cp_no||'—',plan:active};
      }
    });
    return map;
  }, [fields, plans, year]);

  // Init Leaflet
  useEffect(() => {
    if (loading || !mapRef.current) return;
    if (leafletMapRef.current) return;

    import('leaflet').then(L => {
      if (!mapRef.current) return;
      // Fix marker icon
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current!, {zoomControl:true}).setView([18.992, 98.972], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
        attribution:'© OpenStreetMap',maxZoom:19,
      }).addTo(map);

      leafletMapRef.current = map;

      // Add farm center marker
      L.marker([18.992, 98.972], {
        icon: L.divIcon({
          html:`<div style="background:#155d31;color:white;padding:3px 6px;border-radius:4px;font-size:10px;font-weight:bold;white-space:nowrap;box-shadow:0 2px 4px rgba(0,0,0,0.3)">FLP2 Farm</div>`,
          className:'', iconAnchor:[30,10],
        }),
      }).addTo(map);

      // Draw field markers by zone
      fields.forEach(f => {
        const zone = getZone(f.field_code);
        const zc = ZONE_CONFIG[zone] || ZONE_CONFIG['T'];
        const st = fieldStatus[f.field_code] || {status:'Empty',crop:'—',cpNo:'—',plan:null};
        const sColor = st.status === 'Empty' ? '#64748b'
          : st.status === 'Overdue' ? '#dc2626'
          : (STATUS_COLORS as any)[st.status]?.text || '#64748b';

        // Jitter within zone
        const seed = f.field_code.charCodeAt(0)*13 + (f.field_code.charCodeAt(1)||0)*7;
        const jLat = ((seed * 17) % 100 - 50) * 0.0001;
        const jLng = ((seed * 31) % 100 - 50) * 0.0001;
        const lat = 18.992 + zc.latOff + jLat;
        const lng = 98.972 + zc.lngOff + jLng;

        const marker = L.circleMarker([lat, lng], {
          radius: Math.max(4, Math.min(9, Math.sqrt((f.area_m2||500)/150))),
          fillColor: sColor,
          color: '#fff',
          weight: 1.5,
          opacity: 1,
          fillOpacity: 0.85,
        }).addTo(map);

        marker.bindTooltip(
          `<b>${f.field_code}</b><br/>${st.crop}<br/>${st.status}<br/>${f.area_m2?.toLocaleString()} m²`,
          {permanent:false,direction:'top',className:'text-[10px]'}
        );
        marker.on('click', () => setSelectedField(f));
        (marker as any)._fieldCode = f.field_code;
        markersRef.current.push(marker);
      });
    });
  }, [loading, fields, fieldStatus]);

  // Zone counts
  const zoneCounts = useMemo(() => {
    const z: Record<string,{total:number;active:number;overdue:number}> = {};
    fields.forEach(f => {
      const zone = getZone(f.field_code);
      if (!z[zone]) z[zone] = {total:0,active:0,overdue:0};
      z[zone].total++;
      const st = fieldStatus[f.field_code];
      if (st && !['Empty','Harvested'].includes(st.status)) z[zone].active++;
      if (st?.status === 'Overdue') z[zone].overdue++;
    });
    return z;
  }, [fields, fieldStatus]);

  const filtered = useMemo(() => {
    return fields.filter(f => {
      if (selectedZone && getZone(f.field_code) !== selectedZone) return false;
      if (search && !f.field_code.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [fields, search, selectedZone]);

  const selectedPlan = selectedField ? plans.find(p=>p.field_code===selectedField.field_code&&p.year===year) || null : null;

  if (loading) return (
    <div className="p-4 flex items-center justify-center h-64">
      <div className="text-muted-foreground text-sm animate-pulse">Loading map…</div>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-88px)] overflow-hidden">
      {/* Top bar */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-border bg-card flex items-center gap-2 flex-wrap">
        <div className="text-[12px] font-semibold">🗺 Field Map — FLP2</div>
        <div className="text-[10px] text-muted-foreground">{fields.length} fields</div>
        <input type="text" placeholder="Search field…" value={search} onChange={e=>setSearch(e.target.value)}
          className="h-6 px-2 rounded border border-border bg-background text-[11px] w-28 focus:outline-none"/>
        <div className="flex gap-1 flex-wrap">
          <button onClick={()=>setSelectedZone(null)}
            className={['px-2 py-0.5 rounded text-[10px] border',!selectedZone?'bg-[#155d31] text-white border-[#155d31]':'border-border text-muted-foreground'].join(' ')}>
            All
          </button>
          {Object.entries(ZONE_CONFIG).map(([z,c])=>zoneCounts[z]&&(
            <button key={z} onClick={()=>setSelectedZone(z===selectedZone?null:z)}
              className={['px-2 py-0.5 rounded text-[10px] border',selectedZone===z?'text-white border-transparent':'border-border text-muted-foreground'].join(' ')}
              style={selectedZone===z?{background:c.color,borderColor:c.color}:{}}>
              {z} ({zoneCounts[z]?.total||0})
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Leaflet Map */}
        <div className="flex-1 relative">
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
          <div ref={mapRef} className="w-full h-full"/>

          {/* Legend overlay */}
          <div className="absolute bottom-4 left-2 z-[1000] bg-card/90 border border-border rounded-lg p-2 text-[9px] space-y-0.5">
            {[
              {c:'#dc2626',l:'Overdue'},
              {c:'#f59e0b',l:'At Risk'},
              {c:'#0369a1',l:'Preparing'},
              {c:'#15803d',l:'Ready/Planned'},
              {c:'#064e3b',l:'Planted'},
              {c:'#64748b',l:'Empty'},
            ].map(({c,l})=>(
              <div key={l} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full border-2 border-white" style={{background:c}}/>
                <span className="text-muted-foreground">{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-64 flex-shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
          {/* Selected field detail */}
          {selectedField && (
            <div className="p-3 border-b border-border bg-muted/30 text-[11px] space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="font-mono font-bold text-[13px]">{selectedField.field_code}</div>
                <button onClick={()=>setSelectedField(null)} className="text-muted-foreground hover:text-foreground text-[13px]">✕</button>
              </div>
              {[
                ['Area', `${selectedField.area_m2?.toLocaleString()||'—'} m²`],
                ['Zone', getZone(selectedField.field_code)],
                ['Status {year}', fieldStatus[selectedField.field_code]?.status||'—'],
                ['Crop', fieldStatus[selectedField.field_code]?.crop||'—'],
                ['CP No', fieldStatus[selectedField.field_code]?.cpNo||'—'],
              ].map(([l,v])=>(
                <div key={l} className="flex justify-between">
                  <span className="text-muted-foreground">{l}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
            </div>
          )}

          {/* Field list */}
          <div className="text-[10px] text-muted-foreground px-2 py-1 border-b border-border bg-muted/20">
            {filtered.length} fields{selectedZone?` · Zone ${selectedZone}`:''}
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border text-[11px]">
            {filtered.map(f => {
              const st = fieldStatus[f.field_code] || {status:'Empty',crop:'—'};
              const sColor = st.status === 'Empty' ? '#64748b'
                : st.status === 'Overdue' ? '#dc2626'
                : (STATUS_COLORS as any)[st.status]?.text || '#64748b';
              return (
                <div key={f.id}
                  className={['flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-muted/30',
                    selectedField?.id===f.id?'bg-muted/50':''].join(' ')}
                  onClick={()=>setSelectedField(f)}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:sColor}}/>
                  <div className="font-mono font-medium w-16 flex-shrink-0">{f.field_code}</div>
                  <div className="flex-1 truncate text-muted-foreground text-[10px]">{st.crop}</div>
                  <div className="text-[9px] flex-shrink-0" style={{color:sColor}}>{st.status}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
