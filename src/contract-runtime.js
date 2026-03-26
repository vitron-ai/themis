const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Module = require('module');

function listExportNames(moduleExports) {
  const keys = getEnumerableKeys(moduleExports);
  const namedKeys = keys.filter((key) => key !== '__esModule' && key !== 'default').sort();
  const hasExplicitDefault = keys.includes('default');
  const needsImplicitDefault = hasImplicitDefaultExport(moduleExports, namedKeys);
  const names = [];

  if (hasExplicitDefault || needsImplicitDefault) {
    names.push('default');
  }

  names.push(...namedKeys);
  return names;
}

function buildModuleContract(moduleExports) {
  const names = listExportNames(moduleExports);
  const contract = {};

  for (const name of names) {
    contract[name] = normalizeModuleValue(readExportValue(moduleExports, name));
  }

  return contract;
}

function readExportValue(moduleExports, name) {
  if (name === 'default') {
    if (
      moduleExports &&
      (typeof moduleExports === 'object' || typeof moduleExports === 'function') &&
      Object.prototype.hasOwnProperty.call(moduleExports, 'default')
    ) {
      return moduleExports.default;
    }

    return moduleExports;
  }

  return moduleExports[name];
}

function getEnumerableKeys(value) {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
    return [];
  }

  return Object.keys(value).sort();
}

function hasImplicitDefaultExport(moduleExports, namedKeys) {
  if (moduleExports === null || moduleExports === undefined) {
    return true;
  }

  if (typeof moduleExports === 'function') {
    return true;
  }

  if (typeof moduleExports !== 'object') {
    return true;
  }

  if (Array.isArray(moduleExports)) {
    return true;
  }

  return namedKeys.length === 0;
}

function normalizeModuleValue(value) {
  if (value === null) {
    return { kind: 'null' };
  }

  const primitiveType = typeof value;
  if (primitiveType === 'undefined') {
    return { kind: 'undefined' };
  }
  if (primitiveType === 'string' || primitiveType === 'number' || primitiveType === 'boolean') {
    return { kind: primitiveType, value };
  }
  if (primitiveType === 'bigint') {
    return { kind: 'bigint', value: String(value) };
  }
  if (primitiveType === 'symbol') {
    return { kind: 'symbol', value: String(value) };
  }
  if (primitiveType === 'function') {
    return normalizeFunction(value);
  }

  if (Array.isArray(value)) {
    return {
      kind: 'array',
      length: value.length,
      itemTypes: [...new Set(value.map(classifyValue))].sort()
    };
  }

  if (value instanceof Date) {
    return { kind: 'date' };
  }
  if (value instanceof RegExp) {
    return { kind: 'regexp', source: value.source, flags: value.flags };
  }
  if (value instanceof Map) {
    return { kind: 'map', size: value.size };
  }
  if (value instanceof Set) {
    return { kind: 'set', size: value.size };
  }
  if (isPlainObject(value)) {
    return { kind: 'object', keys: Object.keys(value).sort() };
  }

  return {
    kind: 'instance',
    constructor: getConstructorName(value),
    keys: Object.keys(value).sort()
  };
}

