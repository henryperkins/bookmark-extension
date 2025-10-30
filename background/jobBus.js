/**
 * Job Event Bus
 * Handles real-time communication between background scripts and popup UI
 * Supports both port-based streaming and storage-based fallback
 */


const DEFAULT_BUS_OPTIONS = {
  heartbeatInterval: 30000,
  maxMessageQueue: 100,
  retryAttempts: 3,
  retryDelay: 1000,
  storageDebounceMs: 300
};

export class JobBus {
  constructor(options = {}) {
    this.options = { ...DEFAULT_BUS_OPTIONS, ...options };
    this.subscribers = new Map();
    this.ports = new Map();
    this.messageQueue = [];
    this.isListening = false;
    this.heartbeatTimer = null;
    this.storageListener = null;
    this.lastEvent = null;
    this.startTime = Date.now();
    this.debugEnabled = false;
    this._storageDebounceT = null;
    this._storagePendingEvent = null;

    // Load debug flag once (optional gate for verbose logs)
    try {
      if (typeof chrome !== 'undefined' && chrome?.storage?.local?.get) {
        chrome.storage.local.get('debugLogs', (res) => {
          this.debugEnabled = !!(res && (res.debugLogs ?? res['debugLogs']));
        });
      }
    } catch {}

    this.setupMessageListener();
    this.startHeartbeat();
  }

  /**
   * Connect a port to the event bus (CLIENT-SIDE)
   * This creates a new connection from popup/client to background
   */
  connect(name) {
    try {
      const port = chrome.runtime.connect({ name });

      if (this.ports.has(name)) {
        // Replace existing port
        this.disconnect(name);
      }

      const portInfo = {
        port,
        name,
        connectedAt: Date.now(),
        lastSeen: Date.now(),
        messageCount: 0
      };

      this.ports.set(name, portInfo);

      port.onMessage.addListener((message) => {
        this.handlePortMessage(name, message);
      });

      port.onDisconnect.addListener(() => {
        this.handlePortDisconnect(name);
      });

      // Send connection confirmation
      this.sendToPort(port, {
        type: 'jobConnected',
        portName: name
      });

      // Send last known event if available
      if (this.lastEvent) {
        this.sendToPort(port, this.lastEvent);
      }

      return port;
    } catch (error) {
      console.error(`Failed to connect port ${name}:`, error);
      return null;
    }
  }

  /**
   * Register an incoming port (SERVER-SIDE)
   * This accepts an already-connected port from chrome.runtime.onConnect
   * and sets up listeners for it
   */
  registerPort(port) {
    if (!port || !port.name) {
      console.error('[JobBus] Cannot register port without name');
      return false;
    }

    const {name} = port;
    if (this.debugEnabled) console.log(`[JobBus] Registering incoming port: ${name}`);

    try {
      // Remove existing port with same name
      if (this.ports.has(name)) {
        if (this.debugEnabled) console.log(`[JobBus] Replacing existing port: ${name}`);
        this.disconnect(name);
      }

      const portInfo = {
        port,
        name,
        connectedAt: Date.now(),
        lastSeen: Date.now(),
        messageCount: 0
      };

      this.ports.set(name, portInfo);

      // Set up message listener
      port.onMessage.addListener((message) => {
        this.handlePortMessage(name, message);
      });

      // Set up disconnect listener
      port.onDisconnect.addListener(() => {
        this.handlePortDisconnect(name);
      });

      // Send connection confirmation
      this.sendToPort(port, {
        type: 'jobConnected',
        portName: name
      });

      // Send last known event if available
      if (this.lastEvent) {
        this.sendToPort(port, this.lastEvent);
      }

      if (this.debugEnabled) console.log(`[JobBus] Port registered successfully: ${name}`);
      return true;
    } catch (error) {
      console.error(`[JobBus] Failed to register port ${name}:`, error);
      return false;
    }
  }

  /**
   * Disconnect a port from the event bus
   */
  disconnect(name) {
    const portInfo = this.ports.get(name);
    if (portInfo) {
      try {
        portInfo.port.disconnect();
      } catch (error) {
        console.warn(`Error disconnecting port ${name}:`, error);
      }
      this.ports.delete(name);
    }
  }

