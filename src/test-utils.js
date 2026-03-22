const path = require('path');
const util = require('util');

function createTestUtils(options = {}) {
  const activeMocks = new Set();
  const activeSpies = new Set();
  const moduleLoader = options.moduleLoader;
  const renderedContainers = new Set();

  function fn(implementation) {
    const mockFn = createMockFunction(implementation);
    activeMocks.add(mockFn);
    return mockFn;
  }

  function spyOn(target, methodName) {
    if (!target || typeof target !== 'object') {
      throw new Error('spyOn expects an object target');
    }

    const original = target[methodName];
    if (typeof original !== 'function') {
      throw new Error(`spyOn expects ${String(methodName)} to be a function`);
    }

    const spy = fn(function spiedMethod(...args) {
      return original.apply(this, args);
    });

    spy.mockRestore = () => {
      target[methodName] = original;
      activeSpies.delete(spy);
      return spy;
    };

    target[methodName] = spy;
    activeSpies.add(spy);
    return spy;
  }

  function mock(request, factoryOrExports) {
    if (!moduleLoader) {
      throw new Error('mock(...) is unavailable outside the Themis runtime');
    }

    const callerFile = resolveCallerFile();
    const normalizedFactory = factoryOrExports === undefined ? {} : factoryOrExports;
    moduleLoader.registerMock(request, callerFile, normalizedFactory);
  }

  function unmock(request) {
    if (!moduleLoader) {
      throw new Error('unmock(...) is unavailable outside the Themis runtime');
    }

    const callerFile = resolveCallerFile();
    moduleLoader.unregisterMock(request, callerFile);
  }

  function clearAllMocks() {
    for (const mockFn of activeMocks) {
      mockFn.mockClear();
    }
  }

  function resetAllMocks() {
    for (const mockFn of activeMocks) {
      mockFn.mockReset();
    }

    if (moduleLoader) {
      moduleLoader.clearModuleMocks();
    }
  }

  function restoreAllMocks() {
    for (const spy of [...activeSpies]) {
      if (typeof spy.mockRestore === 'function') {
        spy.mockRestore();
      }
    }
  }

  function render(input, renderOptions = {}) {
    assertDomAvailable('render');
    const container = renderOptions.container || document.createElement('div');
    if (!renderOptions.container) {
      document.body.appendChild(container);
    }
    renderedContainers.add(container);
    container.innerHTML = '';
    const node = toDomNode(input);
    container.appendChild(node);

    return {
      container,
      rerender(nextInput) {
        container.innerHTML = '';
        container.appendChild(toDomNode(nextInput));
      },
      unmount() {
        cleanupContainer(container);
      }
    };
  }

  async function waitFor(assertion, options = {}) {
    const timeout = Number(options.timeout || 250);
    const interval = Number(options.interval || 10);
    const startedAt = Date.now();
    let lastError = null;

    while (Date.now() - startedAt <= timeout) {
      try {
        return await assertion();
      } catch (error) {
        lastError = error;
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw lastError || new Error(`waitFor timed out after ${timeout}ms`);
  }

  function cleanup() {
    for (const container of [...renderedContainers]) {
      cleanupContainer(container);
    }
  }

  const screen = createScreenQueries();
  const fireEvent = createFireEventApi();

  return {
    fn,
    spyOn,
    mock,
    unmock,
    clearAllMocks,
    resetAllMocks,
    restoreAllMocks,
    render,
    waitFor,
    screen,
    fireEvent,
    cleanup
  };

  function cleanupContainer(container) {
    if (!container) {
      return;
    }
    renderedContainers.delete(container);
    container.innerHTML = '';
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }

  function createScreenQueries() {
    return {
      getByText(text) {
        const match = queryAllNodes((node) => normalizeText(node.textContent) === normalizeText(text))[0];
        if (!match) {
          throw new Error(`Unable to find element with text: ${String(text)}`);
        }
        return match;
      },
      queryByText(text) {
        return queryAllNodes((node) => normalizeText(node.textContent) === normalizeText(text))[0] || null;
      },
      getByRole(role, options = {}) {
        const match = queryAllNodes((node) => {
          if (resolveRole(node) !== role) {
            return false;
          }
          if (options.name !== undefined) {
            return normalizeText(resolveAccessibleName(node)) === normalizeText(options.name);
          }
          return true;
        })[0];

        if (!match) {
          throw new Error(`Unable to find element with role: ${String(role)}`);
        }
        return match;
      },
      queryByRole(role, options = {}) {
        return queryAllNodes((node) => {
          if (resolveRole(node) !== role) {
            return false;
          }
          if (options.name !== undefined) {
            return normalizeText(resolveAccessibleName(node)) === normalizeText(options.name);
          }
          return true;
        })[0] || null;
      },
      getByLabelText(labelText) {
        const label = queryAllNodes((node) => node.tagName === 'LABEL' && normalizeText(node.textContent) === normalizeText(labelText))[0];
        if (!label) {
          throw new Error(`Unable to find label: ${String(labelText)}`);
        }

        const forId = label.getAttribute('for');
        if (forId) {
          const control = document.getElementById(forId);
          if (control) {
            return control;
          }
        }

        const nestedControl = label.querySelector('input, textarea, select, button');
        if (nestedControl) {
          return nestedControl;
        }

        throw new Error(`Unable to resolve control for label: ${String(labelText)}`);
      }
    };
  }

  function createFireEventApi() {
    return {
      click(node) {
        return dispatchDomEvent(node, new MouseEvent('click', { bubbles: true, cancelable: true }));
      },
      change(node, payload = {}) {
        applyTargetPayload(node, payload);
        return dispatchDomEvent(node, new Event('change', { bubbles: true, cancelable: true }));
      },
      input(node, payload = {}) {
        applyTargetPayload(node, payload);
        return dispatchDomEvent(node, new Event('input', { bubbles: true, cancelable: true }));
      },
      submit(node) {
        return dispatchDomEvent(node, new Event('submit', { bubbles: true, cancelable: true }));
      },
      keyDown(node, payload = {}) {
        return dispatchDomEvent(node, new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: payload.key || ''
        }));
      }
    };
  }

  function dispatchDomEvent(node, event) {
    assertDomNode(node, 'fireEvent');
    node.dispatchEvent(event);
    return event;
  }

  function applyTargetPayload(node, payload) {
    assertDomNode(node, 'fireEvent');
    if (payload && Object.prototype.hasOwnProperty.call(payload, 'target') && payload.target && typeof payload.target === 'object') {
      for (const [key, value] of Object.entries(payload.target)) {
        node[key] = value;
      }
    }
  }

  function queryAllNodes(predicate) {
    assertDomAvailable('screen');
    const nodes = Array.from(document.body.querySelectorAll('*'));
    return nodes.filter(predicate);
  }

  function toDomNode(value) {
    if (value instanceof Node) {
      return value;
    }
    if (value === null || value === undefined || value === false) {
      return document.createTextNode('');
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return document.createTextNode(String(value));
    }
    if (Array.isArray(value)) {
      const fragment = document.createDocumentFragment();
      for (const item of value) {
        fragment.appendChild(toDomNode(item));
      }
      return fragment;
    }
    if (isReactLikeElement(value)) {
      return reactLikeElementToDom(value);
    }

    throw new Error(`render(...) does not support value: ${format(value)}`);
  }

  function reactLikeElementToDom(element) {
    if (typeof element.type === 'function') {
      return toDomNode(element.type(element.props || {}));
    }

    if (element.type === Symbol.for('react.fragment')) {
      return toDomNode(flattenChildren(element.props && element.props.children));
    }

    const node = document.createElement(String(element.type));
    const props = element.props || {};
    for (const [key, value] of Object.entries(props)) {
      if (key === 'children' || value === null || value === undefined) {
        continue;
      }
      if (key === 'className') {
        node.setAttribute('class', String(value));
        continue;
      }
      if (key === 'htmlFor') {
        node.setAttribute('for', String(value));
        continue;
      }
      if (key.startsWith('on') && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value);
        continue;
      }
      if (key in node) {
        try {
          node[key] = value;
          continue;
        } catch (error) {
          // Fall through to attribute set.
        }
      }
      node.setAttribute(key, String(value));
    }

    for (const child of flattenChildren(props.children)) {
      node.appendChild(toDomNode(child));
    }

    return node;
  }
}

