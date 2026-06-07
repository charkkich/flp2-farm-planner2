'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type Field, type FieldStatus, FIELD_STATUSES } from '@/lib/supabase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { X } from 'lucide-react';

const STATUS_FILL: Record<string, string> = {
  'Not Started':          '#64748b',
  'Plowing':              '#d97706',
  'Harrowing':            '#ea580c',
  'Ridging':              '#16a34a',
  'Ready For Transplant': '#0284c7',
};
const STATUS_BADGE: Record<string, string> = {
  'Not Started':          'bg-slate-500',
  'Plowing':              'bg-amber-600',
  'Harrowing':            'bg-orange-600',
  'Ridging':              'bg-green-700',
  'Ready For Transplant': 'bg-sky-700',
};

// Static area data (m²) for each field — used when Supabase is unavailable
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

// Coordinates mapped to 2500×1333 image
// [code, x, y, w, h]  — measured from aerial photo
const LAYOUT: [string, number, number, number, number][] = [
  // ── W ZONE ────────────────────────────────────────────────────────────
  // W37: large open field at top of farm
  ['W37',  352,  18, 460, 108],

  // Left-column small buildings
  ['W42',  170, 262,  73,  90],
  ['W41',  256, 262,  73,  90],
  ['W39',  170, 375,  73,  80],
  ['W40',  256, 375,  73,  80],
  ['W15',  165, 460, 140,  90],

  // Row 1 (main greenhouses y=198, h=132)
  ['W14',  262, 198,  30, 132],  // narrow building
  ['W13',  298, 198,  60, 132],
  ['W12',  362, 198,  60, 132],
  ['W11',  426, 198,  60, 132],
  // road gap ~486–515
  ['W10',  515, 198,  52, 132],
  ['W09',  572, 198,  52, 132],
  ['W08',  629, 198,  52, 132],
  ['W07',  686, 198,  52, 132],
  ['W06',  743, 198,  52, 132],
  ['W05',  800, 198,  52, 132],
  ['W04',  857, 198,  52, 132],
  ['W03',  914, 198,  52, 132],
  ['W01',  970, 175,  88,  78],  // standalone right

  // Row 2 (y=385, h=142)
  ['W16',  262, 385,  56, 142],
  ['W17',  322, 385,  56, 142],
  ['W18',  382, 385,  56, 142],
  ['W19',  442, 385,  56, 142],
  // road gap ~498–515
  ['W20',  515, 385,  48, 142],
  ['W21',  568, 385,  48, 142],
  ['W22',  621, 385,  48, 142],
  ['W23',  674, 385,  48, 142],
  ['W24',  727, 385,  48, 142],
  ['W25',  780, 385,  48, 142],
  ['W26',  833, 385,  48, 142],
  ['W27',  886, 385,  48, 142],
  ['W02',  970, 385,  88,  80],  // standalone right

  // Row 3 (y=555, h=140)
  ['W34',  262, 555,  62, 140],
  ['W33',  328, 555,  62, 140],
  ['W32',  394, 555,  62, 140],
  ['W31',  460, 555,  62, 140],
  ['W30',  526, 555,  62, 140],
  ['W29',  592, 555,  62, 140],
  ['W28',  878, 555,  78, 140],  // standalone far right
  ['EX',   970, 480,  70,  95],  // extra building

  // Row 4
  ['W35',  555, 795,  88,  90],

  // ── S ZONE ────────────────────────────────────────────────────────────
  // Row 1 (y=160, h=175)
  ['S05', 1062, 160,  72, 175],
  ['S04', 1140, 160,  62, 175],
  ['S03', 1207, 160,  62, 175],
  ['S02', 1274, 160,  62, 175],
  ['S01', 1341, 160,  62, 175],

  // Row 2 (y=382, h=188)
  ['S06', 1062, 382,  60, 188],
  ['S07', 1126, 382,  60, 188],
  ['S08', 1190, 382,  60, 188],
  ['S09', 1254, 382,  60, 188],
  ['S10', 1318, 382,  60, 188],
  ['S11', 1382, 382,  40, 188],

  // Row 3 (y=592, h=148) — S19 leftmost, S12 rightmost
  ['S19', 1062, 592,  43, 148],
  ['S18', 1109, 592,  43, 148],
  ['S17', 1156, 592,  43, 148],
  ['S16', 1203, 592,  43, 148],
  ['S15', 1250, 592,  43, 148],
  ['S14', 1297, 592,  43, 148],
  ['S13', 1344, 592,  43, 148],
  ['S12', 1391, 592,  43, 148],

  // Row 4 (y=782, h=180) — S20 leftmost
  ['S20', 1062, 782,  34, 180],
  ['S21', 1099, 782,  34, 180],
  ['S22', 1136, 782,  34, 180],
  ['S23', 1173, 782,  34, 180],
  ['S24', 1210, 782,  34, 180],
  ['S25', 1247, 782,  34, 180],
  ['S26', 1284, 782,  34, 180],
  ['S27', 1321, 782,  34, 180],
  ['S28', 1358, 782,  34, 180],
  ['S29', 1395, 782,  34, 180],

  // ── E ZONE ────────────────────────────────────────────────────────────
  // Row 1 left group: E01–E06 (y=160, h=175)
  ['E01', 1425, 160,  58, 175],
  ['E02', 1487, 160,  58, 175],
  ['E03', 1549, 160,  58, 175],
  ['E04', 1611, 160,  58, 175],
  ['E05', 1673, 160,  58, 175],
  ['E06', 1735, 160,  58, 175],
  // road gap ~1793–1820
  // Row 1 right group: E07–E18
  ['E07', 1820, 160,  78, 175],
  ['E08', 1902, 160,  78, 175],
  ['E09', 1984, 160,  78, 175],
  ['E10', 2066, 160,  78, 175],
  ['E11', 2155, 160,  43, 175],
  ['E12', 2202, 160,  43, 175],
  ['E13', 2249, 160,  43, 175],
  ['E14', 2296, 160,  43, 175],
  ['E15', 2343, 160,  43, 175],
  ['E16', 2390, 160,  43, 175],
  ['E17', 2437, 160,  28, 175],
  ['E18', 2468, 160,  30, 270],  // tall narrow, spans to row 2

  // Row 2 left group: E35–E30 (y=382, h=188)
  ['E35', 1425, 382,  58, 188],
  ['E34', 1487, 382,  58, 188],
  ['E33', 1549, 382,  58, 188],
  ['E32', 1611, 382,  58, 188],
  ['E31', 1673, 382,  58, 188],
  ['E30', 1735, 382,  58, 188],
  // Row 2 right group: E29–E19
  ['E29', 1820, 382,  60, 188],
  ['E28', 1884, 382,  60, 188],
  ['E27', 1948, 382,  60, 188],
  ['E26', 2012, 382,  60, 188],
  ['E25', 2076, 382,  60, 188],
  ['E24', 2140, 382,  60, 188],
  ['E23', 2204, 382,  60, 188],
  ['E22', 2268, 382,  60, 188],
  ['E21', 2332, 382,  60, 188],
  ['E20', 2396, 382,  60, 188],
  ['E19', 2460, 382,  35, 188],

  // Row 3: E36–E38 (large), E39–E40 (y=590, h=148)
  ['E36', 1425, 590, 138, 148],
  ['E37', 1568, 590, 138, 148],
  ['E38', 1711, 590, 138, 148],
  ['E39', 2125, 590,  95, 120],
  ['E40', 2225, 590,  95, 120],

  // E41 large building (y=985, h=100)
  ['E41', 1425, 985, 195, 100],

  // ── NH ZONE (small green plots, 43px wide) ───────────────────────────
  // Row 1: NH01–NH11 (y=762, h=80)
  ['NH01', 1370, 762,  43,  80], ['NH02', 1418, 762,  43,  80],
  ['NH03', 1466, 762,  43,  80], ['NH04', 1514, 762,  43,  80],
  ['NH05', 1562, 762,  43,  80], ['NH06', 1610, 762,  43,  80],
  ['NH07', 1658, 762,  43,  80], ['NH08', 1706, 762,  43,  80],
  ['NH09', 1754, 762,  43,  80], ['NH10', 1802, 762,  43,  80],
  ['NH11', 1850, 762,  43,  80],

  // Row 2: NH22–NH12 L→R (y=850, h=82)
  ['NH22', 1370, 850,  43,  82], ['NH21', 1418, 850,  43,  82],
  ['NH20', 1466, 850,  43,  82], ['NH19', 1514, 850,  43,  82],
  ['NH18', 1562, 850,  43,  82], ['NH17', 1610, 850,  43,  82],
  ['NH16', 1658, 850,  43,  82], ['NH15', 1706, 850,  43,  82],
  ['NH14', 1754, 850,  43,  82], ['NH13', 1802, 850,  43,  82],
  ['NH12', 1850, 850,  43,  82],

  // Row 3: NH23–NH33 (y=940, h=78)
  ['NH23', 1370, 940,  43,  78], ['NH24', 1418, 940,  43,  78],
  ['NH25', 1466, 940,  43,  78], ['NH26', 1514, 940,  43,  78],
  ['NH27', 1562, 940,  43,  78], ['NH28', 1610, 940,  43,  78],
  ['NH29', 1658, 940,  43,  78], ['NH30', 1706, 940,  43,  78],
  ['NH31', 1754, 940,  43,  78], ['NH32', 1802, 940,  43,  78],
  ['NH33', 1850, 940,  43,  78],

  // Row 4: NH34–NH39 (y=1025, h=65)
  ['NH34', 1370, 1025,  43,  65], ['NH35', 1418, 1025,  43,  65],
  ['NH36', 1466, 1025,  43,  65], ['NH37', 1514, 1025,  43,  65],
  ['NH38', 1562, 1025,  43,  65], ['NH39', 1610, 1025,  43,  65],

  // ── P ZONE ────────────────────────────────────────────────────────────
  ['P01',  297, 584, 251,  91],   // large Tomato block top-right
  ['P06',  130, 676,  55,  62],   // left column
  ['P07',  130, 742,  55,  62],
  ['P08',  130, 815,  55,  65],
  ['P05',  192, 676,  95,  98],   // Tomato row
  ['P04',  292, 676,  95,  98],
  ['P03',  392, 676,  95,  98],
  ['P02',  490, 676,  58,  98],
  ['P09',  192, 800,  95,  98],   // Pepper row
  ['P10',  292, 800,  95,  98],
  ['P11',  392, 800,  95,  98],
  ['P12',  490, 800,  58,  98],
];

