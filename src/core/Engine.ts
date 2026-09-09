import { AbstractEngine, Engine, WebGPUEngine } from '@babylonjs/core';

export async function createEngine(canvas: HTMLCanvasElement): Promise<{ engine: AbstractEngine; backend: string }> {
  if (new URLSearchParams(location.search).get('renderer') !== 'webgl') {
    let gpu: WebGPUEngine | undefined;
    try {
      if (await WebGPUEngine.IsSupportedAsync) {
        gpu = new WebGPUEngine(canvas, { antialias: true, adaptToDeviceRatio: false });
        await gpu.initAsync();
        gpu.setHardwareScalingLevel(Math.max(1, devicePixelRatio / 1.5));
        return { engine: gpu, backend: 'WebGPU' };
      }
    } catch (error) {
      console.warn('WebGPU indisponível. Inicializando WebGL2.', error);
      gpu?.dispose();
    }
  }
  const engine = new Engine(canvas, true, { stencil: true, disableWebGL2Support: false }, false);
  if (engine.webGLVersion < 2) {
    engine.dispose();
    throw new Error('Este jogo precisa de WebGL2 ou WebGPU. Ative a aceleração gráfica do navegador.');
  }
  engine.setHardwareScalingLevel(Math.max(1, devicePixelRatio / 1.5));
  return { engine, backend: 'WebGL2' };
}
