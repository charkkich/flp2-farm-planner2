'use client';

import { useEffect, useState } from 'react';
import { supabase, CropPlan } from '@/lib/supabase';

export default function CropPlansPage() {
  const [plans, setPlans] = useState<CropPlan[]>([]);

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    const { data } = await supabase
      .from('crop_plans')
      .select('*')
      .order('planned_plant_date');

    if (data) setPlans(data);
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">
        Crop Plans
      </h1>

      <table className="w-full border">
        <thead>
          <tr>
            <th>CP No</th>
            <th>Crop</th>
            <th>Field</th>
            <th>Rows</th>
            <th>Width</th>
            <th>Plant Date</th>
          </tr>
        </thead>

        <tbody>
          {plans.map(plan => (
            <tr key={plan.id}>
              <td>{plan.cp_no}</td>
              <td>{plan.crop_name}</td>
              <td>{plan.field_code}</td>
              <td>{plan.rows_count}</td>
              <td>{plan.width_m}</td>
              <td>{plan.planned_plant_date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}