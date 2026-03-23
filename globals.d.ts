import type {
  Cleanup,
  Describe,
  Expect,
  FireEventApi,
  Fn,
  Hook,
  Intent,
  MockControl,
  MockModule,
  Render,
  ScreenApi,
  SpyOn,
  Test,
  FetchMock,
  FlushMicrotasks,
  WaitFor
} from './index';

declare global {
  var describe: Describe;
  var test: Test;
  var it: Test;
  var intent: Intent;
  var beforeAll: Hook;
  var beforeEach: Hook;
  var afterEach: Hook;
  var afterAll: Hook;
  var expect: Expect;
  var fn: Fn;
  var spyOn: SpyOn;
  var mock: MockModule;
  var unmock: MockModule;
  var clearAllMocks: MockControl;
  var resetAllMocks: MockControl;
  var restoreAllMocks: MockControl;
  var render: Render;
  var screen: ScreenApi;
  var fireEvent: FireEventApi;
  var waitFor: WaitFor;
  var cleanup: Cleanup;
  var useFakeTimers: () => void;
  var useRealTimers: () => void;
  var advanceTimersByTime: (ms: number) => void;
  var runAllTimers: () => void;
  var flushMicrotasks: FlushMicrotasks;
  var captureContract: import('./index').CaptureContract;
  var mockFetch: (handlerOrResponse: unknown) => FetchMock;
  var restoreFetch: () => void;
  var resetFetchMocks: () => void;
}

export {};
