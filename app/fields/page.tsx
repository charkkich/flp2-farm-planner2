'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type Field, type FieldStatus, FIELD_STATUSES, STATUS_COLORS } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Wheat, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function FieldsPage() {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [formData, setFormData] = useState({ field_code: '', area_m2: '', status: 'Not Started' as FieldStatus });
  const { toast } = useToast();

  const loadFields = useCallback(async () => {
    try {
      const { data } = await supabase.from('fields').select('*').order('field_code');
      if (data) setFields(data);
    } catch {
      // silently handle connection errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFields(); }, [loadFields]);

  function openCreate() {
    setEditingField(null);
    setFormData({ field_code: '', area_m2: '', status: 'Not Started' });
    setDialogOpen(true);
  }

  function openEdit(field: Field) {
    setEditingField(field);
    setFormData({
      field_code: field.field_code,
      area_m2: String(field.area_m2),
      status: field.status,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formData.field_code.trim() || !formData.area_m2) {
      toast({ title: 'Validation Error', description: 'Field code and area are required.', variant: 'destructive' });
      return;
    }

    const payload = {
      field_code: formData.field_code.trim(),
      area_m2: parseFloat(formData.area_m2),
      status: formData.status,
    };

    if (editingField) {
      const { error } = await supabase.from('fields').update(payload).eq('id', editingField.id);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Field Updated', description: `${payload.field_code} updated successfully.` });
    } else {
      const { error } = await supabase.from('fields').insert(payload);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Field Created', description: `${payload.field_code} created successfully.` });
    }

    setDialogOpen(false);
    loadFields();
  }

  async function handleDelete(id: string, code: string) {
    const { error } = await supabase.from('fields').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Field Deleted', description: `${code} has been removed.` });
    loadFields();
  }

  async function updateStatus(field: Field, newStatus: FieldStatus) {
    const { error } = await supabase.from('fields').update({ status: newStatus }).eq('id', field.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Status Updated', description: `${field.field_code} is now ${newStatus}.` });
    loadFields();
  }

  const filteredFields = fields.filter(f =>
    f.field_code.toLowerCase().includes(search.toLowerCase())
  );

  const statusOrder: Record<FieldStatus, number> = {
    'Not Started': 0,
    'Plowing': 1,
    'Harrowing': 2,
    'Ridging': 3,
    'Ready For Transplant': 4,
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-muted rounded" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Field Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your farm fields and their preparation status</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="w-4 h-4" /> Add Field
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingField ? 'Edit Field' : 'Add New Field'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="field_code">Field Code</Label>
                <Input
                  id="field_code"
                  placeholder="e.g. F-001"
                  value={formData.field_code}
                  onChange={e => setFormData(prev => ({ ...prev, field_code: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="area_m2">Area (m²)</Label>
                <Input
                  id="area_m2"
                  type="number"
                  placeholder="e.g. 5000"
                  value={formData.area_m2}
                  onChange={e => setFormData(prev => ({ ...prev, area_m2: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData(prev => ({ ...prev, status: v as FieldStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIELD_STATUSES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button onClick={handleSave}>{editingField ? 'Save Changes' : 'Create Field'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {FIELD_STATUSES.map(status => {
          const count = fields.filter(f => f.status === status).length;
          return (
            <Card key={status} className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[status]}`} />
                <div>
                  <p className="text-xs text-muted-foreground">{status}</p>
                  <p className="text-lg font-bold">{count}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search fields..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card className="border-border/50">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field Code</TableHead>
                <TableHead>Area (m²)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFields.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    {fields.length === 0 ? (
                      <div className="flex flex-col items-center gap-2">
                        <Wheat className="w-8 h-8 text-muted-foreground/50" />
                        <p>No fields yet. Click &quot;Add Field&quot; to get started.</p>
                      </div>
                    ) : (
                      'No fields match your search.'
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredFields.map(field => (
                  <TableRow key={field.id}>
                    <TableCell className="font-medium">{field.field_code}</TableCell>
                    <TableCell>{Number(field.area_m2).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`${STATUS_COLORS[field.status]} text-white gap-1.5`}>
                        {field.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                          {FIELD_STATUSES.map((s, i) => (
                            <div
                              key={s}
                              className={`w-6 h-1.5 rounded-full transition-colors ${
                                i <= statusOrder[field.status]
                                  ? STATUS_COLORS[FIELD_STATUSES[i]]
                                  : 'bg-muted'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {statusOrder[field.status] + 1}/{FIELD_STATUSES.length}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {statusOrder[field.status] < 4 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateStatus(field, FIELD_STATUSES[statusOrder[field.status] + 1])}
                            className="text-xs"
                          >
                            Advance
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openEdit(field)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(field.id, field.field_code)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