function normalizeBehaviorValue(value, seen = new Set()) {
  if (value === null || value === undefined) {
    return value;
  }

  const primitiveType = typeof value;
  if (primitiveType === 'string' || primitiveType === 'number' || primitiveType === 'boolean') {
    return value;
  }
  if (primitiveType === 'bigint') {
    return { kind: 'bigint', value: String(value) };
  }
  if (primitiveType === 'symbol') {
    return { kind: 'symbol', value: String(value) };
  }
  if (primitiveType === 'function') {
    return normalizeFunction(value);
  }

  if (seen.has(value)) {
    return { kind: 'circular' };
  }
  seen.add(value);

  try {
    if (isReactLikeElement(value)) {
      return {
        kind: 'element',
        type: normalizeElementType(value.type),
        key: value.key === undefined ? null : value.key,
        props: normalizeBehaviorValue(value.props || {}, seen)
      };
    }

    if (Array.isArray(value)) {
      return value.map((item) => normalizeBehaviorValue(item, seen));
    }

    if (value instanceof Date) {
      return { kind: 'date', value: value.toISOString() };
    }
    if (value instanceof RegExp) {
      return { kind: 'regexp', source: value.source, flags: value.flags };
    }
    if (value instanceof Map) {
      return {
        kind: 'map',
        entries: [...value.entries()].map(([key, entryValue]) => ([
          normalizeBehaviorValue(key, seen),
          normalizeBehaviorValue(entryValue, seen)
        ]))
      };
    }
    if (value instanceof Set) {
      return {
        kind: 'set',
        values: [...value.values()].map((entryValue) => normalizeBehaviorValue(entryValue, seen))
      };
    }
    if (isPlainObject(value)) {
      const normalized = {};
      for (const key of Object.keys(value).sort()) {
        normalized[key] = normalizeBehaviorValue(value[key], seen);
      }
      return normalized;
    }

    return {
      kind: 'instance',
      constructor: getConstructorName(value),
      keys: normalizeBehaviorValue(Object.keys(value).sort(), seen)
    };
  } finally {
    seen.delete(value);
  }
}

function clonePlainData(value) {
  if (value === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value));
}

async function normalizeRouteResult(value) {
  if (typeof Response !== 'undefined' && value instanceof Response) {
    const headers = {};
    for (const [key, headerValue] of value.headers.entries()) {
      headers[key] = headerValue;
    }

    const text = await value.clone().text();
    const body = tryParseJson(text);

    return {
      kind: 'response',
      status: value.status,
      statusText: value.statusText,
      redirected: value.redirected,
      headers,
      body: body === null ? text : body
    };
  }

  return normalizeBehaviorValue(value);
}

function createRequestFromSpec(spec) {
  const requestSpec = spec || {};
  const headers = { ...(requestSpec.headers || {}) };
  let body = undefined;

  if (requestSpec.json !== undefined) {
    if (!Object.prototype.hasOwnProperty.call(headers, 'content-type')) {
      headers['content-type'] = 'application/json';
    }
    body = JSON.stringify(requestSpec.json);
  } else if (requestSpec.body !== undefined) {
    body = requestSpec.body;
  }

  return new Request(requestSpec.url, {
    method: requestSpec.method || 'GET',
    headers,
    body
  });
}

function assertSourceFreshness(sourceFile, expectedHash, sourceLabel, regenerateCommand) {
  const currentHash = hashSourceFile(sourceFile);
  if (currentHash === expectedHash) {
    return;
  }

  throw new Error(
    'Themis generated test is stale for ' + sourceLabel +
    '. Run: ' + regenerateCommand +
    '. Expected source hash ' + expectedHash +
    ' but found ' + currentHash + '.'
  );
}

function hashSourceFile(sourceFile) {
  return crypto.createHash('sha1').update(fs.readFileSync(sourceFile, 'utf8')).digest('hex');
}

