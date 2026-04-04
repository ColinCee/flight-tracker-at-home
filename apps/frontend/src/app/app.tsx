export function App() {
  return (
    <div className="h-screen w-screen bg-background text-foreground">
      <main className="relative h-full w-full">
        {/* Map will be rendered here */}
        <div className="flex h-full items-center justify-center text-muted-foreground">
          Flight Tracker — Map loading…
        </div>
      </main>
    </div>
  );
}

export default App;
