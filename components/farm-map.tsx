'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, type Field, type FieldStatus, FIELD_STATUSES } from '@/lib/supabase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { X } from 'lucide-react';

// ─── Status colours (matching HTML mockup) ──────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  'Not Started':          '#9E9E9E',
  'Plowing':              '#1E88E5',
  'Harrowing':            '#00ACC1',
  'Ridging':              '#FB8C00',
  'Ready For Transplant': '#43A047',
};
const STATUS_BG: Record<string, string> = {
  'Not Started':          '#F5F5F5',
  'Plowing':              '#E3F2FD',
  'Harrowing':            '#E0F7FA',
  'Ridging':              '#FFF3E0',
  'Ready For Transplant': '#E8F5E9',
};

// ─── Field areas (m²) ────────────────────────────────────────────────────────
const FIELD_AREA: Record<string, number> = {
  E01:1126,E02:1126,E03:1126,E04:1126,E05:1126,E06:1126,E07:1126,E08:1126,E09:1126,
  E10:1152,E11:1165,E12:1123,E13:1120,E14:1152,E15:1126,E16:1088,E17:653,E18:672,
  E19:1008,E20:1126,E21:1126,E22:1126,E23:1126,E24:1126,E25:1126,E26:1126,E27:1126,
  E28:1126,E29:1126,E30:1126,E31:1126,E32:1126,E33:1126,E34:1126,E35:1126,E36:1104,
  E37:1104,E38:1104,E39:608,E40:608,E41:1440,EX:720,
  NH01:232,NH02:232,NH03:232,NH04:232,NH05:232,NH06:232,NH07:232,NH08:232,NH09:232,
  NH10:232,NH11:232,NH12:232,NH13:232,NH14:232,NH15:232,NH16:232,NH17:232,NH18:232,
  NH19:232,NH20:232,NH21:232,NH22:232,NH23:232,NH24:232,NH25:232,NH26:232,NH27:232,
  NH28:232,NH29:232,NH30:232,NH31:232,NH32:232,NH33:232,NH34:232,NH35:232,NH36:232,
  NH37:232,NH38:232,NH39:232,
  P01:640,P02:888,P03:888,P04:888,P05:888,P06:288,P07:288,P08:614,
  P09:655,P10:655,P11:655,P12:655,
  S01:1024,S02:1024,S03:1024,S04:1024,S05:1024,S06:1126,S07:1126,S08:1126,S09:1126,
  S10:1126,S11:1126,S12:1126,S13:1126,S14:1126,S15:1126,S16:1126,S17:1126,S18:1126,
  S19:1126,S20:1126,S21:1126,S22:1126,S23:1126,S24:1126,S25:1126,S26:1126,S27:1126,
  S28:1126,S29:1126,
  W01:950,W02:912,W03:1144,W04:1144,W05:1144,W06:1144,W07:1144,W08:1144,W09:1144,
  W10:1144,W11:1144,W12:1144,W13:1144,W14:528,W15:864,W16:1040,W17:1040,W18:1040,
  W19:1040,W20:1144,W21:1144,W22:1144,W23:1144,W24:1144,W25:1144,W26:1144,W27:1144,
  W28:605,W29:1144,W30:1144,W31:1144,W32:1144,W33:1144,W34:1144,W35:1104,W37:1040,
  W39:538,W40:538,W41:538,W42:538,
};