function tryParseJson(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

function normalizeElementType(type) {
  if (typeof type === 'string') {
    return type;
  }
  if (typeof type === 'symbol') {
    return String(type);
  }
  if (typeof type === 'function') {
    return type.name || '(anonymous)';
  }
  return normalizeBehaviorValue(type);
}

function loadModuleWithReactHarness(sourceFile, run) {
  const harness = { stateRecords: [], stateSlots: [], cursor: 0 };

  return withPatchedModule(sourceFile, 'react', (actualReact) => {
    const base = actualReact && (typeof actualReact === 'object' || typeof actualReact === 'function')
      ? actualReact
      : {};

    function beginRender() {
      harness.cursor = 0;
    }

    function useState(initialValue) {
      const slotIndex = harness.cursor;
      harness.cursor += 1;
      let slot = harness.stateSlots[slotIndex];

      if (!slot) {
        const startingValue = typeof initialValue === 'function' ? initialValue() : initialValue;
        slot = {
          currentValue: startingValue,
          record: {
            initial: normalizeBehaviorValue(startingValue),
            updates: []
          }
        };
        harness.stateSlots[slotIndex] = slot;
        harness.stateRecords.push(slot.record);
      }

      function setValue(nextValue) {
        slot.currentValue = typeof nextValue === 'function' ? nextValue(slot.currentValue) : nextValue;
        slot.record.updates.push(normalizeBehaviorValue(slot.currentValue));
        return slot.currentValue;
      }

      return [slot.currentValue, setValue];
    }

    return {
      ...base,
      useState,
      __THEMIS_BEGIN_RENDER__: beginRender
    };
  }, () => {
    const resolvedSource = require.resolve(sourceFile);
    delete require.cache[resolvedSource];
    const moduleExports = require(sourceFile);
    return run({
      moduleExports,
      stateRecords: harness.stateRecords,
      beginRender() {
        harness.cursor = 0;
      }
    });
  });
}

function withPatchedModule(sourceFile, request, buildExports, run) {
  let resolvedRequest;
  try {
    resolvedRequest = require.resolve(request, { paths: [path.dirname(sourceFile)] });
  } catch (_error) {
    return run();
  }

  const previousLoad = Module._load;
  const hadExisting = Object.prototype.hasOwnProperty.call(require.cache, resolvedRequest);
  const previousCacheEntry = require.cache[resolvedRequest];

  delete require.cache[resolvedRequest];
  const actualExports = previousLoad.call(Module, resolvedRequest, null, false);
  const patchedExports = buildExports(actualExports);
  delete require.cache[resolvedRequest];

  Module._load = function themisPatchedModuleLoad(targetRequest, parent, isMain) {
    const resolvedTarget = Module._resolveFilename(targetRequest, parent, isMain);
    if (resolvedTarget === resolvedRequest) {
      return patchedExports;
    }
    return previousLoad.call(this, targetRequest, parent, isMain);
  };

  try {
    return run();
  } finally {
    Module._load = previousLoad;
    if (hadExisting) {
      require.cache[resolvedRequest] = previousCacheEntry;
    } else {
      delete require.cache[resolvedRequest];
    }
  }
}

async function runComponentInteractionContract(sourceFile, exportName, props, interactionPlan = [], options = {}) {
  const wrapRender = options && typeof options.wrapRender === 'function' ? options.wrapRender : null;
  return loadModuleWithReactHarness(sourceFile, async ({ moduleExports, stateRecords, beginRender } = {}) => {
    const component = readExportValue(moduleExports || require(sourceFile), exportName);
    function render() {
      beginRender();
      const rendered = component(props);
      return wrapRender ? wrapRender(rendered) : rendered;
    }

    let rendered = render();
    const availableInteractions = collectElementInteractions(rendered);
    const interactions = [];

    for (const interaction of resolvePlannedElementInteractions(availableInteractions, interactionPlan)) {
      const beforeState = normalizeBehaviorValue(stateRecords);
      const beforeRendered = normalizeBehaviorValue(rendered);
      const result = interaction.invoke();
      rendered = render();
      const immediateRendered = normalizeBehaviorValue(rendered);
      const immediateDom = buildDomContractFromElement(rendered);
      const settledResult = await settleComponentInteractionResult(result);
      rendered = render();
      interactions.push({
        label: interaction.label,
        eventName: interaction.eventName,
        elementType: interaction.elementType,
        syntheticEvent: interaction.syntheticEvent,
        result: normalizeBehaviorValue(settledResult),
        beforeState,
        afterState: normalizeBehaviorValue(stateRecords),
        beforeRendered,
        immediateRendered,
        afterRendered: normalizeBehaviorValue(rendered),
        beforeDom: buildDomContractFromElement(interaction.beforeRenderedElement || beforeRendered),
        immediateDom,
        afterDom: buildDomContractFromElement(rendered)
      });
    }

    return {
      rendered: normalizeBehaviorValue(rendered),
      dom: buildDomContractFromElement(rendered),
      state: normalizeBehaviorValue(stateRecords),
      plan: normalizeBehaviorValue(interactionPlan),
      interactions
    };
  });
}

async function runComponentBehaviorFlowContract(sourceFile, exportName, props, flowPlan = [], options = {}) {
  const wrapRender = options && typeof options.wrapRender === 'function' ? options.wrapRender : null;
  return loadModuleWithReactHarness(sourceFile, async ({ moduleExports, stateRecords, beginRender } = {}) => {
    const component = readExportValue(moduleExports || require(sourceFile), exportName);
    function render() {
      beginRender();
      const rendered = component(props);
      return wrapRender ? wrapRender(rendered) : rendered;
    }

    let rendered = render();
    const steps = [];

    for (const step of normalizeComponentFlowPlan(flowPlan)) {
      const availableInteractions = collectElementInteractions(rendered);
      const interaction = findMatchingElementInteraction(availableInteractions, step);
      if (!interaction) {
        steps.push({
          label: step.label || step.event || 'unresolved-step',
          expected: normalizeBehaviorValue(step.expected || {}),
          skipped: true,
          reason: 'No matching interaction was available for this flow step.',
          beforeDom: buildDomContractFromElement(rendered),
          beforeState: normalizeBehaviorValue(stateRecords)
        });
        continue;
      }

      const beforeState = normalizeBehaviorValue(stateRecords);
      const beforeDom = buildDomContractFromElement(rendered);
      const beforeRendered = normalizeBehaviorValue(rendered);
      const result = interaction.invoke(step.syntheticEvent);
      rendered = render();
      const immediateDom = buildDomContractFromElement(rendered);
      const immediateState = normalizeBehaviorValue(stateRecords);
      const immediateRendered = normalizeBehaviorValue(rendered);
      const settledResult = await settleComponentFlowStep(result, step);
      rendered = render();
      let settledDom = buildDomContractFromElement(rendered);
      if (!isSatisfiedFlowExpectation(step.expected, settledDom)) {
        const awaited = await awaitFlowExpectation(render, rendered, step);
        rendered = awaited.rendered;
        settledDom = awaited.dom;
      }

      steps.push({
        label: step.label || interaction.label,
        eventName: interaction.eventName,
        elementType: interaction.elementType,
        expected: normalizeBehaviorValue(step.expected || {}),
        syntheticEvent: normalizeBehaviorValue(step.syntheticEvent),
        returnValue: normalizeBehaviorValue(settledResult),
        beforeState,
        immediateState,
        settledState: normalizeBehaviorValue(stateRecords),
        beforeRendered,
        immediateRendered,
        settledRendered: normalizeBehaviorValue(rendered),
        beforeDom,
        immediateDom,
        settledDom
      });
    }

    return {
      rendered: normalizeBehaviorValue(rendered),
      dom: buildDomContractFromElement(rendered),
      state: normalizeBehaviorValue(stateRecords),
      plan: normalizeBehaviorValue(flowPlan),
      steps
    };
  });
}

function runHookInteractionContract(sourceFile, exportName, args, interactionPlan = []) {
  return loadModuleWithReactHarness(sourceFile, ({ moduleExports, stateRecords, beginRender } = {}) => {
    const hook = readExportValue(moduleExports || require(sourceFile), exportName);
    function render() {
      beginRender();
      return hook(...args);
    }

    let result = render();
    const availableInteractions = collectStatefulMethodInteractions(result);
    const interactions = resolvePlannedHookInteractions(availableInteractions, interactionPlan).map((interaction) => {
      const beforeState = normalizeBehaviorValue(stateRecords);
      const beforeResult = normalizeBehaviorValue(result);
      const returnValue = interaction.invoke();
      result = render();
      return {
        label: interaction.label,
        methodName: interaction.methodName,
        returnValue: normalizeBehaviorValue(returnValue),
        beforeState,
        afterState: normalizeBehaviorValue(stateRecords),
        beforeResult,
        afterResult: normalizeBehaviorValue(result)
      };
    });

    return {
      result: normalizeBehaviorValue(result),
      state: normalizeBehaviorValue(stateRecords),
      plan: normalizeBehaviorValue(interactionPlan),
      interactions
    };
  });
}

function resolvePlannedElementInteractions(interactions, plan) {
  if (!Array.isArray(interactions) || interactions.length === 0) {
    return [];
  }

  const steps = normalizeComponentInteractionPlan(plan);
  if (steps.length === 0) {
    return interactions.slice(0, 4);
  }

  return materializeInteractionSteps(interactions, steps, findMatchingElementInteraction);
}

function resolvePlannedHookInteractions(interactions, plan) {
  if (!Array.isArray(interactions) || interactions.length === 0) {
    return [];
  }

  const steps = normalizeHookInteractionPlan(plan);
  if (steps.length === 0) {
    return interactions.slice(0, 6);
  }

  return materializeInteractionSteps(interactions, steps, findMatchingHookInteraction);
}

function materializeInteractionSteps(interactions, steps, matcher) {
  const resolved = [];

  for (const step of steps) {
    const matched = matcher(interactions, step);
    if (!matched) {
      continue;
    }

    const repeat = Math.max(1, Number(step.repeat || 1));
    for (let count = 0; count < repeat; count += 1) {
      resolved.push(matched);
    }
  }

  return resolved;
}

function normalizeComponentInteractionPlan(plan) {
  if (!Array.isArray(plan)) {
    return [];
  }

  return plan
    .map((step) => {
      if (typeof step === 'string') {
        return { event: step };
      }
      if (!step || typeof step !== 'object') {
        return null;
      }
      return {
        event: typeof step.event === 'string' ? step.event : null,
        labelIncludes: typeof step.labelIncludes === 'string' ? step.labelIncludes : null,
        elementType: typeof step.elementType === 'string' ? step.elementType : null,
        repeat: Number(step.repeat || 1)
      };
    })
    .filter(Boolean);
}

function normalizeHookInteractionPlan(plan) {
  if (!Array.isArray(plan)) {
    return [];
  }

  return plan
    .map((step) => {
      if (typeof step === 'string') {
        return { method: step };
      }
      if (!step || typeof step !== 'object') {
        return null;
      }
      return {
        method: typeof step.method === 'string' ? step.method : null,
        repeat: Number(step.repeat || 1)
      };
    })
    .filter(Boolean);
}

function normalizeComponentFlowPlan(plan) {
  if (!Array.isArray(plan)) {
    return [];
  }

  return plan
    .map((step) => {
      if (!step || typeof step !== 'object') {
        return null;
      }

      const syntheticEvent = buildFlowSyntheticEvent(step);
      return {
        label: typeof step.label === 'string' ? step.label : null,
        event: typeof step.event === 'string' ? step.event : null,
        labelIncludes: typeof step.labelIncludes === 'string' ? step.labelIncludes : null,
        elementType: typeof step.elementType === 'string' ? step.elementType : null,
        syntheticEvent,
        awaitResult: step.awaitResult === true,
        flushMicrotasks: Number(step.flushMicrotasks || 0),
        advanceTimersByTime: Number(step.advanceTimersByTime || 0),
        runAllTimers: step.runAllTimers === true,
        expected: isPlainObject(step.expected) ? clonePlainData(step.expected) : {}
      };
    })
    .filter((step) => step && step.event);
}

function findMatchingElementInteraction(interactions, step) {
  return interactions.find((interaction) => {
    if (step.event && interaction.eventName !== step.event) {
      return false;
    }
    if (step.elementType && interaction.elementType !== step.elementType) {
      return false;
    }
    if (step.labelIncludes && !interaction.label.includes(step.labelIncludes)) {
      return false;
    }
    return true;
  }) || null;
}

function findMatchingHookInteraction(interactions, step) {
  return interactions.find((interaction) => interaction.methodName === step.method) || null;
}

async function settleComponentFlowStep(result, step) {
  let settledResult = result;

  if (step.awaitResult && settledResult && typeof settledResult.then === 'function') {
    settledResult = await settledResult;
  }

  const flushCount = Math.max(0, Number(step.flushMicrotasks || 0));
  for (let index = 0; index < flushCount; index += 1) {
    await Promise.resolve();
  }

  if (step.runAllTimers && typeof globalThis.runAllTimers === 'function') {
    globalThis.runAllTimers();
  }

  if (Number(step.advanceTimersByTime || 0) > 0 && typeof globalThis.advanceTimersByTime === 'function') {
    globalThis.advanceTimersByTime(Number(step.advanceTimersByTime));
  }

  if (flushCount > 0) {
    for (let index = 0; index < flushCount; index += 1) {
      await Promise.resolve();
    }
  }

  return settledResult;
}

async function settleComponentInteractionResult(result) {
  let settledResult = result;

  if (settledResult && typeof settledResult.then === 'function') {
    settledResult = await settledResult;
  }

  await flushFlowMicrotasks({ flushMicrotasks: 1 });
  return settledResult;
}

async function awaitFlowExpectation(render, rendered, step, maxAttempts = 4) {
  let currentRendered = rendered;
  let currentDom = buildDomContractFromElement(currentRendered);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (isSatisfiedFlowExpectation(step.expected, currentDom)) {
      break;
    }

    await flushFlowMicrotasks(step);
    currentRendered = render();
    currentDom = buildDomContractFromElement(currentRendered);
  }

  return {
    rendered: currentRendered,
    dom: currentDom
  };
}

