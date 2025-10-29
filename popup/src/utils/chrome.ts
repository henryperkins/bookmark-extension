/*
 * Safe accessors for Chrome extension APIs. These helpers avoid ReferenceError
 * when the popup is rendered outside of an extension context (for example
 * during unit tests or local previews) by checking for the existence of the
 * chrome global before attempting to use it.
 */

// eslint-disable-next-line @typescript-eslint/ban-types
type OptionalChrome = { chrome?: typeof chrome };

const chromeAccessor = () => (globalThis as OptionalChrome).chrome;

/** Retrieve the chrome namespace if it exists. */
export function getChrome(): typeof chrome | undefined {
  return chromeAccessor();
}

/** Retrieve chrome.runtime if it exists. */
export function getRuntime(): typeof chrome.runtime | undefined {
  return chromeAccessor()?.runtime;
}

/** Retrieve chrome.storage if it exists. */
export function getStorage(): typeof chrome.storage | undefined {
  return chromeAccessor()?.storage;
}

/** Retrieve chrome.storage.local if it exists. */
export function getLocalStorage(): typeof chrome.storage.local | undefined {
  return getStorage()?.local;
}

/** Retrieve chrome.storage.sync if it exists. */
export function getSyncStorage(): typeof chrome.storage.sync | undefined {
  return getStorage()?.sync;
}

/** Safely connect to a named runtime port. */
export function connectPort(name: string): chrome.runtime.Port | null {
  const runtime = getRuntime();
  if (!runtime?.connect) {
    console.warn(`[chrome] runtime.connect is unavailable (requested port "${name}")`);
    return null;
  }

  try {
    return runtime.connect({ name });
  } catch (error) {
    console.error('[chrome] Failed to connect port:', error);
    return null;
  }
}

/**
 * Invoke chrome.runtime.sendMessage safely and normalise the return shape.
 * When the API is unavailable the function resolves to undefined instead of
 * throwing so callers can degrade gracefully.
 */
export async function sendRuntimeMessage<T = unknown>(message: unknown): Promise<T | undefined> {
  const runtime = getRuntime();
  if (!runtime?.sendMessage) {
    console.warn('[chrome] runtime.sendMessage is unavailable');
    return undefined;
  }

  try {
    const result = runtime.sendMessage(message);
    if (result && typeof (result as Promise<T>).then === 'function') {
      return await (result as Promise<T>);
    }
    return result as T | undefined;
  } catch (error) {
    console.error('[chrome] runtime.sendMessage threw:', error);
    return undefined;
  }
}

/**
 * Wrapper for callback style sendMessage usage. When runtime is unavailable
 * the callback is invoked with undefined so UI can continue rendering.
 */
export function sendRuntimeMessageWithCallback<T = unknown>(
  message: unknown,
  callback: (response: T | undefined) => void
): void {
  const runtime = getRuntime();
  if (!runtime?.sendMessage) {
    console.warn('[chrome] runtime.sendMessage is unavailable');
    callback(undefined);
    return;
  }

  try {
    runtime.sendMessage(message, (response: T) => {
      callback(response);
    });
  } catch (error) {
    console.error('[chrome] runtime.sendMessage (callback) threw:', error);
    callback(undefined);
  }
}
