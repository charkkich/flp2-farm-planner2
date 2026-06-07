'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, type WeatherForecast } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Droplets, ThermometerSun, Wind, Umbrella, Eye, CloudSun } from 'lucide-react';
import { format, parseISO, addDays } from 'date-fns';

export default function WeatherPage() {
  const [forecasts, setForecasts] = useState<WeatherForecast[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWeather = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('weather_forecasts')
        .select('*')
        .gte('forecast_date', today)
        .order('forecast_date')
        .limit(7);
      if (data) setForecasts(data);
    } catch {
      // silently handle connection errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadWeather(); }, [loadWeather]);

  const avgRainProb = forecasts.length > 0
    ? forecasts.reduce((sum, f) => sum + (f.rain_probability ?? 0), 0) / forecasts.length
    : 0;

  const totalRainfall = forecasts.reduce((sum, f) => sum + (f.rainfall_mm ?? 0), 0);
  const avgTemp = forecasts.length > 0
    ? forecasts.reduce((sum, f) => sum + ((f.temp_high ?? 0) + (f.temp_low ?? 0)) / 2, 0) / forecasts.length
    : 0;

  const rainDays = forecasts.filter(f => (f.rain_probability ?? 0) > 50).length;

  function getRainLevel(prob: number | null): { label: string; color: string } {
    if (prob === null) return { label: 'N/A', color: 'text-muted-foreground' };
    if (prob < 20) return { label: 'Low', color: 'text-emerald-500' };
    if (prob < 50) return { label: 'Moderate', color: 'text-amber-500' };
    if (prob < 80) return { label: 'High', color: 'text-orange-500' };
    return { label: 'Very High', color: 'text-destructive' };
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (<div key={i} className="h-24 bg-muted rounded-lg" />))}
          </div>
          <div className="grid grid-cols-7 gap-4">
            {[...Array(7)].map((_, i) => (<div key={i} className="h-64 bg-muted rounded-lg" />))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Weather</h1>
        <p className="text-muted-foreground text-sm mt-1">7-day forecast and rainfall outlook</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-sky-500/10 p-2.5 rounded-lg">
              <Droplets className="w-5 h-5 text-sky-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg Rain Probability</p>
              <p className="text-xl font-bold">{avgRainProb.toFixed(0)}%</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-emerald-500/10 p-2.5 rounded-lg">
              <Umbrella className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Rainfall</p>
              <p className="text-xl font-bold">{totalRainfall.toFixed(1)} mm</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-amber-500/10 p-2.5 rounded-lg">
              <ThermometerSun className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg Temperature</p>
              <p className="text-xl font-bold">{avgTemp.toFixed(1)}°C</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-orange-500/10 p-2.5 rounded-lg">
              <CloudSun className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rainy Days</p>
              <p className="text-xl font-bold">{rainDays} of 7</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 7-Day Forecast Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4">7-Day Forecast</h2>
        {forecasts.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-12 text-center text-muted-foreground">
              <CloudSun className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              <p>No weather data available yet.</p>
              <p className="text-sm mt-1">Weather forecasts will appear here once data is loaded.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {forecasts.map((f) => {
              const rainLevel = getRainLevel(f.rain_probability);
              const isHighRain = (f.rain_probability ?? 0) > 50;
              return (
                <Card key={f.id} className={`border-border/50 transition-all ${isHighRain ? 'border-sky-500/30 bg-sky-500/5' : ''}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="text-center">
                      <p className="text-xs font-medium text-muted-foreground">
                        {format(parseISO(f.forecast_date), 'EEE')}
                      </p>
                      <p className="text-lg font-bold">
                        {format(parseISO(f.forecast_date), 'd')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(f.forecast_date), 'MMM')}
                      </p>
                    </div>
                    <div className="text-center">
                      {f.description && (
                        <p className="text-xs font-medium text-muted-foreground mb-1">{f.description}</p>
                      )}
                      <div className="flex justify-center gap-1 text-sm">
                        <span className="font-semibold text-foreground">{f.temp_high ?? '--'}°</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-muted-foreground">{f.temp_low ?? '--'}°</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Droplets className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <div className="flex-1">
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${isHighRain ? 'bg-sky-500' : 'bg-sky-400'}`}
                              style={{ width: `${f.rain_probability ?? 0}%` }}
                            />
                          </div>
                        </div>
                        <span className={`text-xs font-medium ${rainLevel.color}`}>
                          {f.rain_probability ?? 0}%
                        </span>
                      </div>
                      {f.rainfall_mm !== null && f.rainfall_mm > 0 && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Umbrella className="w-3 h-3 shrink-0" />
                          <span>{f.rainfall_mm} mm</span>
                        </div>
                      )}
                      {f.humidity !== null && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Eye className="w-3 h-3 shrink-0" />
                          <span>{f.humidity}% humidity</span>
                        </div>
                      )}
                      {f.wind_speed !== null && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Wind className="w-3 h-3 shrink-0" />
                          <span>{f.wind_speed} km/h</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Rainfall Chart */}
      {forecasts.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Droplets className="w-4 h-4 text-sky-500" />
              Rain Probability & Rainfall
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {forecasts.map((f) => (
                <div key={f.id} className="flex items-center gap-4">
                  <span className="text-sm font-medium w-20 shrink-0">
                    {format(parseISO(f.forecast_date), 'EEE, MMM d')}
                  </span>
                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex-1 h-4 rounded bg-muted overflow-hidden">
                      <div
                        className="h-full bg-sky-500/80 rounded transition-all"
                        style={{ width: `${f.rain_probability ?? 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-12 text-right">{f.rain_probability ?? 0}%</span>
                  </div>
                  <span className="text-sm text-muted-foreground w-16 text-right">
                    {f.rainfall_mm ?? 0} mm
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