function isSatisfiedFlowExpectation(expected, dom) {
  if (!expected || typeof expected !== 'object') {
    return true;
  }

  if (typeof expected.beforeTextIncludes === 'string' && !String(dom && dom.textContent || '').includes(expected.beforeTextIncludes)) {
    return false;
  }

  if (typeof expected.settledTextIncludes === 'string' && !String(dom && dom.textContent || '').includes(expected.settledTextIncludes)) {
    return false;
  }

  if (typeof expected.textExcludes === 'string' && String(dom && dom.textContent || '').includes(expected.textExcludes)) {
    return false;
  }

  if (!domContractMatchesAttributes(dom, expected.attributes)) {
    return false;
  }

  if (!domContractMatchesRoles(dom, expected.rolesInclude)) {
    return false;
  }

  return true;
}

function domContractMatchesAttributes(dom, expectedAttributes) {
  if (!isPlainObject(expectedAttributes) || Object.keys(expectedAttributes).length === 0) {
    return true;
  }

  const nodes = dom && Array.isArray(dom.nodes) ? dom.nodes : [];
  return nodes.some((node) => {
    if (!node || node.kind !== 'element' || !isPlainObject(node.attributes)) {
      return false;
    }

    return Object.entries(expectedAttributes).every(([key, value]) => {
      const actual = Object.prototype.hasOwnProperty.call(node.attributes, key) ? node.attributes[key] : undefined;
      return valuesDeepEqual(normalizeBehaviorValue(actual), normalizeBehaviorValue(value));
    });
  });
}

function valuesDeepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function domContractMatchesRoles(dom, rolesInclude) {
  if (rolesInclude === undefined || rolesInclude === null) {
    return true;
  }

  const expectedRoles = Array.isArray(rolesInclude) ? rolesInclude : [rolesInclude];
  if (expectedRoles.length === 0) {
    return true;
  }

  const roles = dom && Array.isArray(dom.roles) ? dom.roles : [];
  return expectedRoles.every((expectedRole) => roles.some((entry) => entry && entry.role === expectedRole));
}

async function flushFlowMicrotasks(step) {
  if (typeof globalThis.flushMicrotasks === 'function') {
    await globalThis.flushMicrotasks();
  } else {
    await Promise.resolve();
    await Promise.resolve();
  }

  const flushCount = Math.max(0, Number(step && step.flushMicrotasks || 0));
  for (let index = 0; index < flushCount; index += 1) {
    await Promise.resolve();
  }
}

function collectElementInteractions(node, ancestry = []) {
  const interactions = [];
  visitElementInteractions(node, ancestry, interactions);
  return interactions;
}

function buildFlowSyntheticEvent(step) {
  const payload = isPlainObject(step.target) ? clonePlainData(step.target) : {};
  const type = typeof step.event === 'string' ? step.event.replace(/^on/, '').toLowerCase() : 'event';
  return {
    type,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    target: payload,
    currentTarget: {
      type: typeof step.elementType === 'string' ? step.elementType : null,
      props: {}
    }
  };
}

