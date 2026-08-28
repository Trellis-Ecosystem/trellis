// defineConfig comes from vitest/config rather than vite so the `test` block
// below is typed; it is a superset of vite's own defineConfig.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Read version from package.json so the string is always consistent with the
// published package version, regardless of whether npm_package_version is set
// in the environment (it is only injected by npm/pnpm run scripts).
function resolveAppVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf-8'),
    ) as { version?: string }
    return pkg.version ?? 'dev'
  } catch {
    return 'dev'
  }
}

// https://vite.dev/config/
export default defineConfig({
  // 'spa' makes the dev server fall back to index.html for any path that
  // isn't a real file, so a hard refresh on a client-side route (e.g.
  // /agreement/123) resolves through React Router instead of 404ing.
  appType: 'spa',
  plugins: [react()],
  define: {
    // __APP_VERSION__ is declared as a global in src/vite-env.d.ts so
    // TypeScript knows the type without a window/globalThis cast.
    __APP_VERSION__: JSON.stringify(resolveAppVersion()),
  },
  test: {
    // Components render against the DOM, so the whole suite runs in jsdom
    // rather than splitting into separate node/jsdom projects.
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      // Entry point, generated assets and the test harness itself carry no
      // logic worth covering.
      exclude: ['src/main.tsx', 'src/vite-env.d.ts', 'src/test/**'],
    },
  },
})
