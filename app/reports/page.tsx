export default function ReportsPage() {
  return (
    <div className="p-8 text-center space-y-4">
      <div className="text-4xl">📊</div>
      <h1 className="text-lg font-bold">Reports & KPI</h1>
      <p className="text-muted-foreground text-sm max-w-md mx-auto">
        Phase 5 — Preparation Lead Time, Plan vs Actual, Rain Delay Analysis, Worker KPI, Machine KPI.
        Coming soon.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-lg mx-auto mt-4 text-left">
        {['Preparation Lead Time','Plan vs Actual Plant Date','Rain Delay Analysis','Worker KPI','Machine KPI','Field Utilization'].map(r=>(
          <div key={r} className="bg-muted rounded-lg p-3 text-[11px] text-muted-foreground">{r}</div>
        ))}
      </div>
    </div>
  );
}
