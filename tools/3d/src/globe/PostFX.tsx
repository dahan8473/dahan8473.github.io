// Bloom, ported from tsi-globe's GlobePostProcessing, with one change: the page
// shows through. The scene renders onto a transparent target; the output is
// what tsi-globe drew over black, written as premultiplied color with alpha set
// to its brightest channel, so over the dark page it reads the same and over
// the light page the globe sits on paper.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, type ReactNode } from 'react';
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js';
import { float, max, min, pass, renderOutput, screenUV, smoothstep, vec4 } from 'three/tsl';
import { ACESFilmicToneMapping, NoToneMapping, PostProcessing, SRGBColorSpace, type WebGPURenderer } from 'three/webgpu';
import type { Palette } from './palette';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function PostFX({ palette, children }: { palette: Palette; children: ReactNode }) {
  const { gl, scene, camera } = useThree();

  const fx = useMemo(() => {
    const renderer = gl as unknown as WebGPURenderer;
    renderer.setClearColor(0x000000, 0);
    const post = new PostProcessing(renderer);
    post.outputColorTransform = false;
    const scenePass = pass(scene, camera);
    const color = scenePass.getTextureNode('output');
    const glow = bloom(color);
    return { post, scenePass, color, glow };
  }, [gl, scene, camera]);

  useEffect(() => {
    const { post, color, glow } = fx;
    (glow as any).strength.value = palette.bloomStrength;
    (glow as any).radius.value = palette.bloomRadius;
    (glow as any).threshold.value = palette.bloomThreshold;
    // Fade the glow out at the canvas edges so it never ends in a hard line.
    const e = min(min(screenUV.x, float(1).sub(screenUV.x)), min(screenUV.y, float(1).sub(screenUV.y)));
    const lin = palette.bloomStrength > 0 ? color.rgb.add(glow.rgb.mul(smoothstep(0.0, 0.12, e))) : color.rgb;
    const shown = renderOutput(vec4(lin, 1.0), palette.aces ? ACESFilmicToneMapping : NoToneMapping, SRGBColorSpace).rgb;
    const a = max(color.a, max(shown.r, max(shown.g, shown.b))).clamp(0.0, 1.0);
    post.outputNode = vec4(shown.min(a), a) as any;
    post.needsUpdate = true;
  }, [fx, palette]);

  useEffect(
    () => () => {
      fx.post.dispose();
      (fx.glow as any).dispose?.();
      (fx.scenePass as any).dispose?.();
    },
    [fx]
  );

  useFrame(() => {
    fx.post.render();
  }, 1);

  return <>{children}</>;
}

