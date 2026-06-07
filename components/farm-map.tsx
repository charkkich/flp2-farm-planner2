'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, type Field, STATUS_COLORS } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Plus, Trash2, Save, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import {
  MapContainer,
  TileLayer,
  Polygon,
  Popup,
  useMapEvents,
} from 'react-leaflet';

import 'leaflet/dist/leaflet.css';

const statusLeafletColor: Record<string, string> = {
  'Not Started': '#94a3b8',
  'Plowing': '#f59e0b',
  'Harrowing': '#f97316',
  'Ridging': '#10b981',
  'Ready For Transplant': '#0ea5e9',
};

const DEFAULT_CENTER: [number, number] = [18.7883, 98.9853];
const DEFAULT_ZOOM = 13;

function MapClickHandler({ onMapClick, drawing }: { onMapClick: (lat: number, lng: number) => void; drawing: boolean }) {
  useMapEvents({
    click(e) {
      if (drawing) onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function FarmMap() {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [drawingFieldId, setDrawingFieldId] = useState<string | null>(null);
  const [currentPoints, setCurrentPoints] = useState<[number, number][]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newFieldCode, setNewFieldCode] = useState('');
  const [newFieldArea, setNewFieldArea] = useState('');
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const { toast } = useToast();

  const loadFields = useCallback(async () => {
    const { data } = await supabase.from('fields').select('*').order('field_code');
    if (data) setFields(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadFields(); }, [loadFields]);

  function handleMapClick(lat: number, lng: number) {
    if (!drawing) return;
    setCurrentPoints(prev => [...prev, [lat, lng]]);
  }

  function startDrawingForNew() {
    setNewFieldCode('');
    setNewFieldArea('');
    setCurrentPoints([]);
    setDrawing(true);
    setDrawingFieldId(null);
  }

  function startDrawingForExisting(field: Field) {
    setCurrentPoints(field.polygon ? (field.polygon as [number, number][]) : []);
    setDrawing(true);
    setDrawingFieldId(field.id);
  }

  async function saveNewField() {
    if (!newFieldCode.trim() || currentPoints.length < 3) {
      toast({ title: 'Error', description: 'Field code and at least 3 polygon points are required.', variant: 'destructive' });
      return;
    }

    const center = currentPoints.reduce(
      (acc, p) => [acc[0] + p[0], acc[1] + p[1]],
      [0, 0] as [number, number]
    );
    const avgLat = center[0] / currentPoints.length;
    const avgLng = center[1] / currentPoints.length;

    const { error } = await supabase.from('fields').insert({
      field_code: newFieldCode.trim(),
      area_m2: parseFloat(newFieldArea) || 0,
      status: 'Not Started',
      polygon: currentPoints,
      center_lat: avgLat,
      center_lng: avgLng,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Field Created', description: `${newFieldCode} with polygon saved.` });
    setDrawing(false);
    setCurrentPoints([]);
    setDialogOpen(false);
    loadFields();
  }

  async function savePolygon() {
    if (!drawingFieldId || currentPoints.length < 3) {
      toast({ title: 'Error', description: 'At least 3 points needed for a polygon.', variant: 'destructive' });
      return;
    }

    const center = currentPoints.reduce(
      (acc, p) => [acc[0] + p[0], acc[1] + p[1]],
      [0, 0] as [number, number]
    );
    const avgLat = center[0] / currentPoints.length;
    const avgLng = center[1] / currentPoints.length;

    const { error } = await supabase.from('fields').update({
      polygon: currentPoints,
      center_lat: avgLat,
      center_lng: avgLng,
    }).eq('id', drawingFieldId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Polygon Saved', description: 'Field boundary updated.' });
    setDrawing(false);
    setDrawingFieldId(null);
    setCurrentPoints([]);
    loadFields();
  }

  async function removePolygon(fieldId: string) {
    const { error } = await supabase.from('fields').update({
      polygon: null,
      center_lat: null,
      center_lng: null,
    }).eq('id', fieldId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Polygon Removed', description: 'Field boundary removed.' });
    loadFields();
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-[600px] bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Farm Map</h1>
          <p className="text-muted-foreground text-sm mt-1">View and manage field boundaries</p>
        </div>
        <div className="flex gap-2">
          {drawing ? (
            <>
              <Button variant="outline" onClick={() => { setDrawing(false); setCurrentPoints([]); setDrawingFieldId(null); }}>
                Cancel
              </Button>
              {drawingFieldId ? (
                <Button onClick={savePolygon} className="gap-2">
                  <Save className="w-4 h-4" /> Save Polygon
                </Button>
              ) : (
                <Button onClick={() => setDialogOpen(true)} className="gap-2">
                  <Save className="w-4 h-4" /> Finish & Save Field
                </Button>
              )}
            </>
          ) : (
            <Button onClick={startDrawingForNew} className="gap-2">
              <Plus className="w-4 h-4" /> Draw New Field
            </Button>
          )}
        </div>
      </div>

      {drawing && (
        <Card className="border-sky-500/30 bg-sky-500/5">
          <CardContent className="py-3 flex items-center gap-3">
            <MapPin className="w-5 h-5 text-sky-500 animate-pulse" />
            <p className="text-sm">
              <span className="font-medium">Drawing mode active.</span>{' '}
              Click on the map to add polygon points. {currentPoints.length} point{currentPoints.length !== 1 ? 's' : ''} placed.
            </p>
            {currentPoints.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setCurrentPoints(prev => prev.slice(0, -1))}>
                Undo Last Point
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 h-[600px] rounded-lg overflow-hidden border border-border">
          <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {fields.filter(f => f.polygon).map(field => (
              <Polygon
                key={field.id}
                positions={field.polygon as [number, number][]}
                pathOptions={{
                  color: statusLeafletColor[field.status] ?? '#94a3b8',
                  fillColor: statusLeafletColor[field.status] ?? '#94a3b8',
                  fillOpacity: 0.3,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="p-1">
                    <p className="font-semibold">{field.field_code}</p>
                    <p className="text-sm text-gray-600">{Number(field.area_m2).toLocaleString()} m²</p>
                    <p className="text-sm text-gray-600">Status: {field.status}</p>
                  </div>
                </Popup>
              </Polygon>
            ))}
            {drawing && currentPoints.length > 0 && (
              <Polygon
                positions={currentPoints}
                pathOptions={{
                  color: '#0ea5e9',
                  fillColor: '#0ea5e9',
                  fillOpacity: 0.2,
                  weight: 2,
                  dashArray: '5, 10',
                }}
              />
            )}
            <MapClickHandler onMapClick={handleMapClick} drawing={drawing} />
          </MapContainer>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Fields</h2>
          {fields.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                <MapPin className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                No fields yet. Click &quot;Draw New Field&quot; to start.
              </CardContent>
            </Card>
          ) : (
            fields.map(field => (
              <Card key={field.id} className={`border-border/50 ${selectedField?.id === field.id ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setSelectedField(field)}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{field.field_code}</p>
                      <p className="text-xs text-muted-foreground">{Number(field.area_m2).toLocaleString()} m²</p>
                      <Badge variant="secondary" className={`mt-1 text-xs ${STATUS_COLORS[field.status]} text-white`}>
                        {field.status}
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); startDrawingForExisting(field); }}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      {field.polygon && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={(e) => { e.stopPropagation(); removePolygon(field.id); }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save New Field</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Field Code</Label>
              <Input value={newFieldCode} onChange={e => setNewFieldCode(e.target.value)} placeholder="e.g. F-001" />
            </div>
            <div className="space-y-2">
              <Label>Area (m²)</Label>
              <Input type="number" value={newFieldArea} onChange={e => setNewFieldArea(e.target.value)} placeholder="e.g. 5000" />
            </div>
            <p className="text-sm text-muted-foreground">
              {currentPoints.length} polygon points captured from map.
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={saveNewField}>Create Field</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