function visitElementInteractions(node, ancestry, interactions) {
  if (!isReactLikeElement(node)) {
    return;
  }

  const elementType = normalizeElementType(node.type);
  const currentPath = ancestry.concat([elementType]);
  const props = node.props || {};

  for (const eventName of ['onClick', 'onSubmit', 'onChange', 'onInput']) {
    if (typeof props[eventName] !== 'function') {
      continue;
    }

    const syntheticEvent = buildSyntheticEvent(eventName, node);
    interactions.push({
      label: currentPath.join(' > ') + '.' + eventName,
      eventName,
      elementType,
      syntheticEvent: normalizeBehaviorValue(syntheticEvent),
      beforeRenderedElement: node,
      invoke(overrideEvent) {
        const eventValue = overrideEvent || syntheticEvent;
        return props[eventName](eventValue);
      }
    });
  }

  for (const child of flattenChildren(props.children)) {
    visitElementInteractions(child, currentPath, interactions);
  }
}

function buildDomContractFromElement(node) {
  const contract = {
    textContent: collectElementText(node),
    roles: [],
    nodes: []
  };

  visitDomContract(node, contract, []);
  return contract;
}

function visitDomContract(node, contract, ancestry) {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return;
  }

  if (typeof node === 'string' || typeof node === 'number') {
    contract.nodes.push({
      kind: 'text',
      value: String(node),
      path: ancestry.join(' > ')
    });
    return;
  }

  if (Array.isArray(node)) {
    for (const child of node) {
      visitDomContract(child, contract, ancestry);
    }
    return;
  }

  if (!isReactLikeElement(node)) {
    contract.nodes.push({
      kind: 'value',
      value: normalizeBehaviorValue(node),
      path: ancestry.join(' > ')
    });
    return;
  }

  const elementType = normalizeElementType(node.type);
  const props = node.props || {};
  const currentPath = ancestry.concat([elementType]);
  const attributes = collectDomAttributes(props);
  const role = inferElementRole(elementType, props);
  const textContent = collectElementText(props.children);

  contract.nodes.push({
    kind: 'element',
    type: elementType,
    path: currentPath.join(' > '),
    textContent,
    attributes
  });

  if (role) {
    contract.roles.push({
      role,
      name: props['aria-label'] || textContent,
      path: currentPath.join(' > '),
      type: elementType,
      attributes
    });
  }

  for (const child of flattenChildren(props.children)) {
    visitDomContract(child, contract, currentPath);
  }
}

