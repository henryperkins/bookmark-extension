import { test } from 'node:test';
import assert from 'node:assert';

test('connection test job completes successfully', async () => {
  // Stub chrome API BEFORE importing background modules
  global.chrome = {
    runtime: {
      onMessage: { addListener: () => {}, removeListener: () => {} },
      onConnect: { addListener: () => {}, removeListener: () => {} },
    },
    storage: {
      local: {
        get: async () => ({}),
        set: async () => {},
        remove: async () => {},
      },
    },
  };

  const { JobRunner } = await import('../background/jobRunner.js');
  const { getJobBus } = await import('../background/jobBus.js');
  const { getJobStore } = await import('../background/jobStore.js');

  const jobBus = getJobBus();
  const jobStore = getJobStore();
  const jobRunner = new JobRunner(jobBus, jobStore);

  const mockExecutor = {
    execute: async () => ({
      completed: true,
      processedUnits: 1,
      totalUnits: 1,
      summary: { connectionTest: { success: true, error: null } }
    }),
    prepare: async () => {},
    teardown: async () => {},
    canPause: () => false,
    canCancel: () => true,
  };

  jobRunner.registerStageExecutor('initializing', mockExecutor);
  jobRunner.registerStageExecutor('testingConnection', mockExecutor);
  jobRunner.registerStageExecutor('summarizing', mockExecutor);

  await jobRunner.startJob({ jobType: 'test-connection' });

  // Wait for job to reach a terminal state
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('timeout waiting for completion')), 2000);
    const unsubscribe = jobRunner.subscribe(() => {
      const s = jobRunner.getCurrentJob();
      if (!s) return;
      if (['completed', 'failed', 'paused', 'cancelled'].includes(s.status)) {
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      }
    });
  });

  const finalJobState = jobRunner.getCurrentJob();
  assert.strictEqual(finalJobState.status, 'completed', 'Job should be marked as completed');
  assert.strictEqual(finalJobState.summary.connectionTest.success, true, 'Connection test should be successful');
});