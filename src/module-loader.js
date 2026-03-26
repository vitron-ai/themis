const fs = require('fs');
const path = require('path');
const Module = require('module');

const SUPPORTED_SOURCE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx'];
const RESOLVABLE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json'];
const THEMIS_CONTRACT_RUNTIME_REQUEST = '@vitronai/themis/contract-runtime';
const THEMIS_CONTRACT_RUNTIME_PATH = path.join(__dirname, 'contract-runtime.js');
const DEFAULT_TS_COMPILER_OPTIONS = {
  target: 'ES2020',
  module: 'CommonJS',
  moduleResolution: 'Node',
  esModuleInterop: true
};

function createModuleLoader(options = {}) {
  const projectRoot = safeRealpath(path.resolve(options.cwd || process.cwd()));
  const virtualModules = options.virtualModules && typeof options.virtualModules === 'object'
    ? options.virtualModules
    : {};
  const tsconfigPath = options.tsconfigPath === null
    ? null
    : resolveTsconfigPath(projectRoot, options.tsconfigPath);
  const packageTypeCache = new Map();
  const loadedProjectModules = new Set();
  const compilerState = {
    context: null
  };
  const compilerContext = tsconfigPath && fs.existsSync(tsconfigPath)
    ? getCompilerContext(compilerState, projectRoot, tsconfigPath)
    : null;
  const originalResolveFilename = Module._resolveFilename;
  const originalLoad = Module._load;
  const originalLoaders = new Map();
  const mockRegistry = new Map();

  for (const extension of SUPPORTED_SOURCE_EXTENSIONS) {
    originalLoaders.set(extension, require.extensions[extension] || null);
    require.extensions[extension] = function themisSourceLoader(testModule, filename) {
      if (!shouldHandleProjectFile(filename, projectRoot)) {
        return delegateToOriginalLoader(originalLoaders, extension, testModule, filename);
      }

      loadedProjectModules.add(filename);

      if (!shouldTranspileFile(filename, projectRoot, packageTypeCache)) {
        return delegateToOriginalLoader(originalLoaders, extension, testModule, filename);
      }

      const source = fs.readFileSync(filename, 'utf8');
      const compiled = transpileSource({
        source,
        filename,
        compilerContext: compilerContext || getCompilerContext(compilerState, projectRoot, tsconfigPath)
      });
      testModule._compile(compiled, filename);
    };
  }

  Module._resolveFilename = function themisResolveFilename(request, parent, isMain, resolutionOptions) {
    if (request === THEMIS_CONTRACT_RUNTIME_REQUEST) {
      return THEMIS_CONTRACT_RUNTIME_PATH;
    }

    if (Object.prototype.hasOwnProperty.call(virtualModules, request)) {
      return request;
    }

    const aliasedRequest = resolveConfiguredRequest({
      request,
      parentFile: parent && parent.filename,
      projectRoot,
      compilerContext
    });

    return originalResolveFilename.call(
      this,
      aliasedRequest || request,
      parent,
      isMain,
      resolutionOptions
    );
  };

  Module._load = function themisModuleLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(virtualModules, request)) {
      const virtualValue = virtualModules[request];
      return typeof virtualValue === 'function' ? virtualValue() : virtualValue;
    }

    const resolvedRequest = resolveRequestValue({
      request,
      parentFile: parent && parent.filename,
      projectRoot,
      compilerContext,
      originalResolveFilename,
      isMain,
      virtualModules
    });

    if (mockRegistry.has(resolvedRequest)) {
      return materializeMock(mockRegistry.get(resolvedRequest));
    }

    return originalLoad.call(this, resolvedRequest, parent, isMain);
  };

  return {
    loadFile(filePath) {
      const resolvedPath = path.resolve(filePath);
      const realPath = safeRealpath(resolvedPath);
      delete require.cache[resolvedPath];
      delete require.cache[realPath];
      return require(realPath);
    },
    restore() {
      Module._resolveFilename = originalResolveFilename;
      Module._load = originalLoad;

      for (const [extension, loader] of originalLoaders.entries()) {
        if (loader) {
          require.extensions[extension] = loader;
        } else {
          delete require.extensions[extension];
        }
      }

      for (const filename of loadedProjectModules) {
        delete require.cache[filename];
      }
    },
    resolveRequest(request, parentFile) {
      return resolveRequestValue({
        request,
        parentFile,
        projectRoot,
        compilerContext,
        originalResolveFilename,
        virtualModules
      });
    },
    registerMock(request, parentFile, factoryOrExports) {
      const resolvedRequest = this.resolveRequest(request, parentFile);
      mockRegistry.set(resolvedRequest, {
        factory: factoryOrExports,
        initialized: false,
        value: undefined
      });
      delete require.cache[resolvedRequest];
      return resolvedRequest;
    },
    unregisterMock(request, parentFile) {
      const resolvedRequest = this.resolveRequest(request, parentFile);
      mockRegistry.delete(resolvedRequest);
      delete require.cache[resolvedRequest];
      return resolvedRequest;
    },
    clearModuleMocks() {
      for (const resolvedRequest of mockRegistry.keys()) {
        delete require.cache[resolvedRequest];
      }
      mockRegistry.clear();
    }
  };
}

