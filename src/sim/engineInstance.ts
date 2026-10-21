// The single simulation instance shared by the 3D scene and the UI panels.

import { Engine } from './engine';
import { setRuntimeSource } from './runtime';

export const engine = new Engine();
setRuntimeSource(engine);
