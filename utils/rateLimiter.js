export function createRateLimiter(max = 8) {
  let running = 0;
  const queue = [];

  const runNext = () => {
    if (running >= max || queue.length === 0) return;
    running++;
    const { fn, resolve, reject, retries } = queue.shift();

    (async () => {
      let attempt = 0;
      for (;;) {
        try {
          resolve(await fn());
          break;
        } catch (e) {
          if (++attempt > retries) {
            reject(e);
            break;
          }
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
        }
      }
    })().finally(() => {
      running--;
      runNext();
    });
  };

  return {
    execute(fn, retries = 3) {
      return new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject, retries });
        runNext();
      });
    }
  };
}
