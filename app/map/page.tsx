'use client';

import dynamic from 'next/dynamic';

const FarmMap = dynamic(() => import('@/components/farm-map'), {
  ssr: false,
  loading: () => (
    <div className="p-8">
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-[600px] bg-muted rounded-lg" />
      </div>
    </div>
  ),
});

export default function MapPage() {
  return <FarmMap />;
}
