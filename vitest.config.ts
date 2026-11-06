import { defineConfig } from 'vitest/config';
// Bound process count on shared hosts; browser suites and PDF font embedding are CPU intensive.
export default defineConfig({test:{include:['tests/*.test.{js,ts}'],maxWorkers:2}});