export default function FarmMap() {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Field | null>(null);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  const loadFields = useCallback(async () => {
    try {
      const { data } = await supabase.from('fields').select('*').order('field_code');
      if (data) setFields(data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFields(); }, [loadFields]);

  const fieldMap = Object.fromEntries(fields.map(f => [f.field_code, f]));

  function handleClick(code: string) {
    const dbField = fieldMap[code];
    if (dbField) {
      setSelected(dbField);
    } else {
      // Field not in DB yet or Supabase not connected — show static info
      setSelected({
        id: '',
        field_code: code,
        area_m2: FIELD_AREA[code] ?? 0,
        status: 'Not Started',
        planned_transplant_date: null,
        actual_transplant_date: null,
        polygon: null,
        center_lat: null,
        center_lng: null,
        created_at: '',
        updated_at: '',
        user_id: '',
      } as Field);
    }
  }

  async function changeStatus(fieldId: string, status: FieldStatus) {
    setUpdating(true);
    const { error } = await supabase.from('fields').update({ status }).eq('id', fieldId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Updated', description: `Status → ${status}` });
      setFields(p => p.map(f => f.id === fieldId ? { ...f, status } : f));
      setSelected(p => p?.id === fieldId ? { ...p, status } : p);
    }
    setUpdating(false);
  }

  if (loading) {
    return (
      <div className="p-8 animate-pulse space-y-4">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-[600px] bg-muted rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Farm Map</h1>
          <p className="text-muted-foreground text-sm mt-1">Farm Lert Phan 2 (FLP2) — click a plot to view or update status</p>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs">
          {FIELD_STATUSES.map(s => (
            <div key={s} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm opacity-80" style={{ background: STATUS_FILL[s] }} />
              <span className="text-muted-foreground">{s}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-4 items-start">
        {/* Map container */}
        <div className="flex-1 overflow-auto rounded-lg border border-border" style={{ maxHeight: '75vh' }}>
          <svg
            viewBox="0 0 2500 1333"
            style={{ display: 'block', width: '100%', minWidth: '900px' }}
          >
            {/* Background image */}
            <image href="/farm-map.jpg" x="0" y="0" width="2500" height="1333" preserveAspectRatio="xMidYMid slice" />

            {/* Field overlays */}
            {LAYOUT.map(([code, x, y, w, h]) => {
              const field = fieldMap[code];
              const status = field?.status ?? 'Not Started';
              const isNotStarted = status === 'Not Started';
              const fill = STATUS_FILL[status];
              const isSelected = selected?.field_code === code;
              const fs = code.length > 4 ? 11 : code.length > 3 ? 13 : 15;
              return (
                <g key={code} style={{ cursor: 'pointer' }} onClick={() => handleClick(code)}>
                  <rect
                    x={x} y={y} width={w} height={h}
                    rx={4}
                    fill={fill}
                    fillOpacity={isSelected ? 0.75 : isNotStarted ? 0.08 : 0.60}
                    stroke={isSelected ? '#ffffff' : isNotStarted ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.5)'}
                    strokeWidth={isSelected ? 3 : 1}
                  />
                  {/* Show label only when selected or has non-default status */}
                  {(!isNotStarted || isSelected) && (
                    <text
                      x={x + w / 2}
                      y={y + h / 2 + fs * 0.35}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={fs}
                      fontWeight="700"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                      filter="url(#shadow)"
                    >
                      {code}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Text shadow filter */}
            <defs>
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="black" floodOpacity="0.8" />
              </filter>
            </defs>
          </svg>
        </div>

        {/* Sidebar */}
        {selected && (
          <div className="w-60 shrink-0 rounded-lg border border-border bg-card p-4 space-y-4 self-start sticky top-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{selected.field_code}</h2>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Area</span>
                <span className="font-medium">{Number(selected.area_m2).toLocaleString()} m²</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status</span>
                <Badge className={`${STATUS_BADGE[selected.status]} text-white text-xs`}>
                  {selected.status}
                </Badge>
              </div>
              {selected.planned_transplant_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Planned</span>
                  <span>{selected.planned_transplant_date}</span>
                </div>
              )}
              {selected.actual_transplant_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Actual</span>
                  <span>{selected.actual_transplant_date}</span>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Change Status</p>
              {selected.id ? (
                <Select value={selected.status} onValueChange={v => changeStatus(selected.id, v as FieldStatus)} disabled={updating}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIELD_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-xs text-amber-500">Supabase not connected — set env vars in Vercel</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
