/**
 * Stage executor for the connection test job.
 */
import { createOpenAI } from '../openaiClient.js';

export class ConnectionTestStageExecutor {
  constructor(config) {
    this.config = config;
  }

  async execute(context) {
    const { activityCallback } = context;
    let snapshot = null;

    try {
      activityCallback('info', 'Pinging Azure OpenAI endpoint...');
      const client = createOpenAI(this.config);
      await client.chat([{ role: 'user', content: 'ping' }], { max_completion_tokens: 5 });

      snapshot = {
        success: true,
        error: null
      };
      activityCallback('info', 'Connection successful!');
    } catch (error) {
      const errorMessage = error?.message || String(error);
      snapshot = {
        success: false,
        error: errorMessage
      };
      activityCallback('error', 'Connection test failed', { error: errorMessage });
    }

    return {
      completed: true,
      processedUnits: 1,
      totalUnits: 1,
      summary: {
        connectionTest: snapshot
      }
    };
  }

  canPause() {
    return false;
  }

  canCancel() {
    return true;
  }
}