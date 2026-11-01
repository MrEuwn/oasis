import { Suspense } from 'react';
import ScannerScreen from '@/components/ScannerScreen';

export default function Page() {
  return (
    <Suspense fallback={<div className="skeleton" />}>
      <ScannerScreen />
    </Suspense>
  );
}
