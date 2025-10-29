import '@testing-library/jest-dom/vitest';
import { beforeEach, vi } from 'vitest';

type RuntimeMessage = { type?: string; command?: string } | undefined;

const portMessageListeners: Array<(message: unknown) => void> = [];
const portDisconnectListeners: Array<() => void> = [];

const matchMediaMock = vi.fn();

const speechSynthesisMock = {
  getVoices: vi.fn(),
  speak: vi.fn(),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  pending: false,
  speaking: false,
  paused: false,
  onvoiceschanged: null as SpeechSynthesis['onvoiceschanged'],
};

const runtimeSendMessageMock = vi.fn();
const runtimeConnectMock = vi.fn();
const runtimeOnMessageAddMock = vi.fn();
const runtimeOnMessageRemoveMock = vi.fn();

const storageLocalGetMock = vi.fn();
const storageLocalSetMock = vi.fn();
const storageSyncGetMock = vi.fn();
const storageSyncSetMock = vi.fn();

const mockPortDisconnectMock = vi.fn();
const mockPortPostMessageMock = vi.fn();
const mockPortOnMessageAddMock = vi.fn();
const mockPortOnMessageRemoveMock = vi.fn();
const mockPortOnDisconnectAddMock = vi.fn();
const mockPortOnDisconnectRemoveMock = vi.fn();

const mockPort = {
  name: 'job-feed',
  disconnect: mockPortDisconnectMock,
  postMessage: mockPortPostMessageMock,
  onMessage: {
    addListener: mockPortOnMessageAddMock,
    removeListener: mockPortOnMessageRemoveMock,
  },
  onDisconnect: {
    addListener: mockPortOnDisconnectAddMock,
    removeListener: mockPortOnDisconnectRemoveMock,
  },
  sender: undefined,
} as unknown as chrome.runtime.Port;

const buildMockResponse = (message: RuntimeMessage) => {
  switch (message?.type) {
    case 'GET_PENDING':
      return [];
    case 'GET_TREE':
      return [];
    case 'CHECK_DUPLICATE_URL':
      return { exists: false };
    case 'CREATE_BOOKMARK':
      return { id: 'mock-id', title: (message as any)?.payload?.title };
    case 'IMPORT_BOOKMARKS':
    case 'EXPORT_BOOKMARKS':
    case 'ACCEPT_MERGE':
    case 'REJECT_MERGE':
    case 'ACCEPT_ALL':
      return { success: true };
    case 'jobCommand': {
      switch (message.command) {
        case 'GET_JOB_HISTORY':
          return { success: true, history: [] };
        case 'EXPORT_REPORT':
          return { success: true, downloadUrl: 'blob:mock', filename: 'report.json' };
        default:
          return { success: true };
      }
    }
    default:
      return { success: true };
  }
};

const resetMatchMediaMock = () => {
  matchMediaMock.mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

const resetSpeechSynthesisMock = () => {
  speechSynthesisMock.getVoices.mockReturnValue([]);
  speechSynthesisMock.speak.mockImplementation(() => undefined);
  speechSynthesisMock.cancel.mockImplementation(() => undefined);
  speechSynthesisMock.pause.mockImplementation(() => undefined);
  speechSynthesisMock.resume.mockImplementation(() => undefined);
  speechSynthesisMock.pending = false;
  speechSynthesisMock.speaking = false;
  speechSynthesisMock.paused = false;
};

const resetPortMock = () => {
  portMessageListeners.length = 0;
  portDisconnectListeners.length = 0;

  mockPortPostMessageMock.mockImplementation(() => undefined);
  mockPortDisconnectMock.mockImplementation(() => {
    portDisconnectListeners.forEach((listener) => {
      try {
        listener();
      } catch {}
    });
  });

  mockPortOnMessageAddMock.mockImplementation((listener: (message: unknown) => void) => {
    portMessageListeners.push(listener);
  });

  mockPortOnMessageRemoveMock.mockImplementation((listener: (message: unknown) => void) => {
    const index = portMessageListeners.indexOf(listener);
    if (index >= 0) {
      portMessageListeners.splice(index, 1);
    }
  });

  mockPortOnDisconnectAddMock.mockImplementation((listener: () => void) => {
    portDisconnectListeners.push(listener);
  });

  mockPortOnDisconnectRemoveMock.mockImplementation((listener: () => void) => {
    const index = portDisconnectListeners.indexOf(listener);
    if (index >= 0) {
      portDisconnectListeners.splice(index, 1);
    }
  });
};

const resetChromeRuntimeMocks = () => {
  runtimeConnectMock.mockImplementation(() => mockPort);
  runtimeSendMessageMock.mockImplementation((message: RuntimeMessage, callback?: (response: unknown) => void) => {
    const response = buildMockResponse(message);
    if (typeof callback === 'function') {
      callback(response);
      return;
    }
    return Promise.resolve(response);
  });
  runtimeOnMessageAddMock.mockImplementation(() => undefined);
  runtimeOnMessageRemoveMock.mockImplementation(() => undefined);
};

const resetStorageMocks = () => {
  storageLocalGetMock.mockImplementation((keys: unknown, callback?: (items: Record<string, unknown>) => void) => {
    callback?.({ debugLogs: false });
  });
  storageLocalSetMock.mockImplementation(() => undefined);
  storageSyncGetMock.mockImplementation((keys: unknown, callback?: (items: Record<string, unknown>) => void) => {
    callback?.({});
  });
  storageSyncSetMock.mockImplementation(() => undefined);
};

const resetAllMocks = () => {
  resetMatchMediaMock();
  resetSpeechSynthesisMock();
  resetPortMock();
  resetChromeRuntimeMocks();
  resetStorageMocks();
};

resetAllMocks();

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: matchMediaMock,
});

Object.defineProperty(window, 'speechSynthesis', {
  writable: true,
  value: speechSynthesisMock,
});

Object.defineProperty(navigator, 'userAgent', {
  writable: true,
  value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
});

(globalThis as { chrome?: typeof chrome }).chrome = {
  runtime: {
    connect: runtimeConnectMock,
    sendMessage: runtimeSendMessageMock,
    onMessage: {
      addListener: runtimeOnMessageAddMock,
      removeListener: runtimeOnMessageRemoveMock,
    },
    lastError: undefined,
  } as unknown as typeof chrome.runtime,
  storage: {
    local: {
      get: storageLocalGetMock,
      set: storageLocalSetMock,
    },
    sync: {
      get: storageSyncGetMock,
      set: storageSyncSetMock,
    },
  } as unknown as typeof chrome.storage,
} as typeof chrome;

beforeEach(() => {
  resetAllMocks();
});