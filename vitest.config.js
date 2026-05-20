/**
 * Vitest configuration for Workrail tests
 */

import { defineConfig } from 'vitest/config';

// Windows runners are roughly 2x slower than Linux for the same git and
// filesystem-heavy tests (clone, fork-harness, rehydrate). Multiply the
// default timeouts on win32 so legitimately-slow tests do not flake out
// the matrix while still surfacing real deadlocks within a bounded window.
const isWindows = process.platform === 'win32';

const shared = {
  // Setup files
  setupFiles: ['./tests/setup.ts'],

  // Globals (like jest)
  globals: true,

  // Clear mocks between tests
  clearMocks: true,

  // Increase timeouts for Git integration tests (slow cloning + file I/O).
  // 3x on Windows -- see comment above.
  testTimeout: isWindows ? 30000 : 10000,
  hookTimeout: isWindows ? 60000 : 30000,

  // WHY retry: 2: several tests depend on fire-and-forget filesystem operations
  // (writeExecutionStats, lock file writes) that can lose races under load when
  // up to 4 vitest worker threads run in parallel. Retrying catches timing-dependent
  // failures without hiding real bugs -- a genuine bug fails all 3 attempts.
  retry: 2,
};

export default defineConfig({
  test: {
    // Split into projects so we can run most tests in node (low memory),
    // while keeping web UI tests in jsdom.
    //
    // Vitest runs test files in parallel workers by default.
    // Cap worker count to avoid spawning many heavy environments at once.
    // Override locally with VITEST_MAX_THREADS=... when needed.
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/**/*.test.ts'],
          // Exclude the knowledge-graph test -- it runs in the 'knowledge-graph' project
          // below with pool:forks to avoid DuckDB native binary + worker thread conflicts.
          exclude: ['tests/unit/knowledge-graph.test.ts'],
          pool: 'threads',
          poolOptions: {
            threads: {
              minThreads: 1,
              maxThreads: Number(process.env.VITEST_MAX_THREADS ?? 4),
            },
          },
          ...shared,
        },
      },
      {
        test: {
          name: 'web',
          environment: 'jsdom',
          include: ['web/**/*.test.js'],
          pool: 'threads',
          poolOptions: {
            threads: {
              minThreads: 1,
              maxThreads: Number(process.env.VITEST_MAX_THREADS_WEB ?? 2),
            },
          },
          ...shared,
        },
      },
      // Knowledge graph tests use pool:forks because @duckdb/node-api is a native
      // binary that may not be safe in worker threads. Forks pool isolates each
      // test file in a separate process, which avoids thread-local state issues.
      {
        test: {
          name: 'knowledge-graph',
          environment: 'node',
          include: ['tests/unit/knowledge-graph.test.ts'],
          pool: 'forks',
          poolOptions: {
            forks: {
              singleFork: true,
            },
          },
          ...shared,
          // Give the indexer extra time -- it runs ts-morph over the full src/ tree
          testTimeout: 60000,
          hookTimeout: 120000,
        },
      },
      // Console ViewModel hook tests live in console/src/hooks/__tests__/ and
      // run via the console's own vitest config (console/vitest.config.ts).
      // Use: cd console && npx vitest run   OR   npm test --prefix console
    ],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['web/assets/**/*.js'],
      exclude: [
        'web/assets/**/*.test.js',
        'node_modules/**'
      ],
      thresholds: {
        branches: 70,
        functions: 75,
        lines: 80,
        statements: 80
      }
    },
  }
});
