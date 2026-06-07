'use client';

import { useEffect, useState } from 'react';
import {
  Wheat,
  Ruler,
  CheckCircle2,
  AlertTriangle,
  Umbrella,
  TrendingUp,
  Droplets,
  ThermometerSun,
} from 'lucide-react';
import { supabase, type Field, type WeatherForecast, FIELD_STATUSES } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export default function DashboardPage() {
  const [fields, setFields] = useState<Field[]>([]);
  const [forecasts, setForecasts] = useState<WeatherForecast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [fieldsRes, weatherRes] = await Promise.all([
        supabase.from('fields').select('*').order('field_code'),
        supabase.from('weather_forecasts').select('*').gte('forecast_date', today).order('forecast_date').limit(7),
      ]);

      if (fieldsRes.data) setFields(fieldsRes.data);
      if (weatherRes.data) setForecasts(weatherRes.data);
    } catch {
      // silently handle connection errors
    } finally {
      setLoading(false);
    }
  }

  const totalFields = fields.length;
  const totalArea = fields.reduce((sum, f) => sum + Number(f.area_m2), 0);
  const readyFields = fields.filter(f => f.status === 'Ready For Transplant').length;
  const atRiskFields = fields.filter(f => f.status === 'Not Started').length;

  const rainSafeWindow = (() => {
    if (!forecasts.length) return null;
    let consecutive = 0;
    for (const f of forecasts) {
      if ((f.rain_probability ?? 0) < 30) {
        consecutive++;
      } else {
        break;
      }
    }
    return consecutive;
  })();

  const statusBreakdown = FIELD_STATUSES.map(status => ({
    status,
    count: fields.filter(f => f.status === status).length,
    pct: totalFields > 0 ? (fields.filter(f => f.status === status).length / totalFields) * 100 : 0,
  }));

  const statusColorMap: Record<string, string> = {
    'Not Started': 'bg-slate-400',
    'Plowing': 'bg-amber-500',
    'Harrowing': 'bg-orange-500',
    'Ridging': 'bg-emerald-500',
    'Ready For Transplant': 'bg-sky-500',
  };

  const stats = [
    { title: 'Total Fields', value: totalFields, icon: Wheat, color: 'text-primary', bg: 'bg-primary/10' },
    { title: 'Total Area', value: `${totalArea.toLocaleString()} m\u00B2`, icon: Ruler, color: 'text-accent', bg: 'bg-accent/10' },
    { title: 'Fields Ready', value: readyFields, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Fields At Risk', value: atRiskFields, icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { title: 'Rain Safe Window', value: rainSafeWindow !== null ? `${rainSafeWindow} days` : 'N/A', icon: Umbrella, color: 'text-sky-500', bg: 'bg-sky-500/10' },
  ];

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (<div key={i} className="h-28 bg-muted rounded-lg" />))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of your farm operations</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-border/50">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.title}</p>
                  <p className="text-2xl font-bold mt-2">{stat.value}</p>
                </div>
                <div className={`${stat.bg} p-2.5 rounded-lg`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Field Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {statusBreakdown.map((s) => (
              <div key={s.status} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${statusColorMap[s.status]}`} />
                    <span className="font-medium">{s.status}</span>
                  </div>
                  <span className="text-muted-foreground">{s.count} field{s.count !== 1 ? 's' : ''}</span>
                </div>
                <Progress value={s.pct} className="h-2" />
              </div>
            ))}
            {totalFields === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No fields yet. Add fields to see breakdown.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ThermometerSun className="w-4 h-4 text-amber-500" />
              7-Day Weather Outlook
            </CardTitle>
          </CardHeader>
          <CardContent>
            {forecasts.length > 0 ? (
              <div className="space-y-2.5">
                {forecasts.map((f) => (
                  <div key={f.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium w-28">
                        {new Date(f.forecast_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <ThermometerSun className="w-3.5 h-3.5" />
                        {f.temp_high ?? '--'}/{f.temp_low ?? '--'}°
                      </span>
                      <span className="flex items-center gap-1">
                        <Droplets className="w-3.5 h-3.5 text-sky-400" />
                        {f.rain_probability ?? 0}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No weather data available.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
