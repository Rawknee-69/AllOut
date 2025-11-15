import { build } from 'esbuild';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Build the API function with all server dependencies bundled
async function buildVercel() {
  console.log('Building Vercel API function...');
  
  // Ensure api directory exists
  const apiDir = join(__dirname, 'api');
  if (!existsSync(apiDir)) {
    mkdirSync(apiDir, { recursive: true });
  }

  // Bundle the API function with all server dependencies
  await build({
    entryPoints: ['api/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    outfile: 'api/index.js',
    external: [
      // Keep these external - Vercel provides them or they need special handling
      '@vercel/node',
      'dotenv', // dotenv/config is a side-effect import, keep external
    ],
    packages: 'bundle', // Bundle all node_modules dependencies
    sourcemap: false,
    minify: false,
    alias: {
      // Map shared imports
      '@shared': join(__dirname, 'shared'),
    },
    resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  });

  console.log('✓ Vercel API function built successfully');
}

buildVercel().catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
