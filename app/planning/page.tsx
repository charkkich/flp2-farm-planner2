'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type Field } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarCheck, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays, parseISO } from 'date-fns';

export default function PlanningPage() {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPlanned, setEditPlanned] = useState('');
  const [editActual, setEditActual] = useState('');
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

  function startEdit(field: Field) {
    setEditingId(field.id);
    setEditPlanned(field.planned_transplant_date ?? '');
    setEditActual(field.actual_transplant_date ?? '');
  }

  async function saveEdit(field: Field) {
    const updates: Partial<Pick<Field, 'planned_transplant_date' | 'actual_transplant_date'>> = {};
    updates.planned_transplant_date = editPlanned || null;
    updates.actual_transplant_date = editActual || null;

    const { error } = await supabase.from('fields').update(updates).eq('id', field.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Updated', description: `${field.field_code} planning dates saved.` });
    setEditingId(null);
    loadFields();
  }

  const readyFields = fields.filter(f => f.status === 'Ready For Transplant');
  const inProgress = fields.filter(f => ['Plowing', 'Harrowing', 'Ridging'].includes(f.status));

  const today = new Date();
  const overdueCount = readyFields.filter(f => {
    if (!f.planned_transplant_date) return false;
    return parseISO(f.planned_transplant_date) < today;
  }).length;

  const upcomingCount = readyFields.filter(f => {
    if (!f.planned_transplant_date) return false;
    const diff = differenceInDays(parseISO(f.planned_transplant_date), today);
    return diff >= 0 && diff <= 7;
  }).length;

  const transplantedCount = fields.filter(f => f.actual_transplant_date).length;

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (<div key={i} className="h-24 bg-muted rounded-lg" />))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Planning</h1>
        <p className="text-muted-foreground text-sm mt-1">Schedule transplant dates and track progress</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-sky-500/10 p-2.5 rounded-lg">
              <CalendarCheck className="w-5 h-5 text-sky-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ready to Transplant</p>
              <p className="text-xl font-bold">{readyFields.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-amber-500/10 p-2.5 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Overdue</p>
              <p className="text-xl font-bold">{overdueCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-emerald-500/10 p-2.5 rounded-lg">
              <Clock className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">This Week</p>
              <p className="text-xl font-bold">{upcomingCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Transplanted</p>
              <p className="text-xl font-bold">{transplantedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ready for Transplant */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-sky-500" />
            Ready for Transplant
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field Code</TableHead>
                <TableHead>Area (m²)</TableHead>
                <TableHead>Planned Transplant Date</TableHead>
                <TableHead>Actual Transplant Date</TableHead>
                <TableHead>Days Until/Overdue</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {readyFields.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No fields are ready for transplant yet.
                  </TableCell>
                </TableRow>
              ) : (
                readyFields.map(field => {
                  const isEditing = editingId === field.id;
                  const isOverdue = field.planned_transplant_date && parseISO(field.planned_transplant_date) < today;
                  const daysDiff = field.planned_transplant_date
                    ? differenceInDays(parseISO(field.planned_transplant_date), today)
                    : null;

                  return (
                    <TableRow key={field.id}>
                      <TableCell className="font-medium">{field.field_code}</TableCell>
                      <TableCell>{Number(field.area_m2).toLocaleString()}</TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input type="date" value={editPlanned} onChange={e => setEditPlanned(e.target.value)} className="w-40" />
                        ) : field.planned_transplant_date ? (
                          format(parseISO(field.planned_transplant_date), 'MMM d, yyyy')
                        ) : (
                          <span className="text-muted-foreground">Not set</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input type="date" value={editActual} onChange={e => setEditActual(e.target.value)} className="w-40" />
                        ) : field.actual_transplant_date ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            {format(parseISO(field.actual_transplant_date), 'MMM d, yyyy')}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Pending</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {field.actual_transplant_date ? (
                          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-200">Done</Badge>
                        ) : daysDiff !== null ? (
                          <Badge variant={isOverdue ? 'destructive' : 'secondary'} className={isOverdue ? '' : 'bg-sky-500/10 text-sky-600 border-sky-200'}>
                            {isOverdue ? `${Math.abs(daysDiff)}d overdue` : daysDiff === 0 ? 'Today' : `${daysDiff}d left`}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" onClick={() => saveEdit(field)}>Save</Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => startEdit(field)}>
                            <CalendarCheck className="w-3.5 h-3.5 mr-1" /> Schedule
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* In Progress */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            In Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field Code</TableHead>
                <TableHead>Area (m²)</TableHead>
                <TableHead>Current Status</TableHead>
                <TableHead>Planned Transplant Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inProgress.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No fields currently in preparation.
                  </TableCell>
                </TableRow>
              ) : (
                inProgress.map(field => {
                  const isEditing = editingId === field.id;
                  return (
                    <TableRow key={field.id}>
                      <TableCell className="font-medium">{field.field_code}</TableCell>
                      <TableCell>{Number(field.area_m2).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{field.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input type="date" value={editPlanned} onChange={e => setEditPlanned(e.target.value)} className="w-40" />
                        ) : field.planned_transplant_date ? (
                          format(parseISO(field.planned_transplant_date), 'MMM d, yyyy')
                        ) : (
                          <span className="text-muted-foreground">Not set</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" onClick={() => saveEdit(field)}>Save</Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => startEdit(field)}>
                            <CalendarCheck className="w-3.5 h-3.5 mr-1" /> Schedule
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