function createMockFunction(implementation) {
  const state = {
    calls: [],
    results: [],
    implementation: implementation
  };

  function mockFn(...args) {
    state.calls.push(args);
    try {
      const value = state.implementation ? state.implementation.apply(this, args) : undefined;
      state.results.push({ type: 'return', value });
      return value;
    } catch (error) {
      state.results.push({ type: 'throw', value: error });
      throw error;
    }
  }

  Object.defineProperty(mockFn, '_isThemisMockFunction', {
    configurable: false,
    enumerable: false,
    writable: false,
    value: true
  });

  mockFn.mock = state;
  mockFn.mockImplementation = (nextImplementation) => {
    state.implementation = nextImplementation;
    return mockFn;
  };
  mockFn.mockReturnValue = (value) => {
    state.implementation = () => value;
    return mockFn;
  };
  mockFn.mockResolvedValue = (value) => {
    state.implementation = () => Promise.resolve(value);
    return mockFn;
  };
  mockFn.mockRejectedValue = (value) => {
    state.implementation = () => Promise.reject(value);
    return mockFn;
  };
  mockFn.mockClear = () => {
    state.calls.length = 0;
    state.results.length = 0;
    return mockFn;
  };
  mockFn.mockReset = () => {
    state.calls.length = 0;
    state.results.length = 0;
    state.implementation = undefined;
    return mockFn;
  };
  mockFn.getMockName = () => 'themis.fn';

  return mockFn;
}

