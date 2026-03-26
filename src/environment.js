function installTestEnvironment(name = 'node') {
  if (name === 'node') {
    return {
      name,
      teardown() {}
    };
  }

  if (name === 'jsdom') {
    return installJsdomEnvironment();
  }

  throw new Error(`Unsupported test environment: ${String(name)}. Use one of: node, jsdom.`);
}

function installJsdomEnvironment() {
  let JSDOM;
  try {
    ({ JSDOM } = require('jsdom'));
  } catch {
    throw new Error(
      "The 'jsdom' package is required for the jsdom environment. Install with: npm i jsdom"
    );
  }

  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true
  });

  const previousDescriptors = new Map();
  const install = (key, value) => {
    previousDescriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key) || null);
    Object.defineProperty(globalThis, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value
    });
  };

  const explicitGlobals = {
    window: dom.window,
    self: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    location: dom.window.location,
    history: dom.window.history,
    localStorage: dom.window.localStorage,
    sessionStorage: dom.window.sessionStorage,
    Node: dom.window.Node,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    DocumentFragment: dom.window.DocumentFragment,
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent,
    EventTarget: dom.window.EventTarget,
    MouseEvent: dom.window.MouseEvent,
    KeyboardEvent: dom.window.KeyboardEvent,
    DOMParser: dom.window.DOMParser,
    MutationObserver: dom.window.MutationObserver,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window)
  };

  for (const [key, value] of Object.entries(explicitGlobals)) {
    install(key, value);
  }

  for (const key of Object.getOwnPropertyNames(dom.window)) {
    if (key in globalThis || key === 'undefined') {
      continue;
    }
    install(key, dom.window[key]);
  }

  install('IS_REACT_ACT_ENVIRONMENT', true);

  return {
    name: 'jsdom',
    beforeEach() {
      dom.window.document.head.innerHTML = '';
      dom.window.document.body.innerHTML = '';
    },
    afterEach() {
      if (typeof globalThis.cleanup === 'function') {
        globalThis.cleanup();
      }
      dom.window.document.head.innerHTML = '';
      dom.window.document.body.innerHTML = '';
    },
    teardown() {
      for (const [key, descriptor] of previousDescriptors.entries()) {
        if (descriptor) {
          Object.defineProperty(globalThis, key, descriptor);
        } else {
          delete globalThis[key];
        }
      }
      dom.window.close();
    }
  };
}

module.exports = {
  installTestEnvironment
};