function collectElementText(node) {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return '';
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map((child) => collectElementText(child)).join('');
  }
  if (!isReactLikeElement(node)) {
    return '';
  }
  return collectElementText((node.props || {}).children);
}

function collectDomAttributes(props) {
  const attributes = {};
  for (const [key, value] of Object.entries(props || {})) {
    if (key === 'children' || key.startsWith('on') || value === undefined || value === null) {
      continue;
    }
    attributes[key] = normalizeBehaviorValue(value);
  }
  return attributes;
}

function inferElementRole(type, props) {
  if (props && typeof props.role === 'string') {
    return props.role;
  }
  if (type === 'button') {
    return 'button';
  }
  if (type === 'form') {
    return 'form';
  }
  if (type === 'textarea') {
    return 'textbox';
  }
  if (type === 'input') {
    const inputType = props && typeof props.type === 'string' ? props.type.toLowerCase() : 'text';
    if (inputType === 'checkbox') {
      return 'checkbox';
    }
    if (inputType === 'radio') {
      return 'radio';
    }
    return 'textbox';
  }
  if (type === 'a' && props && props.href) {
    return 'link';
  }
  return null;
}

function flattenChildren(children) {
  if (children === null || children === undefined) {
    return [];
  }
  if (Array.isArray(children)) {
    const flattened = [];
    for (const child of children) {
      flattened.push(...flattenChildren(child));
    }
    return flattened;
  }
  return [children];
}

