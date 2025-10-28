/**
 * Job Event Bus
 * Handles real-time communication between background scripts and popup UI
 * Supports both port-based streaming and storage-based fallback
 */

import { JobEvent, JobCommand } from '../../shared/jobTypes.js';

export interface PortInfo {
  port: chrome.runtime.Port;
  name: string;
  connectedAt: number;
  lastSeen: number;
  messageCount: number;
}

export interface EventBusOptions {
  heartbeatInterval?: number;
  maxMessageQueue?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export class JobBus {
  private subscribers: Map<string, Set<(event: JobEvent) => void>> = new Map();
  private ports: Map<string, PortInfo> = new Map();
  private messageQueue: Array<{ event: JobEvent; timestamp: number }> = [];
  private isListening: boolean = false;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private storageListener: (changes: any, namespace: string) => void | null = null;
  private options: EventBusOptions;
  private lastEvent: JobEvent | null = null;

  constructor(options: EventBusOptions = {}) {
    this.options = {
      heartbeatInterval: 30000, // 30 seconds
      maxMessageQueue: 100,
      retryAttempts: 3,
      retryDelay: 1000,
      ...options
    };

    this.setupMessageListener();
    this.startHeartbeat();
  }

  /**
   * Connect a port to the event bus
   */
  connect(name: string): chrome.runtime.Port | null {
    try {
      const port = chrome.runtime.connect({ name });
      
      if (this.ports.has(name)) {
        // Replace existing port
        this.disconnect(name);
      }

      const portInfo: PortInfo = {
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
   * Disconnect a port from the event bus
   */
  disconnect(name: string): void {
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
  publish(event: JobEvent): void {
    this.lastEvent = event;
    const timestamp = Date.now();

    // Add to message queue
    this.messageQueue.push({ event, timestamp });
    
    // Trim queue if it gets too large
    if (this.messageQueue.length > this.options.maxMessageQueue!) {
      this.messageQueue = this.messageQueue.slice(-this.options.maxMessageQueue!);
    }

    // Notify local subscribers
    this.notifySubscribers(event);

    // Send to connected ports
    this.broadcastToPorts(event);

    // Save to storage for fallback
    this.saveToStorage(event);
  }

  /**
   * Subscribe to events from the job bus
   */
  subscribe(name: string, listener: (event: JobEvent) => void): () => void {
    if (!this.subscribers.has(name)) {
      this.subscribers.set(name, new Set());
    }

    this.subscribers.get(name)!.add(listener);

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
  unsubscribe(name: string): void {
    this.subscribers.delete(name);
  }

  /**
   * Get connected port names
   */
  getConnectedPorts(): string[] {
    return Array.from(this.ports.keys());
  }

  /**
   * Get subscriber names
   */
  getSubscribers(): string[] {
    return Array.from(this.subscribers.keys());
  }

  /**
   * Send a command to a specific port (for popup -> background communication)
   */
  sendCommandToPort(portName: string, command: JobCommand, payload?: Record<string, unknown>): void {
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
  private handlePortMessage(portName: string, message: any): void {
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
  private handlePortDisconnect(portName: string): void {
    console.log(`Port ${portName} disconnected`);
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
  private notifySubscribers(event: JobEvent): void {
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
  private broadcastToPorts(event: JobEvent): void {
    this.ports.forEach((portInfo) => {
      this.sendToPort(portInfo.port, event);
    });
  }

  /**
   * Send message to a specific port with retry logic
   */
  private sendToPort(port: chrome.runtime.Port, event: any, attempt: number = 1): void {
    try {
      port.postMessage(event);
    } catch (error) {
      if (attempt <= this.options.retryAttempts!) {
        setTimeout(() => {
          this.sendToPort(port, event, attempt + 1);
        }, this.options.retryDelay! * attempt);
      } else {
        console.warn(`Failed to send message to port after ${attempt - 1} retries:`, error);
      }
    }
  }

  /**
   * Setup message listener for background script
   */
  private setupMessageListener(): void {
    if (this.isListening) return;

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
  }

  /**
   * Setup storage listener for fallback communication
   */
  private setupStorageListener(): void {
    if (this.storageListener) return;

    this.storageListener = (changes, namespace) => {
      if (namespace === 'local' && changes.jobEventBus) {
        try {
          const newValue = changes.jobEventBus.newValue;
          if (newValue) {
            const event = JSON.parse(newValue);
            this.notifySubscribers(event);
          }
        } catch (error) {
          console.error('Error parsing storage event:', error);
        }
      }
    };

    chrome.storage.onChanged.addListener(this.storageListener);
  }

  /**
   * Save event to storage for fallback communication
   */
  private saveToStorage(event: JobEvent): void {
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
  async loadLastEvent(): Promise<JobEvent | null> {
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
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.performHeartbeat();
    }, this.options.heartbeatInterval!);
  }

  /**
   * Perform heartbeat check
   */
  private performHeartbeat(): void {
    const now = Date.now();
    const staleThreshold = this.options.heartbeatInterval! * 3; // 3x heartbeat interval

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
  getStats(): {
    connectedPorts: number;
    subscriberCount: number;
    messageQueueSize: number;
    uptime: number;
  } {
    return {
      connectedPorts: this.ports.size,
      subscriberCount: this.subscribers.size,
      messageQueueSize: this.messageQueue.length,
      uptime: Date.now() - (this.startTime || Date.now())
    };
  }

  private startTime: number = Date.now();

  /**
   * Setup storage fallback
   */
  setupStorageFallback(): void {
    this.setupStorageListener();
  }

  /**
   * Get message queue for debugging
   */
  getMessageQueue(limit: number = 50): Array<{ event: JobEvent; timestamp: number }> {
    return this.messageQueue.slice(-limit);
  }

  /**
   * Clear message queue
   */
  clearQueue(): void {
    this.messageQueue = [];
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
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
let globalJobBus: JobBus | null = null;

/**
 * Get or create the global job bus instance
 */
export function getJobBus(options?: EventBusOptions): JobBus {
  if (!globalJobBus) {
    globalJobBus = new JobBus(options);
    globalJobBus.setupStorageFallback();
  }
  return globalJobBus;
}

/**
 * Dispose the global job bus
 */
export function disposeJobBus(): void {
  if (globalJobBus) {
    globalJobBus.dispose();
    globalJobBus = null;
  }
}