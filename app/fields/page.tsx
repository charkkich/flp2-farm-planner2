'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type Field, fmtDate } from '@/lib/supabase';

export default function FieldsPage() {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editField, setEditField] = useState<Field|null>(null);
  const [formArea, setFormArea] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('fields').select('*').order('field_code');
    setFields(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = fields.filter(f =>
    !search || f.field_code.toLowerCase().includes(search.toLowerCase())
  );

  async function saveEdit() {
    if (!editField) return;
    setSaving(true);
    const { error } = await supabase.from('fields').update({
      area_m2: parseFloat(formArea) || null,
      updated_at: new Date().toISOString(),
    }).eq('id', editField.id);
    setSaving(false);
    if (error) { setMsg('Error: '+error.message); return; }
    setMsg('บันทึกแล้ว');
    setEditField(null);
    load();
    setTimeout(()=>setMsg(''), 2000);
  }

  if (loading) return (
    <div className="p-4 animate-pulse space-y-2">
      {[...Array(10)].map((_,i)=><div key={i} className="h-10 bg-muted rounded"/>)}
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-base font-bold">Field Management</h1>
          <p className="text-[11px] text-muted-foreground">{fields.length} fields in system</p>
        </div>
        {msg && <span className="text-[11px] text-[#155d31] font-medium">{msg}</span>}
      </div>

      <input type="text" placeholder="Search field code…" value={search}
        onChange={e=>setSearch(e.target.value)}
        className="h-8 px-3 rounded border border-border bg-card text-[11px] w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-[#155d31]"/>

      {/* Edit panel */}
      {editField && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="text-[12px] font-semibold">Edit Field: {editField.field_code}</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-muted-foreground block mb-1">Area (m²)</label>
              <input type="number" value={formArea} onChange={e=>setFormArea(e.target.value)}
                className="w-full h-8 px-2 rounded border border-border bg-background text-[11px] focus:outline-none focus:ring-1 focus:ring-[#155d31]"/>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={saveEdit} disabled={saving}
              className="px-4 py-1.5 rounded bg-[#155d31] text-white text-[11px] font-medium disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={()=>setEditField(null)} className="px-4 py-1.5 rounded border border-border text-[11px]">Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="hidden md:grid gap-2 px-3 py-2 bg-muted/40 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wide"
          style={{gridTemplateColumns:'120px 100px 80px 1fr 80px'}}>
          <div>Field Code</div><div>Area (m²)</div><div>Updated</div><div>Notes</div><div></div>
        </div>
        <div className="divide-y divide-border">
          {filtered.length === 0
            ? <div className="py-8 text-center text-muted-foreground text-sm">No fields found</div>
            : filtered.map(f=>(
            <div key={f.id}
              className="hidden md:grid gap-2 px-3 py-2 items-center text-[11px] hover:bg-muted/20"
              style={{gridTemplateColumns:'120px 100px 80px 1fr 80px'}}>
              <div className="font-mono font-semibold">{f.field_code}</div>
              <div>{f.area_m2 ? f.area_m2.toLocaleString() : '—'}</div>
              <div className="text-muted-foreground">{fmtDate(f.updated_at)}</div>
              <div className="text-muted-foreground truncate">{f.notes || '—'}</div>
              <div>
                <button onClick={()=>{ setEditField(f); setFormArea(String(f.area_m2||'')); }}
                  className="text-[10px] px-2 py-1 rounded border border-border hover:bg-muted">Edit</button>
              </div>
            </div>
          ))}
          {/* Mobile */}
          {filtered.map(f=>(
            <div key={f.id+'-m'} className="md:hidden px-3 py-2.5 flex items-center gap-3"
              onClick={()=>{ setEditField(f); setFormArea(String(f.area_m2||'')); }}>
              <span className="font-mono font-semibold text-[12px] w-16">{f.field_code}</span>
              <span className="flex-1 text-[10px] text-muted-foreground">{f.area_m2 ? f.area_m2.toLocaleString()+' m²' : '—'}</span>
              <span className="text-muted-foreground/50">›</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[10px] text-muted-foreground">Showing {filtered.length} of {fields.length} fields</div>
    </div>
  );
}
