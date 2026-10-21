import { useEffect } from 'react';
import { FactoryScene } from './scene/FactoryScene';
import { useUI } from './state/uiStore';
import { Toolbar } from './ui/Toolbar';
import { MetricsPanel } from './ui/MetricsPanel';
import { StationPanel } from './ui/StationPanel';
import { ProductPanel } from './ui/ProductPanel';
import { ControlsOverlay } from './ui/ControlsOverlay';
import { Minimap } from './ui/Minimap';

export function App() {
  const selection = useUI((s) => s.selection);
  const bumpTick = useUI((s) => s.bumpTick);

  // Panels re-read the engine four times a second; the 3D scene reads it every frame.
  useEffect(() => {
    const id = window.setInterval(bumpTick, 250);
    return () => window.clearInterval(id);
  }, [bumpTick]);

  return (
    <div className="app">
      <FactoryScene />
      <Toolbar />
      <MetricsPanel />
      {selection?.type === 'station' && <StationPanel key={selection.id} id={selection.id} />}
      {selection?.type === 'product' && <ProductPanel key={selection.id} id={selection.id} />}
      <Minimap />
      <ControlsOverlay />
    </div>
  );
}