function isMockFunction(value) {
  return Boolean(value && value._isThemisMockFunction);
}

function formatMockCalls(value) {
  if (!isMockFunction(value)) {
    return format(value);
  }
  return format(value.mock.calls);
}

function resolveCallerFile() {
  const stack = String(new Error().stack || '').split('\n').slice(2);
  for (const line of stack) {
    const match = line.match(/\((.+?):\d+:\d+\)$/) || line.match(/at (.+?):\d+:\d+$/);
    if (!match) {
      continue;
    }

    const candidate = match[1];
    if (candidate.startsWith('node:')) {
      continue;
    }

    const normalized = candidate.replace(/\\/g, '/');
    if (
      normalized.endsWith('/src/test-utils.js') ||
      normalized.endsWith('/src/runtime.js') ||
      normalized.endsWith('/src/expect.js')
    ) {
      continue;
    }

    return candidate;
  }

  return path.join(process.cwd(), '__themis_unknown_caller__.js');
}

function format(value) {
  return util.inspect(value, { depth: 5, colors: false, maxArrayLength: 20 });
}

function assertDomAvailable(apiName) {
  if (typeof document === 'undefined' || typeof Node === 'undefined') {
    throw new Error(`${apiName}(...) requires the jsdom test environment`);
  }
}

function assertDomNode(node, apiName) {
  assertDomAvailable(apiName);
  if (!(node instanceof Node)) {
    throw new Error(`${apiName}(...) expects a DOM node`);
  }
}

function isReactLikeElement(value) {
  return Boolean(value && typeof value === 'object' && value.$$typeof === 'react.test.element');
}

function flattenChildren(children) {
  if (children === null || children === undefined) {
    return [];
  }
  if (Array.isArray(children)) {
    return children.flatMap((child) => flattenChildren(child));
  }
  return [children];
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function resolveRole(node) {
  const explicitRole = node.getAttribute && node.getAttribute('role');
  if (explicitRole) {
    return explicitRole;
  }

  const tagName = node.tagName ? node.tagName.toLowerCase() : '';
  if (tagName === 'button') {
    return 'button';
  }
  if (tagName === 'a' && node.getAttribute('href')) {
    return 'link';
  }
  if (tagName === 'input') {
    const type = (node.getAttribute('type') || 'text').toLowerCase();
    if (type === 'checkbox') {
      return 'checkbox';
    }
    if (type === 'radio') {
      return 'radio';
    }
    return 'textbox';
  }
  if (tagName === 'textarea') {
    return 'textbox';
  }
  if (tagName === 'form') {
    return 'form';
  }
  return null;
}

function resolveAccessibleName(node) {
  if (!node || !node.ownerDocument) {
    return '';
  }

  const ariaLabel = node.getAttribute && node.getAttribute('aria-label');
  if (ariaLabel) {
    return ariaLabel;
  }

  const id = node.getAttribute && node.getAttribute('id');
  if (id) {
    const label = node.ownerDocument.querySelector(`label[for="${id}"]`);
    if (label) {
      return normalizeText(label.textContent);
    }
  }

  if (node.closest) {
    const wrappingLabel = node.closest('label');
    if (wrappingLabel) {
      return normalizeText(wrappingLabel.textContent);
    }
  }

  return normalizeText(node.textContent);
}

module.exports = {
  createTestUtils,
  createMockFunction,
  isMockFunction,
  formatMockCalls
};