// ─── MAP_FIELDS: percentage coords [code, x%, y%, w%, h%] ───────────────────
// Taken directly from the HTML mockup — calibrated for Google Maps satellite view
const MAP_FIELDS: [string, number, number, number, number][] = [
  // W zone
  ['W01',48,7,4,7],    ['W02',48,15,4,7],
  ['W03',41,7,3.5,7],  ['W04',37.5,7,3.5,7], ['W05',34,7,3.5,7],  ['W06',30.5,7,3.5,7],
  ['W07',27,7,3.5,7],  ['W08',23.5,7,3.5,7], ['W09',20,7,3.5,7],  ['W10',16.5,7,3.5,7],
  ['W11',13,12,3.5,7], ['W12',13,20,3.5,7],  ['W13',16.5,20,3.5,7],['W14',13,7,3.5,7],
  ['W15',8,22,5,9],
  ['W16',13,28,3.5,7], ['W17',16.5,28,3.5,7],['W18',20,28,3.5,7], ['W19',23.5,28,3.5,7],
  ['W20',13,36,3.5,7], ['W21',16.5,36,3.5,7],['W22',20,36,3.5,7], ['W23',23.5,36,3.5,7],
  ['W24',27,36,3.5,7], ['W25',30.5,36,3.5,7],['W26',34,36,3.5,7], ['W27',37.5,36,3.5,7],
  ['W29',34,44,3.5,7], ['W30',30.5,44,3.5,7],['W31',27,44,3.5,7], ['W32',23.5,44,3.5,7],
  ['W33',20,44,3.5,7], ['W34',16.5,44,3.5,7],['W37',13,0,38,7],
  ['W39',8,13,5,7],    ['W40',8,20,5,2],     ['W41',16.5,12,3.5,7],['W42',13,12,3,4],
  // W28 (standalone) — not in mockup so place approximately
  ['W28',42,44,3.5,7],
  // S zone
  ['S01',54,7,3.5,7],  ['S02',57.5,7,3.5,7], ['S03',61,7,3.5,7],  ['S04',64.5,7,3.5,7],
  ['S05',48,15,5.5,7],
  ['S06',54,15,3.5,7], ['S07',57.5,15,3.5,7],['S08',61,15,3.5,7], ['S09',64.5,15,3.5,7],
  ['S10',54,23,3.5,7], ['S11',57.5,23,3.5,7],
  ['S12',68,36,3.5,7], ['S13',64.5,36,3.5,7],['S14',61,36,3.5,7], ['S15',57.5,36,3.5,7],
  ['S16',54,36,3.5,7], ['S17',50.5,36,3.5,7],['S18',47,36,3.5,7], ['S19',47,28,3.5,7],
  ['S20',47,44,3.5,7], ['S21',50.5,44,3.5,7],['S22',54,44,3.5,7], ['S23',57.5,44,3.5,7],
  ['S24',61,44,3.5,7], ['S25',64.5,44,3.5,7],['S26',68,44,3.5,7], ['S27',71.5,44,3.5,7],
  ['S28',75,44,3.5,7], ['S29',78.5,44,3.5,7],
  // E zone row 1
  ['E01',68,7,3.2,7],  ['E02',71.2,7,3.2,7], ['E03',74.4,7,3.2,7],['E04',77.6,7,3.2,7],
  ['E05',80.8,7,3.2,7],['E06',84,7,3.2,7],
  ['E07',87.2,7,3.2,7],['E08',90.4,7,3.2,7], ['E09',93.6,7,3.2,7],
  // E zone row 2
  ['E10',68,15,3.2,7], ['E11',71.2,15,3.2,7],['E12',74.4,15,3.2,7],['E13',77.6,15,3.2,7],
  ['E14',80.8,15,3.2,7],['E15',84,15,3.2,7], ['E16',87.2,15,3.2,7],['E17',90.4,15,3.2,7],
  ['E18',93.6,15,5,16],['E19',90,23,6,14],
  // E zone row 3
  ['E20',90.4,23,3.2,7],['E21',87.2,23,3.2,7],['E22',84,23,3.2,7],['E23',80.8,23,3.2,7],
  ['E24',77.6,23,3.2,7],['E25',74.4,23,3.2,7],['E26',71.2,23,3.2,7],['E27',68,23,3.2,7],
  // E zone row 4
  ['E28',68,31,3.2,7], ['E29',71.2,31,3.2,7],['E30',74.4,31,3.2,7],['E31',77.6,31,3.2,7],
  ['E32',80.8,31,3.2,7],['E33',84,31,3.2,7], ['E34',87.2,31,3.2,7],['E35',90.4,31,3.2,7],
  // E zone row 5
  ['E36',68,38,5,8],   ['E37',73,38,5,8],    ['E38',78,38,5,8],
  ['E39',88,38,5,8],   ['E40',93,38,5,8],
  ['E41',68,50,16,12],
  // P zone
  ['P01',22,52,3.5,7], ['P02',25.5,52,3.5,7],['P03',29,52,3.5,7], ['P04',32.5,52,3.5,7],
  ['P05',22,60,3.5,7], ['P06',8,60,3.5,7],   ['P07',8,52,3.5,7],  ['P08',8,68,3.5,7],
  ['P09',22,68,3.5,7], ['P10',25.5,68,3.5,7],['P11',29,68,3.5,7], ['P12',32.5,68,3.5,7],
  // NH zone
  ['NH01',68,47,2.8,5],['NH02',70.8,47,2.8,5],['NH03',73.6,47,2.8,5],['NH04',76.4,47,2.8,5],
  ['NH05',79.2,47,2.8,5],['NH06',82,47,2.8,5],['NH07',84.8,47,2.8,5],['NH08',87.6,47,2.8,5],
  ['NH09',68,53,2.8,5],['NH10',70.8,53,2.8,5],['NH11',73.6,53,2.8,5],
  ['NH12',76.4,53,2.8,5],['NH13',79.2,53,2.8,5],
  ['NH22',68,59,2.8,5],['NH23',70.8,59,2.8,5],['NH24',73.6,59,2.8,5],
  // NH14-NH21 (fill in between NH13 and NH22)
  ['NH14',82,53,2.8,5],['NH15',84.8,53,2.8,5],['NH16',87.6,53,2.8,5],
  ['NH17',68,59,2.8,5],['NH18',70.8,59,2.8,5],['NH19',73.6,59,2.8,5],
  ['NH20',76.4,59,2.8,5],['NH21',79.2,59,2.8,5],
  // NH25-NH39
  ['NH25',82,59,2.8,5],['NH26',84.8,59,2.8,5],['NH27',87.6,59,2.8,5],
  ['NH28',68,65,2.8,5],['NH29',70.8,65,2.8,5],['NH30',73.6,65,2.8,5],
  ['NH31',76.4,65,2.8,5],['NH32',79.2,65,2.8,5],['NH33',82,65,2.8,5],
  ['NH34',68,71,2.8,5],['NH35',70.8,71,2.8,5],['NH36',73.6,71,2.8,5],
  ['NH37',76.4,71,2.8,5],['NH38',79.2,71,2.8,5],['NH39',82,71,2.8,5],
];

