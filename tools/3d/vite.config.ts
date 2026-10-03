import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Every src/entries/<name>.tsx becomes /3d/<name>.js exporting mount(el).
// Shared code lands in /3d/chunks/, public/ (models) is copied to /3d/.
const dir = resolve(import.meta.dirname, 'src/entries');
const input = Object.fromEntries(
  readdirSync(dir)
    .filter((f) => /\.tsx?$/.test(f) && !f.endsWith('.d.ts'))
    .map((f) => [f.replace(/\.tsx?$/, ''), resolve(dir, f)])
);

export default defineConfig({
  base: '/3d/',
  plugins: [react()],
  build: {
    outDir: '../../3d',
    emptyOutDir: true,
    target: 'es2022',
    reportCompressedSize: true,
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      input,
      preserveEntrySignatures: 'exports-only',
      // mountCanvas lazy-loads three/webgpu for WebGL entries; the globe imports it
      // directly, which makes that dynamic import a no-op for it. Expected.
      onwarn(warning, warn) {
        if (warning.code === 'INEFFECTIVE_DYNAMIC_IMPORT') return;
        warn(warning);
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'chunks/[name]-[hash][extname]',
        // Stable vendor chunks so every piece shares one cached copy.
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|scheduler|react-reconciler|its-fine|react-use-measure|suspend-react|zustand|@react-three[\\/]fiber)[\\/]/,
              priority: 10
            },
            { name: 'three-webgpu', test: /node_modules[\\/]three[\\/](build[\\/]three\.(webgpu|tsl)|examples[\\/]jsm[\\/]tsl)/, priority: 30 },
            { name: 'three', test: /node_modules[\\/]three[\\/]build[\\/]three\.(core|module)/, priority: 40 }
          ]
        }
      }
    }
  }
});
