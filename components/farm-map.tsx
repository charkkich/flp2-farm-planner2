'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, type Field, type FieldStatus, FIELD_STATUSES } from '@/lib/supabase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

// ─── Status colours ─────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  'Not Started':          '#64748b',
  'Plowing':              '#d97706',
  'Harrowing':            '#ea580c',
  'Ridging':              '#16a34a',
  'Ready For Transplant': '#0284c7',
};
const STATUS_BG: Record<string, string> = {
  'Not Started':          '#f1f5f9',
  'Plowing':              '#fef3c7',
  'Harrowing':            '#ffedd5',
  'Ridging':              '#dcfce7',
  'Ready For Transplant': '#e0f2fe',
};
const STATUS_BADGE: Record<string, string> = {
  'Not Started':          'bg-slate-500',
  'Plowing':              'bg-amber-600',
  'Harrowing':            'bg-orange-600',
  'Ridging':              'bg-green-700',
  'Ready For Transplant': 'bg-sky-700',
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

// ─── Field layout as % of 2500×1333 image ────────────────────────────────────
// [code, x%, y%, w%, h%]  — convert from pixels: x%=px/2500, y%=py/1333
const LAYOUT: [string, number, number, number, number][] = [
  // W zone
  ['W37', 14.1, 1.4, 18.4,  8.1],
  ['W42',  6.8,19.7,  2.9,  6.8],['W41', 10.2,19.7,  2.9,  6.8],
  ['W39',  6.8,28.1,  2.9,  6.0],['W40', 10.2,28.1,  2.9,  6.0],
  ['W15',  6.6,34.5,  5.6,  6.8],
  ['W14', 10.5,14.8,  1.2,  9.9],
  ['W13', 11.9,14.8,  2.4,  9.9],['W12', 14.5,14.8,  2.4,  9.9],
  ['W11', 17.0,14.8,  2.4,  9.9],
  ['W10', 20.6,14.8,  2.1,  9.9],['W09', 22.9,14.8,  2.1,  9.9],
  ['W08', 25.2,14.8,  2.1,  9.9],['W07', 27.4,14.8,  2.1,  9.9],
  ['W06', 29.7,14.8,  2.1,  9.9],['W05', 32.0,14.8,  2.1,  9.9],
  ['W04', 34.3,14.8,  2.1,  9.9],['W03', 36.6,14.8,  2.1,  9.9],
  ['W01', 38.8,13.1,  3.5,  5.9],
  ['W16', 10.5,28.9,  2.2, 10.7],['W17', 12.9,28.9,  2.2, 10.7],
  ['W18', 15.3,28.9,  2.2, 10.7],['W19', 17.7,28.9,  2.2, 10.7],
  ['W20', 20.6,28.9,  1.9, 10.7],['W21', 22.7,28.9,  1.9, 10.7],
  ['W22', 24.8,28.9,  1.9, 10.7],['W23', 27.0,28.9,  1.9, 10.7],
  ['W24', 29.1,28.9,  1.9, 10.7],['W25', 31.2,28.9,  1.9, 10.7],
  ['W26', 33.3,28.9,  1.9, 10.7],['W27', 35.4,28.9,  1.9, 10.7],
  ['W02', 38.8,28.9,  3.5,  6.0],
  ['W34', 10.5,41.6,  2.5, 10.5],['W33', 13.1,41.6,  2.5, 10.5],
  ['W32', 15.8,41.6,  2.5, 10.5],['W31', 18.4,41.6,  2.5, 10.5],
  ['W30', 21.0,41.6,  2.5, 10.5],['W29', 23.7,41.6,  2.5, 10.5],
  ['W28', 35.1,41.6,  3.1, 10.5],
  ['EX',  38.8,36.0,  2.8,  7.1],
  ['W35', 22.2,59.6,  3.5,  6.8],

  // S zone
  ['S05', 42.5,12.0,  2.9, 13.1],['S04', 45.6,12.0,  2.5, 13.1],
  ['S03', 48.3,12.0,  2.5, 13.1],['S02', 51.0,12.0,  2.5, 13.1],
  ['S01', 53.6,12.0,  2.5, 13.1],
  ['S06', 42.5,28.7,  2.4, 14.1],['S07', 45.0,28.7,  2.4, 14.1],
  ['S08', 47.6,28.7,  2.4, 14.1],['S09', 50.2,28.7,  2.4, 14.1],
  ['S10', 52.7,28.7,  2.4, 14.1],['S11', 55.3,28.7,  1.6, 14.1],
  ['S19', 42.5,44.4,  1.7, 11.1],['S18', 44.4,44.4,  1.7, 11.1],
  ['S17', 46.2,44.4,  1.7, 11.1],['S16', 48.1,44.4,  1.7, 11.1],
  ['S15', 50.0,44.4,  1.7, 11.1],['S14', 51.9,44.4,  1.7, 11.1],
  ['S13', 53.8,44.4,  1.7, 11.1],['S12', 55.6,44.4,  1.7, 11.1],
  ['S20', 42.5,58.7,  1.4, 13.5],['S21', 43.9,58.7,  1.4, 13.5],
  ['S22', 45.4,58.7,  1.4, 13.5],['S23', 46.9,58.7,  1.4, 13.5],
  ['S24', 48.4,58.7,  1.4, 13.5],['S25', 49.9,58.7,  1.4, 13.5],
  ['S26', 51.4,58.7,  1.4, 13.5],['S27', 52.8,58.7,  1.4, 13.5],
  ['S28', 54.3,58.7,  1.4, 13.5],['S29', 55.8,58.7,  1.4, 13.5],

  // E zone
  ['E01', 57.0,12.0,  2.3, 13.1],['E02', 59.5,12.0,  2.3, 13.1],
  ['E03', 62.0,12.0,  2.3, 13.1],['E04', 64.4,12.0,  2.3, 13.1],
  ['E05', 66.9,12.0,  2.3, 13.1],['E06', 69.4,12.0,  2.3, 13.1],
  ['E07', 72.8,12.0,  3.1, 13.1],['E08', 76.1,12.0,  3.1, 13.1],
  ['E09', 79.4,12.0,  3.1, 13.1],['E10', 82.6,12.0,  3.1, 13.1],
  ['E11', 86.2,12.0,  1.7, 13.1],['E12', 88.1,12.0,  1.7, 13.1],
  ['E13', 90.0,12.0,  1.7, 13.1],['E14', 91.8,12.0,  1.7, 13.1],
  ['E15', 93.7,12.0,  1.7, 13.1],['E16', 95.6,12.0,  1.7, 13.1],
  ['E17', 97.5,12.0,  1.1, 13.1],['E18', 98.7,12.0,  1.2, 20.3],
  ['E35', 57.0,28.7,  2.3, 14.1],['E34', 59.5,28.7,  2.3, 14.1],
  ['E33', 62.0,28.7,  2.3, 14.1],['E32', 64.4,28.7,  2.3, 14.1],
  ['E31', 66.9,28.7,  2.3, 14.1],['E30', 69.4,28.7,  2.3, 14.1],
  ['E29', 72.8,28.7,  2.4, 14.1],['E28', 75.4,28.7,  2.4, 14.1],
  ['E27', 77.9,28.7,  2.4, 14.1],['E26', 80.5,28.7,  2.4, 14.1],
  ['E25', 83.0,28.7,  2.4, 14.1],['E24', 85.6,28.7,  2.4, 14.1],
  ['E23', 88.2,28.7,  2.4, 14.1],['E22', 90.7,28.7,  2.4, 14.1],
  ['E21', 93.3,28.7,  2.4, 14.1],['E20', 95.8,28.7,  2.4, 14.1],
  ['E19', 98.4,28.7,  1.4, 14.1],
  ['E36', 57.0,44.3,  5.5, 11.1],['E37', 62.7,44.3,  5.5, 11.1],
  ['E38', 68.4,44.3,  5.5, 11.1],
  ['E39', 85.0,44.3,  3.8,  9.0],['E40', 89.0,44.3,  3.8,  9.0],
  ['E41', 57.0,73.9,  7.8,  7.5],

  // NH zone
  ['NH01',54.8,57.2,  1.7,  6.0],['NH02',56.6,57.2,  1.7,  6.0],
  ['NH03',58.5,57.2,  1.7,  6.0],['NH04',60.4,57.2,  1.7,  6.0],
  ['NH05',62.2,57.2,  1.7,  6.0],['NH06',64.4,57.2,  1.7,  6.0],
  ['NH07',66.3,57.2,  1.7,  6.0],['NH08',68.2,57.2,  1.7,  6.0],
  ['NH09',70.2,57.2,  1.7,  6.0],['NH10',72.1,57.2,  1.7,  6.0],
  ['NH11',74.0,57.2,  1.7,  6.0],
  ['NH22',54.8,63.5,  1.7,  6.2],['NH21',56.6,63.5,  1.7,  6.2],
  ['NH20',58.5,63.5,  1.7,  6.2],['NH19',60.4,63.5,  1.7,  6.2],
  ['NH18',62.2,63.5,  1.7,  6.2],['NH17',64.4,63.5,  1.7,  6.2],
  ['NH16',66.3,63.5,  1.7,  6.2],['NH15',68.2,63.5,  1.7,  6.2],
  ['NH14',70.2,63.5,  1.7,  6.2],['NH13',72.1,63.5,  1.7,  6.2],
  ['NH12',74.0,63.5,  1.7,  6.2],
  ['NH23',54.8,70.5,  1.7,  5.9],['NH24',56.6,70.5,  1.7,  5.9],
  ['NH25',58.5,70.5,  1.7,  5.9],['NH26',60.4,70.5,  1.7,  5.9],
  ['NH27',62.2,70.5,  1.7,  5.9],['NH28',64.4,70.5,  1.7,  5.9],
  ['NH29',66.3,70.5,  1.7,  5.9],['NH30',68.2,70.5,  1.7,  5.9],
  ['NH31',70.2,70.5,  1.7,  5.9],['NH32',72.1,70.5,  1.7,  5.9],
  ['NH33',74.0,70.5,  1.7,  5.9],
  ['NH34',54.8,76.9,  1.7,  4.9],['NH35',56.6,76.9,  1.7,  4.9],
  ['NH36',58.5,76.9,  1.7,  4.9],['NH37',60.4,76.9,  1.7,  4.9],
  ['NH38',62.2,76.9,  1.7,  4.9],['NH39',64.4,76.9,  1.7,  4.9],

  // P zone
  ['P01', 11.9,43.8, 10.0,  6.8],
  ['P06',  5.2,50.7,  2.2,  4.7],['P07',  5.2,55.7,  2.2,  4.7],
  ['P08',  5.2,61.1,  2.2,  4.9],
  ['P05',  7.7,50.7,  3.8,  7.4],['P04', 11.7,50.7,  3.8,  7.4],
  ['P03', 15.7,50.7,  3.8,  7.4],['P02', 19.6,50.7,  2.3,  7.4],
  ['P09',  7.7,60.1,  3.8,  7.4],['P10', 11.7,60.1,  3.8,  7.4],
  ['P11', 15.7,60.1,  3.8,  7.4],['P12', 19.6,60.1,  2.3,  7.4],
];

export default function FarmMap() {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Field | null>(null);
  const [updating, setUpdating] = useState(false);
  const [tooltip, setTooltip] = useState<{ code: string; x: number; y: number } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { toast } = useToast();

  // zoom / pan
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const [, rerender] = useState(0);
  const isDragging = useRef(false);
  const hasDragged = useRef(false);
  const dragOrigin = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  // refs for canvas rendering
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const hoveredRef = useRef<string | null>(null);
  const fieldMapRef = useRef<Record<string, Field>>({});

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

  // Update fieldMapRef whenever fields changes
  useEffect(() => {
    fieldMapRef.current = Object.fromEntries(fields.map(f => [f.field_code, f]));
  }, [fields]);

  // ─── Canvas drawing ──────────────────────────────────────────────────────
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.complete) return;

    const W = canvas.width;
    const H = canvas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, W, H);

    const fmap = fieldMapRef.current;
    const hovered = hoveredRef.current;
    const selCode = selected?.field_code ?? null;

    for (const [code, xPct, yPct, wPct, hPct] of LAYOUT) {
      const f = fmap[code];
      const status = f?.status ?? 'Not Started';

      if (statusFilter !== 'all' && status !== statusFilter) continue;

      const px = xPct / 100 * W;
      const py = yPct / 100 * H;
      const pw = wPct / 100 * W;
      const ph = hPct / 100 * H;

      const isHovered = hovered === code;
      const isSel = selCode === code;
      const col = STATUS_COLOR[status] ?? '#64748b';

      ctx.save();
      ctx.globalAlpha = isSel ? 0.88 : isHovered ? 0.78 : 0.62;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 3);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.strokeStyle = isSel ? '#fff' : isHovered ? '#fff' : 'rgba(0,0,0,0.5)';
      ctx.lineWidth = isSel ? 2.5 : isHovered ? 1.5 : 1;
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 3);
      ctx.stroke();
      ctx.restore();

      // Label — only if big enough
      if (pw > 14 && ph > 10) {
        const fs = Math.min(12, Math.max(7, pw / code.length * 1.4));
        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${fs}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 3;
        ctx.fillText(code, px + pw / 2, py + ph / 2);
        ctx.restore();
      }
    }
  }, [selected, statusFilter]);

  // Re-draw when state changes
  useEffect(() => { drawCanvas(); }, [drawCanvas, fields]);

  // Resize canvas to match displayed image size
  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const rect = img.getBoundingClientRect();
    if (rect.width > 0 && (canvas.width !== Math.round(rect.width) || canvas.height !== Math.round(rect.height))) {
      canvas.width = Math.round(rect.width);
      canvas.height = Math.round(rect.height);
      drawCanvas();
    }
  }, [drawCanvas]);

  useEffect(() => {
    const obs = new ResizeObserver(syncCanvasSize);
    if (imgRef.current) obs.observe(imgRef.current);
    return () => obs.disconnect();
  }, [syncCanvasSize]);

  // ─── Native wheel for zoom ────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
      const newZoom = Math.max(0.5, Math.min(12, zoomRef.current * factor));
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      panRef.current = {
        x: cx - (cx - panRef.current.x) * (newZoom / zoomRef.current),
        y: cy - (cy - panRef.current.y) * (newZoom / zoomRef.current),
      };
      zoomRef.current = newZoom;
      rerender(n => n + 1);
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ─── Canvas mouse events ─────────────────────────────────────────────────
  function getHitField(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const W = canvas.width;
    const H = canvas.height;
    for (const [code, xPct, yPct, wPct, hPct] of LAYOUT) {
      const px = xPct / 100 * W;
      const py = yPct / 100 * H;
      const pw = wPct / 100 * W;
      const ph = hPct / 100 * H;
      if (mx >= px && mx <= px + pw && my >= py && my <= py + ph) return code;
    }
    return null;
  }

  function onCanvasMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (isDragging.current) return;
    const code = getHitField(e);
    if (code !== hoveredRef.current) {
      hoveredRef.current = code;
      drawCanvas();
    }
    if (code) {
      const rect = canvasRef.current!.getBoundingClientRect();
      setTooltip({ code, x: e.clientX - rect.left, y: e.clientY - rect.top });
    } else {
      setTooltip(null);
    }
  }

  function onCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (hasDragged.current) return;
    const code = getHitField(e);
    if (!code) return;
    const f = fieldMapRef.current[code];
    if (f) {
      setSelected(f);
    } else {
      setSelected({
        id: '', field_code: code, area_m2: FIELD_AREA[code] ?? 0,
        status: 'Not Started', planned_transplant_date: null,
        actual_transplant_date: null, polygon: null,
        center_lat: null, center_lng: null,
        created_at: '', updated_at: '', user_id: '',
      } as Field);
    }
  }

  function onCanvasLeave() {
    hoveredRef.current = null;
    setTooltip(null);
    drawCanvas();
  }

  // ─── Drag / pan ─────────────────────────────────────────────────────────
  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    isDragging.current = true;
    hasDragged.current = false;
    dragOrigin.current = { mx: e.clientX, my: e.clientY, px: panRef.current.x, py: panRef.current.y };
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!isDragging.current) return;
    const dx = e.clientX - dragOrigin.current.mx;
    const dy = e.clientY - dragOrigin.current.my;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDragged.current = true;
    panRef.current = { x: dragOrigin.current.px + dx, y: dragOrigin.current.py + dy };
    rerender(n => n + 1);
  }

  function onMouseUp() { isDragging.current = false; }

  function zoomBy(f: number) {
    zoomRef.current = Math.max(0.5, Math.min(12, zoomRef.current * f));
    rerender(n => n + 1);
  }

  function resetView() {
    zoomRef.current = 1; panRef.current = { x: 0, y: 0 };
    rerender(n => n + 1);
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

  const zoom = zoomRef.current;
  const pan = panRef.current;

  // Counts by status
  const statusCounts = Object.fromEntries(
    FIELD_STATUSES.map(s => [s, fields.filter(f => f.status === s).length])
  );

  if (loading) {
    return (
      <div className="p-8 animate-pulse space-y-4">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-[600px] bg-muted rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Farm Map</h1>
        <p className="text-muted-foreground text-xs mt-0.5">Farm Lert Phan 2 · scroll to zoom · drag to pan · click field to edit</p>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1 rounded-full border transition-colors ${statusFilter === 'all' ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}
        >
          All ({fields.length})
        </button>
        {FIELD_STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full border transition-colors ${statusFilter === s ? 'text-white border-transparent' : 'border-border text-muted-foreground hover:text-foreground'}`}
            style={statusFilter === s ? { background: STATUS_COLOR[s] } : {}}
          >
            <span className="inline-block w-2 h-2 rounded-sm mr-1.5 align-middle" style={{ background: STATUS_COLOR[s] }} />
            {s} ({statusCounts[s] ?? 0})
          </button>
        ))}
      </div>

      <div className="flex gap-4 items-start">
        {/* Map area */}
        <div className="flex-1 flex flex-col gap-2">
          {/* Zoom toolbar */}
          <div className="flex items-center gap-2">
            <button onClick={() => zoomBy(1.3)} className="p-1.5 rounded border border-border bg-card hover:bg-muted" title="Zoom in"><ZoomIn className="w-4 h-4" /></button>
            <button onClick={() => zoomBy(1/1.3)} className="p-1.5 rounded border border-border bg-card hover:bg-muted" title="Zoom out"><ZoomOut className="w-4 h-4" /></button>
            <button onClick={resetView} className="p-1.5 rounded border border-border bg-card hover:bg-muted" title="Reset"><Maximize2 className="w-4 h-4" /></button>
            <span className="text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
          </div>

          {/* Map viewport */}
          <div
            ref={containerRef}
            className="overflow-hidden rounded-lg border border-border bg-black select-none"
            style={{ height: '72vh', cursor: isDragging.current ? 'grabbing' : 'grab' }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            {/* Zoom/pan wrapper */}
            <div
              style={{
                position: 'absolute',
                top: '50%', left: '50%',
                transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
                transformOrigin: 'center center',
              }}
            >
              {/* Image + canvas overlay together */}
              <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src="/farm-map.jpg"
                  alt="Farm aerial map"
                  style={{ display: 'block', maxWidth: '90vw', maxHeight: '65vh', userSelect: 'none' }}
                  onLoad={syncCanvasSize}
                  draggable={false}
                />
                {/* Canvas exactly covers the image */}
                <canvas
                  ref={canvasRef}
                  style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}
                  onMouseMove={onCanvasMouseMove}
                  onClick={onCanvasClick}
                  onMouseLeave={onCanvasLeave}
                />
                {/* Tooltip */}
                {tooltip && (() => {
                  const f = fieldMapRef.current[tooltip.code];
                  const status = f?.status ?? 'Not Started';
                  return (
                    <div
                      style={{
                        position: 'absolute',
                        left: tooltip.x + 12,
                        top: tooltip.y - 10,
                        pointerEvents: 'none',
                        zIndex: 20,
                        background: 'rgba(0,0,0,0.85)',
                        color: '#fff',
                        fontSize: 11,
                        padding: '6px 10px',
                        borderRadius: 6,
                        lineHeight: 1.5,
                        whiteSpace: 'nowrap',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                      }}
                    >
                      <strong>{tooltip.code}</strong>
                      <span
                        style={{
                          display: 'inline-block',
                          marginLeft: 6,
                          fontSize: 10,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: STATUS_COLOR[status],
                          color: '#fff',
                        }}
                      >{status}</span>
                      {f && <div style={{ fontSize: 10, color: '#ccc', marginTop: 2 }}>{Number(f.area_m2).toLocaleString()} m²</div>}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        {selected && (
          <div className="w-56 shrink-0 rounded-lg border border-border bg-card p-4 space-y-3 self-start sticky top-4 text-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">{selected.field_code}</h2>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Area</span>
                <span className="font-medium">{Number(selected.area_m2).toLocaleString()} m²</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Status</span>
                <span className="inline-block text-[10px] px-2 py-0.5 rounded text-white" style={{ background: STATUS_COLOR[selected.status] }}>
                  {selected.status}
                </span>
              </div>
              {selected.planned_transplant_date && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Planned</span>
                  <span>{selected.planned_transplant_date}</span>
                </div>
              )}
              {selected.actual_transplant_date && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Actual</span>
                  <span>{selected.actual_transplant_date}</span>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Change Status</p>
              {selected.id ? (
                <Select value={selected.status} onValueChange={v => changeStatus(selected.id, v as FieldStatus)} disabled={updating}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIELD_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-xs text-amber-500">Not in database</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