// Google Maps embed — satellite view of FLP2 farm area
const GMAPS_URL =
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1p3!2d98.9!3d18.7!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x30da3c6b6ddf2f75%3A0x4f9999bab7c69b9a!2z4Liq4Liy4Lij4LiHIOC4quC4suC4o-C4h-C4p-C4seC4mSDguILguLTguJk!5e1!3m2!1sth!2sth!4v1717680000000!5m2!1sth!2sth&maptype=satellite&zoom=16';

export default function FarmMap() {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Field | null>(null);
  const [updating, setUpdating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { toast } = useToast();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hoveredRef = useRef<string | null>(null);
  const fieldMapRef = useRef<Record<string, Field>>({});
  const tooltipRef = useRef<HTMLDivElement>(null);

  // ── Load fields ────────────────────────────────────────────────────────────
  const loadFields = useCallback(async () => {
    try {
      const { data } = await supabase.from('fields').select('*').order('field_code');
      if (data) {
        setFields(data);
        fieldMapRef.current = Object.fromEntries(data.map(f => [f.field_code, f]));
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFields(); }, [loadFields]);

  useEffect(() => {
    fieldMapRef.current = Object.fromEntries(fields.map(f => [f.field_code, f]));
  }, [fields]);

  // ── Canvas drawing ─────────────────────────────────────────────────────────
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    // Make canvas pixel-perfect with container
    if (canvas.width !== wrap.offsetWidth || canvas.height !== wrap.offsetHeight) {
      canvas.width = wrap.offsetWidth;
      canvas.height = wrap.offsetHeight;
    }
    const W = canvas.width;
    const H = canvas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, W, H);

    const fmap = fieldMapRef.current;
    const hov = hoveredRef.current;
    const selCode = selected?.field_code ?? null;

    for (const [code, xp, yp, wp, hp] of MAP_FIELDS) {
      const f = fmap[code];
      const status = f?.status ?? 'Not Started';
      if (statusFilter !== 'all' && status !== statusFilter) continue;

      const px = xp / 100 * W;
      const py = yp / 100 * H;
      const pw = wp / 100 * W;
      const ph = hp / 100 * H;
      const isSel = selCode === code;
      const isHov = hov === code;
      const col = STATUS_COLOR[status];

      ctx.save();
      ctx.globalAlpha = isSel ? 0.90 : isHov ? 0.82 : 0.72;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 3);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.strokeStyle = isSel ? '#fff' : isHov ? '#fff' : col;
      ctx.lineWidth = isSel ? 2.5 : isHov ? 1.5 : 1;
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 3);
      ctx.stroke();
      ctx.restore();

      // Label
      if (pw > 16 && ph > 10) {
        const fs = Math.min(11, pw / code.length * 1.4);
        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${fs}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 3;
        ctx.fillText(code, px + pw / 2, py + ph / 2);
        ctx.restore();
      }
    }
  }, [selected, statusFilter]);

  useEffect(() => { drawCanvas(); }, [drawCanvas, fields]);

  // Resize canvas when container resizes
  useEffect(() => {
    const obs = new ResizeObserver(drawCanvas);
    if (wrapRef.current) obs.observe(wrapRef.current);
    return () => obs.disconnect();
  }, [drawCanvas]);

  // ── Canvas mouse handlers ──────────────────────────────────────────────────
  function getHit(e: React.MouseEvent<HTMLCanvasElement>): string | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    const W = canvas.width, H = canvas.height;
    for (const [code, xp, yp, wp, hp] of MAP_FIELDS) {
      const px = xp/100*W, py = yp/100*H, pw = wp/100*W, ph = hp/100*H;
      if (mx >= px && mx <= px+pw && my >= py && my <= py+ph) return code;
    }
    return null;
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const code = getHit(e);
    if (code !== hoveredRef.current) {
      hoveredRef.current = code;
      drawCanvas();
    }
    const tip = tooltipRef.current;
    if (!tip) return;
    if (code) {
      const f = fieldMapRef.current[code];
      const status = f?.status ?? 'Not Started';
      const col = STATUS_COLOR[status];
      const area = f ? Number(f.area_m2).toLocaleString() : (FIELD_AREA[code] ? FIELD_AREA[code].toLocaleString() : '—');
      tip.style.display = 'block';
      tip.style.left = (e.nativeEvent.offsetX + 14) + 'px';
      tip.style.top = (e.nativeEvent.offsetY - 10) + 'px';
      tip.innerHTML = `<strong>${code}</strong>&nbsp;<span style="background:${col};color:#fff;font-size:10px;padding:1px 6px;border-radius:3px">${status}</span><div style="font-size:10px;color:#ccc;margin-top:2px">${area} m²</div>`;
    } else {
      tip.style.display = 'none';
    }
  }

  function onMouseLeave() {
    hoveredRef.current = null;
    drawCanvas();
    if (tooltipRef.current) tooltipRef.current.style.display = 'none';
  }

  function onClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const code = getHit(e);
    if (!code) return;
    const f = fieldMapRef.current[code];
    if (f) {
      setSelected(f);
    } else {
      setSelected({
        id: '', field_code: code,
        area_m2: FIELD_AREA[code] ?? 0,
        status: 'Not Started',
        planned_transplant_date: null, actual_transplant_date: null,
        polygon: null, center_lat: null, center_lng: null,
        created_at: '', updated_at: '', user_id: '',
      } as Field);
    }
  }

  // ── Update status ──────────────────────────────────────────────────────────
  async function changeStatus(fieldId: string, status: FieldStatus) {
    setUpdating(true);
    const { error } = await supabase.from('fields').update({ status }).eq('id', fieldId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Updated', description: `${selected?.field_code} → ${status}` });
      setFields(p => p.map(f => f.id === fieldId ? { ...f, status } : f));
      setSelected(p => p?.id === fieldId ? { ...p, status } : p);
    }
    setUpdating(false);
  }

  // ── Counts ─────────────────────────────────────────────────────────────────
  const counts = Object.fromEntries(FIELD_STATUSES.map(s => [s, fields.filter(f => f.status === s).length]));

  if (loading) {
    return (
      <div className="p-8 animate-pulse space-y-4">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-[500px] bg-muted rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-3">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Farm Map</h1>
        <p className="text-muted-foreground text-xs mt-0.5">Farm Lert Phan 2 · คลิกแปลงเพื่อดูรายละเอียดและเปลี่ยนสถานะ</p>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1 rounded-full border transition-all ${statusFilter === 'all' ? 'bg-foreground text-background border-foreground font-medium' : 'border-border text-muted-foreground hover:text-foreground'}`}
        >
          ทุกสถานะ ({fields.length})
        </button>
        {FIELD_STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="px-3 py-1 rounded-full border transition-all"
            style={statusFilter === s
              ? { background: STATUS_COLOR[s], color: '#fff', borderColor: STATUS_COLOR[s], fontWeight: 500 }
              : { borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            <span className="inline-block w-2 h-2 rounded-sm mr-1 align-middle" style={{ background: STATUS_COLOR[s] }} />
            {s} ({counts[s] ?? 0})
          </button>
        ))}
      </div>

      <div className="flex gap-3 items-start">
        {/* Map */}
        <div className="flex-1 min-w-0">
          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-xs mb-2 p-2 rounded-md border border-border bg-card">
            {FIELD_STATUSES.map(s => (
              <span key={s} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: STATUS_COLOR[s] }} />
                <span className="text-muted-foreground">{s}</span>
              </span>
            ))}
          </div>

          {/* Map container */}
          <div
            ref={wrapRef}
            className="relative rounded-lg border border-border overflow-hidden"
            style={{ height: '68vh', background: '#e8ecef' }}
          >
            {/* Google Maps satellite iframe */}
            <iframe
              src={GMAPS_URL}
              className="absolute inset-0 w-full h-full border-0"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="FLP2 Satellite Map"
            />

            {/* Canvas overlay */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
              style={{ cursor: 'crosshair' }}
              onMouseMove={onMouseMove}
              onMouseLeave={onMouseLeave}
              onClick={onClick}
            />

            {/* Tooltip */}
            <div
              ref={tooltipRef}
              className="absolute z-10 pointer-events-none"
              style={{
                display: 'none',
                background: 'rgba(0,0,0,0.85)',
                color: '#fff',
                fontSize: 11,
                padding: '6px 10px',
                borderRadius: 7,
                lineHeight: 1.5,
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                maxWidth: 160,
              }}
            />

            {/* Static legend overlay */}
            <div className="absolute bottom-2 left-2 bg-white/95 rounded-md p-2 text-[10px] flex flex-col gap-1 shadow-md pointer-events-none">
              <div className="font-semibold text-gray-700 mb-0.5">สถานะแปลง</div>
              {FIELD_STATUSES.map(s => (
                <div key={s} className="flex items-center gap-1.5 text-gray-700">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: STATUS_COLOR[s] }} />
                  {s}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar — shown when a field is selected */}
        {selected && (
          <div className="w-56 shrink-0 rounded-lg border border-border bg-card p-4 space-y-3 self-start sticky top-4 text-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">{selected.field_code}</h2>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status badge */}
            <div
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium text-white"
              style={{ background: STATUS_COLOR[selected.status] }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white/70 inline-block" />
              {selected.status}
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">พื้นที่</span>
                <span className="font-medium">{Number(selected.area_m2).toLocaleString()} m²</span>
              </div>
              {selected.planned_transplant_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">แผนปลูก</span>
                  <span>{selected.planned_transplant_date}</span>
                </div>
              )}
              {selected.actual_transplant_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ปลูกจริง</span>
                  <span>{selected.actual_transplant_date}</span>
                </div>
              )}
            </div>

            <div className="pt-1 border-t border-border space-y-1.5">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">เปลี่ยนสถานะ</p>
              {selected.id ? (
                <Select
                  value={selected.status}
                  onValueChange={v => changeStatus(selected.id, v as FieldStatus)}
                  disabled={updating}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIELD_STATUSES.map(s => (
                      <SelectItem key={s} value={s}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-sm inline-block" style={{ background: STATUS_COLOR[s] }} />
                          {s}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-xs text-amber-500">ไม่พบในฐานข้อมูล</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
