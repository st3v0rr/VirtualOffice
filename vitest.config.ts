import { defineConfig } from 'vitest/config'

// `npm test` runs the unit tests of all workspaces with coverage (report only, no gate)
export default defineConfig({
  test: {
    projects: ['packages/media', 'server', 'client-3d'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      // the logic; React components and 3D rendering are covered by the smoke test instead
      include: [
        'packages/media/src/**/*.ts',
        'server/**/*.ts',
        'types/**/*.ts',
        'client-3d/src/{avatar,game,map,net}/**/*.ts',
        'client-3d/src/editor/**/*.ts',
        'client-3d/src/world/modelUrl.ts',
        'client-3d/src/ui/joinFlow.ts',
      ],
      exclude: ['**/test/**', 'server/lib/**', '**/*.d.ts'],
    },
  },
})
