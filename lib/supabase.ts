import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type FieldStatus = 'Not Started' | 'Plowing' | 'Harrowing' | 'Ridging' | 'Ready For Transplant';

export interface Field {
  id: string;
  field_code: string;
  area_m2: number;
  status: FieldStatus;
  planned_transplant_date: string | null;
  actual_transplant_date: string | null;
  polygon: [number, number][] | null;
  center_lat: number | null;
  center_lng: number | null;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface WeatherForecast {
  id: string;
  forecast_date: string;
  temp_high: number | null;
  temp_low: number | null;
  rain_probability: number | null;
  rainfall_mm: number | null;
  humidity: number | null;
  wind_speed: number | null;
  description: string | null;
  created_at: string;
}

export const FIELD_STATUSES: FieldStatus[] = [
  'Not Started',
  'Plowing',
  'Harrowing',
  'Ridging',
  'Ready For Transplant',
];

export const STATUS_COLORS: Record<FieldStatus, string> = {
  'Not Started': 'bg-slate-400',
  'Plowing': 'bg-amber-500',
  'Harrowing': 'bg-orange-500',
  'Ridging': 'bg-emerald-500',
  'Ready For Transplant': 'bg-sky-500',
};

export const STATUS_LABELS: Record<FieldStatus, string> = {
  'Not Started': 'Not Started',
  'Plowing': 'Plowing',
  'Harrowing': 'Harrowing',
  'Ridging': 'Ridging',
  'Ready For Transplant': 'Ready',
};

export interface CropPlan {
  id: string;
  cp_no: string;
  crop_name: string;
  field_code: string;
  rows_count: number | null;
  width_m: number | null;
  planned_plant_date: string | null;
  actual_plant_date: string | null;
  remarks: string | null;
  created_at: string;
}
