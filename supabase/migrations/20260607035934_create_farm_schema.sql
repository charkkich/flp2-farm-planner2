-- Fields table
CREATE TABLE fields (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  field_code TEXT NOT NULL,
  area_m2 NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Not Started' CHECK (status IN ('Not Started', 'Plowing', 'Harrowing', 'Ridging', 'Ready For Transplant')),
  planned_transplant_date DATE,
  actual_transplant_date DATE,
  polygon JSONB,
  center_lat NUMERIC,
  center_lng NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id)
);

-- Weather forecasts table
CREATE TABLE weather_forecasts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  forecast_date DATE NOT NULL,
  temp_high NUMERIC,
  temp_low NUMERIC,
  rain_probability NUMERIC CHECK (rain_probability >= 0 AND rain_probability <= 100),
  rainfall_mm NUMERIC,
  humidity NUMERIC,
  wind_speed NUMERIC,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_forecasts ENABLE ROW LEVEL SECURITY;

-- Fields RLS policies
CREATE POLICY "select_own_fields" ON fields FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_fields" ON fields FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_fields" ON fields FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_fields" ON fields FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Weather is public read
CREATE POLICY "select_weather" ON weather_forecasts FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_weather" ON weather_forecasts FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_weather" ON weather_forecasts FOR UPDATE
  TO authenticated USING (true);
CREATE POLICY "delete_weather" ON weather_forecasts FOR DELETE
  TO authenticated USING (true);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fields_updated_at
  BEFORE UPDATE ON fields
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