  /**
   * Publish an event to all subscribers and connected ports
   */
  publish(event) {
    this.lastEvent = event;
    const timestamp = Date.now();

    // Add to message queue
    this.messageQueue.push({ event, timestamp });

    // Trim queue if it gets too large
    const maxQueueSize = Number.isFinite(this.options.maxMessageQueue) ? this.options.maxMessageQueue : DEFAULT_BUS_OPTIONS.maxMessageQueue;
    if (this.messageQueue.length > maxQueueSize) {
      this.messageQueue = this.messageQueue.slice(-maxQueueSize);
    }

    // Notify local subscribers
    this.notifySubscribers(event);

    // Send to connected ports
    this.broadcastToPorts(event);

    // Save to storage for fallback (gate to reduce write amplification)
    if (event && (event.type === 'jobStatus' || event.type === 'jobQueue')) {
      // Debounce persist to avoid bursts of writes
      if (this._storageDebounceT) {
        try { clearTimeout(this._storageDebounceT); } catch {}
        this._storageDebounceT = null;
      }
      this._storagePendingEvent = event;
      const ms = Number.isFinite(this.options.storageDebounceMs) ? this.options.storageDebounceMs : DEFAULT_BUS_OPTIONS.storageDebounceMs;
      this._storageDebounceT = setTimeout(() => {
        try {
          if (this._storagePendingEvent) {
            this.saveToStorage(this._storagePendingEvent);
          }
        } finally {
          this._storagePendingEvent = null;
          this._storageDebounceT = null;
        }
      }, ms);
      if (typeof this._storageDebounceT?.unref === 'function') {
        try { this._storageDebounceT.unref(); } catch {}
      }
    }
  }

