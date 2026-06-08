-- ============================================================
-- FOMS v1.0 — Full Schema Migration
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLE: fields
-- ============================================================
CREATE TABLE IF NOT EXISTS fields (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  field_code TEXT UNIQUE NOT NULL,
  area_m2 NUMERIC,
  polygon JSONB,
  center_lat NUMERIC,
  center_lng NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: workers
-- ============================================================
CREATE TABLE IF NOT EXISTS workers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_name TEXT NOT NULL,
  position TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: machines
-- ============================================================
CREATE TABLE IF NOT EXISTS machines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_code TEXT UNIQUE NOT NULL,
  machine_name TEXT,
  machine_type TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: crop_plans
-- ============================================================
CREATE TABLE IF NOT EXISTS crop_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cp_no TEXT NOT NULL,
  crop_name TEXT,
  field_code TEXT REFERENCES fields(field_code) ON UPDATE CASCADE,
  planned_plant_date DATE,
  actual_plant_date DATE,
  land_prep_date DATE,
  removal_actual_date DATE,
  required_ready_date DATE,
  area_m2 NUMERIC,
  status TEXT DEFAULT 'Planned' CHECK (status IN ('Planned','Preparing','Ready','Planted','Harvested','Overdue')),
  year INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: preparation_tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS preparation_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  crop_plan_id UUID REFERENCES crop_plans(id) ON DELETE CASCADE,
  field_code TEXT,
  task_type TEXT NOT NULL CHECK (task_type IN ('Plowing','Harrowing','Ridging','Ready Inspection')),
  planned_date DATE,
  actual_date DATE,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending','In Progress','Completed','Overdue','Skipped')),
  assigned_worker_id UUID REFERENCES workers(id),
  assigned_machine_id UUID REFERENCES machines(id),
  quality_score NUMERIC CHECK (quality_score >= 0 AND quality_score <= 100),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: weather_forecast
-- ============================================================
CREATE TABLE IF NOT EXISTS weather_forecast (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  forecast_date DATE UNIQUE NOT NULL,
  rain_probability NUMERIC,
  rainfall_mm NUMERIC,
  temp_min NUMERIC,
  temp_max NUMERIC,
  humidity NUMERIC,
  wind_speed NUMERIC,
  description TEXT,
  risk_level TEXT DEFAULT 'Low' CHECK (risk_level IN ('Low','Medium','High')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: quality_inspections
-- ============================================================
CREATE TABLE IF NOT EXISTS quality_inspections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES preparation_tasks(id) ON DELETE CASCADE,
  inspector_name TEXT,
  inspection_date DATE,
  quality_score NUMERIC,
  result TEXT CHECK (result IN ('Pass','Fail','Rework')),
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS Policies (allow all for authenticated + service role)
-- ============================================================
ALTER TABLE fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE crop_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE preparation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_forecast ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all fields" ON fields FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all workers" ON workers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all machines" ON machines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all crop_plans" ON crop_plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all prep_tasks" ON preparation_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all weather" ON weather_forecast FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all quality" ON quality_inspections FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- SEED: Workers
-- ============================================================
INSERT INTO workers (worker_name, position, active) VALUES
  ('Worker A', 'Field Operator', true),
  ('Worker B', 'Field Operator', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED: Machines
-- ============================================================
INSERT INTO machines (machine_code, machine_name, machine_type, active) VALUES
  ('RT120',  'Rotary Tiller 120', 'Rotary Tiller', true),
  ('ZT120',  'Zero Till 120',     'Zero Tiller',   true),
  ('EDI110', 'EDI Ridger 110',    'Ridger',        true),
  ('KWM95',  'Kubota WM 95',      'Tractor',       true)
ON CONFLICT (machine_code) DO NOTHING;

-- ============================================================
-- SEED: Fields (261 unique fields from CSV)
-- ============================================================
INSERT INTO fields (field_code, area_m2) VALUES
  ('T02', 1104),
  ('T03', 1104),
  ('T04', 1104),
  ('T05', 1104),
  ('T10', 1104),
  ('T12', 1104),
  ('T11', 1104),
  ('SS19', 1104),
  ('SS22', 1104),
  ('T06', 1000),
  ('T07', 1000),
  ('T08', 1000),
  ('T09', 1000),
  ('SS17', 1104),
  ('Soi.7 Center1', 240),
  ('C3', 640),
  ('SS20', 1104),
  ('SS21', 1104),
  ('SS30', 640),
  ('SS31', 504),
  ('NH21', 240),
  ('B08', 400),
  ('A6', 768),
  ('P11', 655.36),
  ('P12', 655.36),
  ('S47', 1104),
  ('SS23', 1104),
  ('SS18', 1104),
  ('P06', 387),
  ('P07', 387),
  ('P09', 768),
  ('P10', 655.36),
  ('D1', 691),
  ('D2', 499),
  ('S07', 1196.8),
  ('S08', 1196.8),
  ('S09', 1196.8),
  ('S10', 1196.8),
  ('S11', 1196.8),
  ('C7', 561.6),
  ('C8', 561.6),
  ('C4', 691.2),
  ('C5', 691.2),
  ('C6', 768),
  ('SS32', 512),
  ('T24', 1104),
  ('P08', 750),
  ('B02', 1102),
  ('B03', 1102),
  ('B04', 1102),
  ('B05', 1781),
  ('B06', 1224),
  ('B07', 1224),
  ('S49', 1104),
  ('Mongol 2', 538),
  ('T14', 1104),
  ('T21', 1104),
  ('B01', 1102),
  ('B09', 1611.2),
  ('T25', 1104),
  ('W16', 1104),
  ('NH22', 240),
  ('S48', 1104),
  ('C2', 1200),
  ('E06', 1126.4),
  ('SS01', 1104),
  ('SS02', 1104),
  ('SS05', 1104),
  ('A2', 1638.4),
  ('A3', 1584),
  ('A4', 1689.6),
  ('A5', 1601.6),
  ('S23', 1196.8),
  ('S24', 1196.8),
  ('S25', 1196.8),
  ('T13', 1104),
  ('S34', 768),
  ('B10', 1526),
  ('B11', 1526),
  ('Mongol 3', 538),
  ('SS14', 1104),
  ('T17', 1104),
  ('T18', 1104),
  ('S26', 1196.8),
  ('S27', 1196.8),
  ('S28', 1196.8),
  ('S29', 1196.8),
  ('S30', 1196.8),
  ('P03', 1006.4),
  ('P04', 1006.4),
  ('P05', 1006.4),
  ('T16', 1104),
  ('T27', 1104),
  ('T26', 1104),
  ('T15', 1104),
  ('SS03', 1100),
  ('SS04', 1104),
  ('SS29', 1200),
  ('D3', 384),
  ('D4', 115.2),
  ('D5', 115.2),
  ('SS13', 1104),
  ('SS28', 1104),
  ('SS15', 1104),
  ('NH20', 240),
  ('S37', 1197),
  ('S38', 1197),
  ('P01', 640),
  ('P02', 1006.4),
  ('W19', 1104),
  ('T23', 1104),
  ('T34', 1104),
  ('S05', 1104),
  ('E28', 1126.4),
  ('E26', 1126.4),
  ('S12', 1197),
  ('W11', 1104),
  ('E36', 1104),
  ('E37', 1104),
  ('E38', 1104),
  ('E19', 1126.4),
  ('E33', 1196.8),
  ('E34', 1126.4),
  ('E35', 1126.4),
  ('E32', 1126.4),
  ('E31', 1126.4),
  ('E30', 1126.4),
  ('E39', 1056),
  ('E10', 1126.4),
  ('E11', 1152),
  ('E12', 1152),
  ('E13', 1017.6),
  ('E14', 1200),
  ('E15', 1200),
  ('E27', 1126.4),
  ('E29', 1126.4),
  ('Mongol 1', 538),
  ('S13', 1197),
  ('S14', 1197),
  ('S01', 1104),
  ('S02', 1104),
  ('S03', 1104),
  ('S04', 1104),
  ('W01', 950.4),
  ('W31', 1197),
  ('W32', 1197),
  ('W14', 1104),
  ('E22', 1126.4),
  ('E23', 1126.4),
  ('S06', 1100),
  ('NH15-17', 920),
  ('S15', 1196.8),
  ('S16', 1196.8),
  ('W22', 1104),
  ('W02', 912),
  ('W23', 1104),
  ('W24', 1104),
  ('W25', 1104),
  ('W26', 1104),
  ('W21', 1104),
  ('W20', 350),
  ('NH18', 240),
  ('NH13', 240),
  ('E03', 1126.4),
  ('W30', 1196.8),
  ('W29', 1196.8),
  ('W06', 1104),
  ('A1', 1781),
  ('NH19', 240),
  ('S21', 1100),
  ('S22', 1100),
  ('E24', 562.2),
  ('W07', 1104),
  ('W08', 1104),
  ('NH29', 240),
  ('NH30', 240),
  ('E25', 1126.4),
  ('E20', 1126.4),
  ('Mongol 4', 538),
  ('W33', 1104),
  ('W34', 1104),
  ('E07', 1126.4),
  ('E08', 1126.4),
  ('E09', 1126.4),
  ('NH1-3', 720),
  ('NH4-6', 720),
  ('NH7-9', 720),
  ('E41', 1056),
  ('E40', 1056),
  ('NH23', 240),
  ('NH24', 240),
  ('NH25', 240),
  ('W10', 1104),
  ('W09', 1104),
  ('S19', 1100),
  ('S20', 650),
  ('W27', 1104),
  ('E01', 1126.4),
  ('E02', 1126.4),
  ('NH26', 240),
  ('S17', 1126.4),
  ('S18', 1126.4),
  ('NH14', 192),
  ('NH27', 240),
  ('W28', 500),
  ('NH10-11', 480),
  ('NH20-22', 720),
  ('NH31-33', 720),
  ('E21', 1126),
  ('W17', 1197),
  ('W18', 1197),
  ('W12', 1162),
  ('NH28', 240),
  ('E16', 1152),
  ('E17', 1152),
  ('E18', 1120),
  ('W35', 1104),
  ('W13', 1197),
  ('NH01', 240),
  ('NH02', 240),
  ('NH03', 240),
  ('NH04', 240),
  ('NH12', 240),
  ('W03', 1197),
  ('W04', 1197),
  ('W05', 1197),
  ('W15', 912),
  ('E16-17', 1787),
  ('NH33', 240),
  ('KT1', 608),
  ('KT2', 608),
  ('W36', 500),
  ('NH9,10,11', 720),
  ('NH5,6,7,8', 960),
  ('NH19, 20, 21, 22', 960),
  ('NH15', 232),
  ('NH16', 232),
  ('NH17', 232),
  ('E05', 819.2),
  ('E04', 1126.4),
  ('NH31', 232),
  ('NH32', 232),
  ('EX', 720),
  ('NH07', 232),
  ('NH08', 232),
  ('NH09', 232),
  ('NH10', 232),
  ('NH11', 232),
  ('W37', 880),
  ('NH05', 232),
  ('NH06', 232),
  ('NH37', 232),
  ('NH34', 232),
  ('NH35', 232),
  ('NH36', 232),
  ('NH38', 232),
  ('NH39', 232),
  ('W39', 537.6),
  ('W40', 537.6),
  ('W41', 537.6),
  ('W42', 537.6)
ON CONFLICT (field_code) DO UPDATE SET area_m2 = EXCLUDED.area_m2;

-- ============================================================

SELECT 'Part 1 complete — Schema + Fields seeded' as result;