function buildSyntheticEvent(eventName, element) {
  const props = element && element.props ? element.props : {};
  const target = {};

  if (eventName === 'onChange' || eventName === 'onInput') {
    if (Object.prototype.hasOwnProperty.call(props, 'checked')) {
      target.checked = !Boolean(props.checked);
    }
    if (Object.prototype.hasOwnProperty.call(props, 'value')) {
      target.value = props.value;
    } else if (!Object.prototype.hasOwnProperty.call(target, 'checked')) {
      target.value = 'themis';
    }
  }

  const event = {
    type: eventName.slice(2).toLowerCase(),
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    target,
    currentTarget: {
      type: normalizeElementType(element && element.type),
      props: normalizeBehaviorValue(props)
    }
  };

  return event;
}

function collectStatefulMethodInteractions(value) {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
    return [];
  }

  const methods = Object.keys(value)
    .filter((key) => typeof value[key] === 'function' && value[key].length === 0)
    .sort((left, right) => {
      const leftIndex = ['toggle', 'enable', 'disable', 'increment', 'decrement', 'open', 'close', 'reset', 'submit'].indexOf(left);
      const rightIndex = ['toggle', 'enable', 'disable', 'increment', 'decrement', 'open', 'close', 'reset', 'submit'].indexOf(right);
      if (leftIndex !== -1 || rightIndex !== -1) {
        const safeLeft = leftIndex === -1 ? 9 : leftIndex;
        const safeRight = rightIndex === -1 ? 9 : rightIndex;
        if (safeLeft !== safeRight) {
          return safeLeft - safeRight;
        }
      }
      return left.localeCompare(right);
    });

  return methods.map((methodName) => ({
    label: methodName,
    methodName,
    invoke() {
      return value[methodName]();
    }
  }));
}

function normalizeFunction(value) {
  const ownKeys = Object.keys(value).sort();
  const prototypeKeys = value.prototype && value.prototype !== Object.prototype
    ? Object.getOwnPropertyNames(value.prototype).filter((key) => key !== 'constructor').sort()
    : [];

  return {
    kind: isClassLike(value) ? 'class' : 'function',
    name: value.name || '(anonymous)',
    arity: value.length,
    ownKeys,
    prototypeKeys
  };
}

function classifyValue(value) {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  if (value instanceof Date) {
    return 'date';
  }
  if (value instanceof RegExp) {
    return 'regexp';
  }
  if (value instanceof Map) {
    return 'map';
  }
  if (value instanceof Set) {
    return 'set';
  }

  const type = typeof value;
  if (type !== 'object') {
    return type;
  }

  if (isPlainObject(value)) {
    return 'object';
  }

  return 'instance:' + getConstructorName(value);
}

function getConstructorName(value) {
  if (!value || !value.constructor || !value.constructor.name) {
    return 'Object';
  }
  return value.constructor.name;
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isClassLike(value) {
  return Function.prototype.toString.call(value).startsWith('class ');
}

function isReactLikeElement(value) {
  return value && typeof value === 'object' && value.$$typeof === 'react.test.element';
}

module.exports = {
  listExportNames,
  buildModuleContract,
  readExportValue,
  normalizeBehaviorValue,
  normalizeRouteResult,
  createRequestFromSpec,
  assertSourceFreshness,
  runComponentInteractionContract,
  runComponentBehaviorFlowContract,
  runHookInteractionContract
};
