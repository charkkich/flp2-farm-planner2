'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type Field, type FieldStatus, FIELD_STATUSES } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { X } from 'lucide-react';

const STATUS_FILL: Record<string, string> = {
  'Not Started':        '#475569',
  'Plowing':            '#b45309',
  'Harrowing':          '#c2410c',
  'Ridging':            '#047857',
  'Ready For Transplant': '#0369a1',
};

const STATUS_BADGE: Record<string, string> = {
  'Not Started':        'bg-slate-500',
  'Plowing':            'bg-amber-600',
  'Harrowing':          'bg-orange-600',
  'Ridging':            'bg-emerald-700',
  'Ready For Transplant': 'bg-sky-700',
};

// [code, x, y, w, h]  — viewBox "0 0 1760 800"
const LAYOUT: [string, number, number, number, number][] = [
  // ── W ZONE ───────────────────────────────────────────────────────
  ['W37',  188,   5, 308,  58],

  // row 1
  ['W42',    5,  67,  58,  58], ['W41',  67,  67,  58,  58],
  ['W14',  133,  67,  72,  58],
  ['W13',  209,  67,  58,  58], ['W12',  271,  67,  58,  58],
  ['W11',  333,  67,  58,  58], ['W10',  395,  67,  58,  58],
  ['W09',  457,  67,  58,  58], ['W08',  519,  67,  58,  58],
  ['W07',  581,  67,  58,  58], ['W06',  643,  67,  58,  58],
  ['W05',  705,  67,  58,  58], ['W04',  767,  67,  58,  58],
  ['W03',  829,  67,  58,  58],
  ['W01',  895,  67,  58,  58],

  // row 2
  ['W39',    5, 129,  58,  58], ['W40',   67, 129,  58,  58],
  ['W16',  133, 129,  58,  58], ['W17',  195, 129,  58,  58],
  ['W18',  257, 129,  58,  58], ['W19',  319, 129,  58,  58],
  ['W20',  381, 129,  58,  58], ['W21',  443, 129,  58,  58],
  ['W22',  505, 129,  58,  58], ['W23',  567, 129,  58,  58],
  ['W24',  629, 129,  58,  58], ['W25',  691, 129,  58,  58],
  ['W26',  753, 129,  58,  58], ['W27',  815, 129,  58,  58],
  ['W02',  895, 129,  58,  58],

  // row 3
  ['W15',    5, 191, 122, 122],
  ['W28',  133, 191,  44,  58],
  ['W29',  181, 191,  58,  58], ['W30',  243, 191,  58,  58],
  ['W31',  305, 191,  58,  58], ['W32',  367, 191,  58,  58],
  ['W33',  429, 191,  58,  58], ['W34',  491, 191,  58,  58],
  ['EX',   557, 191,  58,  58],

  // row 4
  ['W35',  133, 253, 186,  58],

  // ── S ZONE ───────────────────────────────────────────────────────
  // row 1
  ['S05',  623,   5,  58,  58], ['S04',  685,   5,  58,  58],
  ['S03',  747,   5,  58,  58], ['S02',  809,   5,  58,  58],
  ['S01',  871,   5,  58,  58],

  // row 2
  ['S06',  623,  67,  58,  58], ['S07',  685,  67,  58,  58],
  ['S08',  747,  67,  58,  58], ['S09',  809,  67,  58,  58],
  ['S10',  871,  67,  58,  58], ['S11',  933,  67,  58,  58],

  // row 3
  ['S19',  623, 129,  58,  58], ['S18',  685, 129,  58,  58],
  ['S17',  747, 129,  58,  58], ['S16',  809, 129,  58,  58],
  ['S15',  871, 129,  58,  58], ['S14',  933, 129,  58,  58],
  ['S13',  995, 129,  58,  58], ['S12', 1057, 129,  58,  58],

  // row 4
  ['S20',  623, 191,  58,  58], ['S21',  685, 191,  58,  58],
  ['S22',  747, 191,  58,  58], ['S23',  809, 191,  58,  58],
  ['S24',  871, 191,  58,  58], ['S25',  933, 191,  58,  58],
  ['S26',  995, 191,  58,  58], ['S27', 1057, 191,  58,  58],
  ['S28', 1119, 191,  58,  58], ['S29', 1181, 191,  58,  58],

  // ── E ZONE ───────────────────────────────────────────────────────
  // row 1: E01–E06
  ['E01',  995,   5,  58,  58], ['E02', 1057,   5,  58,  58],
  ['E03', 1119,   5,  58,  58], ['E04', 1181,   5,  58,  58],
  ['E05', 1243,   5,  58,  58], ['E06', 1305,   5,  58,  58],

  // row 2: E07–E18
  ['E07', 1057,  67,  58,  58], ['E08', 1119,  67,  58,  58],
  ['E09', 1181,  67,  58,  58], ['E10', 1243,  67,  58,  58],
  ['E11', 1305,  67,  58,  58], ['E12', 1367,  67,  58,  58],
  ['E13', 1429,  67,  58,  58], ['E14', 1491,  67,  58,  58],
  ['E15', 1553,  67,  58,  58], ['E16', 1615,  67,  58,  58],
  ['E17', 1677,  67,  58,  58],
  ['E18', 1677,   5,  58,  58],

  // row 3: E35–E20 (right side, reversed) + E19 far right
  ['E35', 1057, 129,  58,  58], ['E34', 1119, 129,  58,  58],
  ['E33', 1181, 129,  58,  58], ['E32', 1243, 129,  58,  58],
  ['E31', 1305, 129,  58,  58], ['E30', 1367, 129,  58,  58],
  ['E29', 1429, 129,  58,  58], ['E28', 1491, 129,  58,  58],
  ['E27', 1553, 129,  58,  58], ['E26', 1615, 129,  58,  58],
  ['E25', 1677, 129,  58,  58],
  ['E19', 1677, 191,  58, 120],

  // row 4: E24–E20
  ['E24', 1057, 191,  58,  58], ['E23', 1119, 191,  58,  58],
  ['E22', 1181, 191,  58,  58], ['E21', 1243, 191,  58,  58],
  ['E20', 1305, 191,  58,  58],

  // E36–E41 lower
  ['E36', 1057, 315,  58,  58], ['E37', 1119, 315,  58,  58],
  ['E38', 1181, 315,  58,  58],
  ['E39', 1243, 315,  44,  44], ['E40', 1291, 315,  44,  44],
  ['E41', 1057, 377, 172,  76],

  // ── NH ZONE (small plots, 3×13 + 1×6) ───────────────────────────
  // row 1: NH01–NH11
  ['NH01', 1243, 377,  44,  44], ['NH02', 1291, 377,  44,  44],
  ['NH03', 1339, 377,  44,  44], ['NH04', 1387, 377,  44,  44],
  ['NH05', 1435, 377,  44,  44], ['NH06', 1483, 377,  44,  44],
  ['NH07', 1531, 377,  44,  44], ['NH08', 1579, 377,  44,  44],
  ['NH09', 1627, 377,  44,  44], ['NH10', 1675, 377,  44,  44],
  ['NH11', 1057, 425,  44,  44],

  // row 2: NH12–NH22
  ['NH12', 1105, 425,  44,  44], ['NH13', 1153, 425,  44,  44],
  ['NH14', 1201, 425,  44,  44], ['NH15', 1249, 425,  44,  44],
  ['NH16', 1297, 425,  44,  44], ['NH17', 1345, 425,  44,  44],
  ['NH18', 1393, 425,  44,  44], ['NH19', 1441, 425,  44,  44],
  ['NH20', 1489, 425,  44,  44], ['NH21', 1537, 425,  44,  44],
  ['NH22', 1585, 425,  44,  44],

  // row 3: NH23–NH33
  ['NH23', 1057, 473,  44,  44], ['NH24', 1105, 473,  44,  44],
  ['NH25', 1153, 473,  44,  44], ['NH26', 1201, 473,  44,  44],
  ['NH27', 1249, 473,  44,  44], ['NH28', 1297, 473,  44,  44],
  ['NH29', 1345, 473,  44,  44], ['NH30', 1393, 473,  44,  44],
  ['NH31', 1441, 473,  44,  44], ['NH32', 1489, 473,  44,  44],
  ['NH33', 1537, 473,  44,  44],

  // row 4: NH34–NH39
  ['NH34', 1057, 521,  44,  44], ['NH35', 1105, 521,  44,  44],
  ['NH36', 1153, 521,  44,  44], ['NH37', 1201, 521,  44,  44],
  ['NH38', 1249, 521,  44,  44], ['NH39', 1297, 521,  44,  44],

  // ── P ZONE ───────────────────────────────────────────────────────
  ['P01',  215, 315,  58,  58],
  ['P02',  157, 375,  54,  58], ['P03',  101, 375,  54,  58],
  ['P04',   47, 375,  54,  58], ['P05',    5, 375,  38,  58],
  ['P06',    5, 317,  38,  54], ['P07',    5, 375,  38,  54],
  ['P08',   47, 317,  54,  54],
  ['P09',   47, 437,  54,  58], ['P10',  101, 437,  54,  58],
  ['P11',  157, 437,  54,  58], ['P12',  211, 437,  54,  58],
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
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFields(); }, [loadFields]);

  const fieldMap = Object.fromEntries(fields.map(f => [f.field_code, f]));

  async function changeStatus(fieldId: string, status: FieldStatus) {
    setUpdating(true);
    const { error } = await supabase.from('fields').update({ status }).eq('id', fieldId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Updated', description: `Status changed to ${status}` });
      setFields(prev => prev.map(f => f.id === fieldId ? { ...f, status } : f));
      setSelected(prev => prev?.id === fieldId ? { ...prev, status } : prev);
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Farm Map</h1>
        <p className="text-muted-foreground text-sm mt-1">Farm Lert Phan 2 (FLP2) — click a plot to view or update status</p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {FIELD_STATUSES.map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: STATUS_FILL[s] }} />
            <span className="text-muted-foreground">{s}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        {/* Map */}
        <div className="flex-1 overflow-auto rounded-lg border border-border bg-[#1a1f2e]" style={{ maxHeight: '72vh' }}>
          <svg
            viewBox="0 0 1760 600"
            width="1760"
            height="600"
            style={{ display: 'block', minWidth: '1760px' }}
          >
            {/* Zone labels */}
            <text x="450" y="340" fill="#374151" fontSize="18" fontWeight="bold" opacity="0.4">W ZONE</text>
            <text x="750" y="280" fill="#374151" fontSize="18" fontWeight="bold" opacity="0.4">S ZONE</text>
            <text x="1300" y="280" fill="#374151" fontSize="18" fontWeight="bold" opacity="0.4">E ZONE</text>
            <text x="1150" y="575" fill="#374151" fontSize="16" fontWeight="bold" opacity="0.4">NH ZONE</text>
            <text x="60"  y="500" fill="#374151" fontSize="16" fontWeight="bold" opacity="0.4">P ZONE</text>

            {LAYOUT.map(([code, x, y, w, h]) => {
              const field = fieldMap[code];
              const fill = field ? STATUS_FILL[field.status] ?? '#475569' : '#2d3748';
              const isSelected = selected?.field_code === code;
              const fontSize = code.length > 3 ? 7 : code.length > 2 ? 8 : 9;
              return (
                <g key={code} style={{ cursor: 'pointer' }} onClick={() => setSelected(field ?? null)}>
                  <rect
                    x={x} y={y} width={w} height={h}
                    rx={3}
                    fill={fill}
                    fillOpacity={field ? 0.85 : 0.3}
                    stroke={isSelected ? '#f8fafc' : '#0f172a'}
                    strokeWidth={isSelected ? 2.5 : 1}
                  />
                  <text
                    x={x + w / 2} y={y + h / 2 + (fontSize / 2) - 1}
                    textAnchor="middle"
                    fill="#f1f5f9"
                    fontSize={fontSize}
                    fontWeight="600"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {code}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Sidebar */}
        {selected && (
          <div className="w-64 shrink-0 rounded-lg border border-border bg-card p-4 space-y-4 self-start">
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
              <Select
                value={selected.status}
                onValueChange={v => changeStatus(selected.id, v as FieldStatus)}
                disabled={updating}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