  /**
   * Subscribe to events from the job bus
   */
  subscribe(name, listener) {
    if (!this.subscribers.has(name)) {
      this.subscribers.set(name, new Set());
    }

    const listeners = this.subscribers.get(name);
    if (listeners) {
      listeners.add(listener);
    }

    // Return unsubscribe function
    return () => {
      const listeners = this.subscribers.get(name);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.subscribers.delete(name);
        }
      }
    };
  }

  /**
   * Unsubscribe a listener
   */
  unsubscribe(name) {
    this.subscribers.delete(name);
  }

  /**
   * Get connected port names
   */
  getConnectedPorts() {
    return Array.from(this.ports.keys());
  }

  /**
   * Get subscriber names
   */
  getSubscribers() {
    return Array.from(this.subscribers.keys());
  }

  /**
   * Send a command to a specific port (for popup -> background communication)
   */
  sendCommandToPort(portName, command, payload) {
    const portInfo = this.ports.get(portName);
    if (portInfo) {
      this.sendToPort(portInfo.port, {
        type: 'jobCommand',
        command,
        payload,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle message from port
   */
  handlePortMessage(portName, message) {
    const portInfo = this.ports.get(portName);
    if (!portInfo) return;

    // Update port info
    portInfo.lastSeen = Date.now();
    portInfo.messageCount++;

    // Handle different message types
    if (message.type === 'jobCommand' && message.command) {
      // This is a command from popup to background
      // This should be handled by the service worker message listener
      this.publish({
        type: 'jobCommand',
        ...message
      });
    } else if (message.type === 'ping') {
      // Respond to ping
      this.sendToPort(portInfo.port, { type: 'pong', timestamp: Date.now() });
    }
  }

  /**
   * Handle port disconnection
   */
  handlePortDisconnect(portName) {
    if (this.debugEnabled) console.log(`Port ${portName} disconnected`);
    this.ports.delete(portName);

    // Notify subscribers that a port disconnected
    this.publish({
      type: 'jobDisconnected',
      portName
    });
  }

  /**
   * Notify local subscribers
   */
  notifySubscribers(event) {
    this.subscribers.forEach((listeners) => {
      listeners.forEach((listener) => {
        try {
          listener(event);
        } catch (error) {
          console.error('Error in event bus subscriber:', error);
        }
      });
    });
  }

  /**
   * Send event to all connected ports
   */
  broadcastToPorts(event) {
    this.ports.forEach((portInfo) => {
      this.sendToPort(portInfo.port, event);
    });
  }

  /**
   * Send message to a specific port with retry logic
   */
  sendToPort(port, event, attempt = 1) {
    try {
      port.postMessage(event);
    } catch (error) {
      const maxAttempts = Number.isFinite(this.options.retryAttempts) ? this.options.retryAttempts : DEFAULT_BUS_OPTIONS.retryAttempts;
      if (attempt <= maxAttempts) {
        setTimeout(() => {
          this.sendToPort(port, event, attempt + 1);
        }, (Number.isFinite(this.options.retryDelay) ? this.options.retryDelay : DEFAULT_BUS_OPTIONS.retryDelay) * attempt);
      } else {
        console.warn(`Failed to send message to port after ${attempt - 1} retries:`, error);
      }
    }
  }

  /**
   * Setup message listener for background script
   */
  setupMessageListener() {
    if (this.isListening) return;

    if (typeof chrome !== 'undefined' && chrome?.runtime?.onMessage?.addListener) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'jobCommand') {
          // This is a command from popup to background
          this.publish({
            type: 'jobCommand',
            ...message,
            senderId: sender.id
          });
        }
      });
      this.isListening = true;
    } else {
      // Node/test environments may not provide chrome.runtime messaging
      // Skip listener registration; bus will still function for local subscribers.
      this.isListening = false;
    }
  }

  /**
   * Setup storage listener for fallback communication
   */
  setupStorageListener() {
    if (this.storageListener) return;

    this.storageListener = (changes, namespace) => {
      if (namespace === 'local') {
        if (changes.jobEventBus) {
          try {
            const {newValue} = changes.jobEventBus;
            if (newValue) {
              const event = JSON.parse(newValue);
              this.notifySubscribers(event);
            }
          } catch (error) {
            console.error('Error parsing storage event:', error);
          }
        }
        if (changes.debugLogs) {
          try {
            this.debugEnabled = !!changes.debugLogs.newValue;
          } catch {}
        }
      }
    };

    if (typeof chrome !== 'undefined' && chrome?.storage?.onChanged?.addListener) {
      chrome.storage.onChanged.addListener(this.storageListener);
    } else {
      // Node/test environments may not provide chrome.storage.onChanged
      // Skip listener registration; storage fallback will be disabled.
    }
  }

  /**
   * Save event to storage for fallback communication
   */
  saveToStorage(event) {
    try {
      chrome.storage.local.set({
        jobEventBus: JSON.stringify(event)
      });
    } catch (error) {
      console.warn('Failed to save event to storage:', error);
    }
  }

  /**
   * Load last event from storage
   */
  async loadLastEvent() {
    try {
      const result = await chrome.storage.local.get('jobEventBus');
      if (result.jobEventBus) {
        return JSON.parse(result.jobEventBus);
      }
    } catch (error) {
      console.warn('Failed to load event from storage:', error);
    }
    return null;
  }

  /**
   * Start heartbeat to keep connections alive
   */
  startHeartbeat() {
    const interval = Number.isFinite(this.options.heartbeatInterval) ? this.options.heartbeatInterval : DEFAULT_BUS_OPTIONS.heartbeatInterval;
    this.heartbeatTimer = setInterval(() => {
      this.performHeartbeat();
    }, interval);
    // In Node test environments, allow process to exit even if the timer is active
    if (typeof this.heartbeatTimer?.unref === 'function') {
      try { this.heartbeatTimer.unref(); } catch {}
    }
  }

  /**
   * Perform heartbeat check
   */
  performHeartbeat() {
    const now = Date.now();
    const interval = Number.isFinite(this.options.heartbeatInterval) ? this.options.heartbeatInterval : DEFAULT_BUS_OPTIONS.heartbeatInterval;
    const staleThreshold = interval * 3; // 3x heartbeat interval

    // Check for stale connections
    this.ports.forEach((portInfo, name) => {
      if (now - portInfo.lastSeen > staleThreshold) {
        console.warn(`Port ${name} appears stale, disconnecting`);
        this.disconnect(name);
      }
    });

    // Send ping to all connected ports
    this.ports.forEach((portInfo) => {
      try {
        portInfo.port.postMessage({ type: 'ping', timestamp: now });
      } catch (error) {
        console.warn('Failed to send ping:', error);
      }
    });
  }

  /**
   * Get statistics about the event bus
   */
  getStats() {
    return {
      connectedPorts: this.ports.size,
      subscriberCount: this.subscribers.size,
      messageQueueSize: this.messageQueue.length,
      uptime: Date.now() - (this.startTime || Date.now())
    };
  }

  /**
   * Setup storage fallback
   */
  setupStorageFallback() {
    this.setupStorageListener();
  }

  /**
   * Get message queue for debugging
   */
  getMessageQueue(limit = 50) {
    return this.messageQueue.slice(-limit);
  }

  /**
   * Clear message queue
   */
  clearQueue() {
    this.messageQueue = [];
  }

  /**
   * Cleanup resources
   */
  dispose() {
    // Clear heartbeat timer
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Disconnect all ports
    this.ports.forEach((_, name) => {
      this.disconnect(name);
    });

    // Remove storage listener
    if (this.storageListener) {
      chrome.storage.onChanged.removeListener(this.storageListener);
      this.storageListener = null;
    }

    // Clear subscribers
    this.subscribers.clear();

    // Clear message queue
    this.messageQueue = [];
  }
}

/**
 * Global event bus instance
 */
let globalJobBus = null;

/**
 * Get or create the global job bus instance
 */
export function getJobBus(options) {
  if (!globalJobBus) {
    globalJobBus = new JobBus(options);
    globalJobBus.setupStorageFallback();
  }
  return globalJobBus;
}

/**
 * Dispose the global job bus
 */
export function disposeJobBus() {
  if (globalJobBus) {
    globalJobBus.dispose();
    globalJobBus = null;
  }
}