function safeRealpath(targetPath) {
  try {
    return fs.realpathSync.native(targetPath);
  } catch {
    return targetPath;
  }
}

function resolveRequestValue({
  request,
  parentFile,
  projectRoot,
  compilerContext,
  originalResolveFilename,
  isMain = false,
  virtualModules = null
}) {
  if (request === THEMIS_CONTRACT_RUNTIME_REQUEST) {
    return THEMIS_CONTRACT_RUNTIME_PATH;
  }

  if (virtualModules && Object.prototype.hasOwnProperty.call(virtualModules, request)) {
    return request;
  }

  const normalizedParent = parentFile ? safeRealpath(path.resolve(parentFile)) : path.join(projectRoot, '__themis_entry__.js');
  const parentModule = {
    id: normalizedParent,
    filename: normalizedParent,
    paths: Module._nodeModulePaths(path.dirname(normalizedParent))
  };
  const aliasedRequest = resolveConfiguredRequest({
    request,
    parentFile: normalizedParent,
    projectRoot,
    compilerContext
  });

  return originalResolveFilename.call(
    Module,
    aliasedRequest || request,
    parentModule,
    isMain
  );
}

function materializeMock(mockEntry) {
  if (!mockEntry.initialized) {
    mockEntry.value = typeof mockEntry.factory === 'function'
      ? mockEntry.factory()
      : mockEntry.factory;
    mockEntry.initialized = true;
  }

  return mockEntry.value;
}

function resolveTsconfigPath(projectRoot, configuredPath) {
  if (typeof configuredPath === 'string' && configuredPath.trim().length > 0) {
    return path.resolve(projectRoot, configuredPath);
  }
  return path.join(projectRoot, 'tsconfig.json');
}

function shouldHandleProjectFile(filename, projectRoot) {
  const relativePath = path.relative(projectRoot, filename);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return false;
  }
  return !relativePath.split(path.sep).includes('node_modules');
}

function shouldTranspileFile(filename, projectRoot, packageTypeCache) {
  const extension = path.extname(filename).toLowerCase();

  if (extension === '.ts' || extension === '.tsx' || extension === '.jsx') {
    return true;
  }

  if (extension !== '.js') {
    return false;
  }

  return findNearestPackageType(filename, projectRoot, packageTypeCache) === 'module';
}

function delegateToOriginalLoader(originalLoaders, extension, testModule, filename) {
  const loader = originalLoaders.get(extension) || originalLoaders.get('.js');
  if (!loader) {
    throw new Error(`No loader available for ${extension} files (${filename})`);
  }
  return loader(testModule, filename);
}

function findNearestPackageType(filename, projectRoot, packageTypeCache) {
  let currentDir = path.dirname(filename);
  const visited = [];

  while (currentDir.startsWith(projectRoot)) {
    if (packageTypeCache.has(currentDir)) {
      const cached = packageTypeCache.get(currentDir);
      for (const visitedDir of visited) {
        packageTypeCache.set(visitedDir, cached);
      }
      return cached;
    }

    visited.push(currentDir);
    const packageJsonPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      let packageType = 'commonjs';
      try {
        const parsed = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (parsed.type === 'module') {
          packageType = 'module';
        }
      } catch {
        packageType = 'commonjs';
      }

      for (const visitedDir of visited) {
        packageTypeCache.set(visitedDir, packageType);
      }
      return packageType;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  for (const visitedDir of visited) {
    packageTypeCache.set(visitedDir, 'commonjs');
  }
  return 'commonjs';
}

function getCompilerContext(compilerState, projectRoot, tsconfigPath, options = {}) {
  if (compilerState.context) {
    return compilerState.context;
  }

  let ts;
  try {
    ts = require('typescript');
  } catch {
    if (options.optional) {
      return null;
    }
    throw new Error(
      "TypeScript-powered module loading requires the 'typescript' package. Install with: npm i -D typescript"
    );
  }

  compilerState.context = loadCompilerContext(ts, tsconfigPath);
  return compilerState.context;
}

function loadCompilerContext(ts, tsconfigPath) {
  const compilerOptions = buildCompilerOptions(ts, DEFAULT_TS_COMPILER_OPTIONS);
  const context = {
    ts,
    compilerOptions,
    baseUrl: null,
    pathMappings: []
  };

  if (!tsconfigPath || !fs.existsSync(tsconfigPath)) {
    return context;
  }

  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(formatDiagnostics(ts, [configFile.error]));
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(tsconfigPath)
  );

  if (parsedConfig.errors && parsedConfig.errors.length > 0) {
    throw new Error(formatDiagnostics(ts, parsedConfig.errors));
  }

  context.compilerOptions = buildCompilerOptions(ts, parsedConfig.options);
  context.baseUrl = parsedConfig.options.baseUrl ? path.resolve(parsedConfig.options.baseUrl) : null;
  context.pathMappings = buildPathMappings(parsedConfig.options.baseUrl, parsedConfig.options.paths || {});
  return context;
}

