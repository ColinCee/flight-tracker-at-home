import { MapView } from '@/components/MapView';
import { useAircraftData } from '@/hooks/useAircraftData';

export function App() {
  const { aircraft } = useAircraftData();

  return (
    <div className="h-screen w-screen bg-background text-foreground">
      <main className="relative h-full w-full">
        <MapView aircraft={aircraft} />
      </main>
    </div>
  );
}

export default App;