function buildCompilerOptions(ts, baseOptions = {}) {
  return {
    ...baseOptions,
    target: normalizeCompilerOption(baseOptions.target, ts.ScriptTarget.ES2020),
    module: ts.ModuleKind.CommonJS,
    moduleResolution: normalizeCompilerOption(
      baseOptions.moduleResolution,
      ts.ModuleResolutionKind.Node10
    ),
    sourceMap: false,
    inlineSourceMap: false,
    inlineSources: false,
    esModuleInterop: baseOptions.esModuleInterop !== false,
    allowJs: true
  };
}

function normalizeCompilerOption(value, fallback) {
  return typeof value === 'number' ? value : fallback;
}

function buildPathMappings(baseUrl, paths) {
  if (!baseUrl || !paths) {
    return [];
  }

  return Object.entries(paths).map(([pattern, targets]) => {
    const starIndex = pattern.indexOf('*');
    return {
      pattern,
      prefix: starIndex === -1 ? pattern : pattern.slice(0, starIndex),
      suffix: starIndex === -1 ? '' : pattern.slice(starIndex + 1),
      targets: Array.isArray(targets) ? targets : []
    };
  });
}

function resolveConfiguredRequest({ request, parentFile, projectRoot, compilerContext }) {
  if (!compilerContext || !parentFile || !shouldHandleProjectFile(parentFile, projectRoot)) {
    return null;
  }

  if (request.startsWith('.') || path.isAbsolute(request) || isBuiltinRequest(request)) {
    return null;
  }

  const aliasedTarget = resolvePathAlias(request, compilerContext);
  if (aliasedTarget) {
    return aliasedTarget;
  }

  if (!compilerContext.baseUrl) {
    return null;
  }

  return resolveCandidatePath(path.resolve(compilerContext.baseUrl, request));
}

function resolvePathAlias(request, compilerContext) {
  for (const mapping of compilerContext.pathMappings) {
    const match = matchPathPattern(mapping, request);
    if (match === null) {
      continue;
    }

    for (const target of mapping.targets) {
      const targetPath = target.includes('*') ? target.replace('*', match) : target;
      const resolved = resolveCandidatePath(path.resolve(compilerContext.baseUrl, targetPath));
      if (resolved) {
        return resolved;
      }
    }
  }

  return null;
}

function matchPathPattern(mapping, request) {
  if (!mapping.pattern.includes('*')) {
    return mapping.pattern === request ? '' : null;
  }

  if (!request.startsWith(mapping.prefix) || !request.endsWith(mapping.suffix)) {
    return null;
  }

  return request.slice(mapping.prefix.length, request.length - mapping.suffix.length);
}

function resolveCandidatePath(basePath) {
  if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
    return basePath;
  }

  for (const extension of RESOLVABLE_EXTENSIONS) {
    const filePath = `${basePath}${extension}`;
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return filePath;
    }
  }

  if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
    for (const extension of RESOLVABLE_EXTENSIONS) {
      const indexPath = path.join(basePath, `index${extension}`);
      if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
        return indexPath;
      }
    }
  }

  return null;
}

function isBuiltinRequest(request) {
  if (request.startsWith('node:')) {
    return true;
  }
  return Module.builtinModules.includes(request);
}

function transpileSource({ source, filename, compilerContext }) {
  const { ts } = compilerContext;
  const compilerOptions = {
    ...compilerContext.compilerOptions
  };

  const extension = path.extname(filename).toLowerCase();
  if ((extension === '.tsx' || extension === '.jsx') && compilerOptions.jsx === undefined) {
    compilerOptions.jsx = ts.JsxEmit.ReactJSX;
  }

  const compiled = ts.transpileModule(source, {
    compilerOptions,
    fileName: filename,
    reportDiagnostics: true
  });

  if (compiled.diagnostics && compiled.diagnostics.length > 0) {
    const blockingDiagnostics = compiled.diagnostics.filter(
      (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error
    );
    if (blockingDiagnostics.length > 0) {
      throw new Error(formatDiagnostics(ts, blockingDiagnostics));
    }
  }

  return compiled.outputText;
}

function formatDiagnostics(ts, diagnostics) {
  return diagnostics
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
    .join('\n');
}

module.exports = {
  createModuleLoader
};
