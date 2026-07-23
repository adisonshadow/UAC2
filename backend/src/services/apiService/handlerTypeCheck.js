const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { parseRequestParameterInterface } = require('./operationParameterSchemas');

const SDK_DTS_PATH = path.join(__dirname, 'handlerSdk.d.ts');

const PRELUDE_LINES = [
  '// @ts-nocheck is intentionally NOT used — we want diagnostics',
  'export {};',
  '',
];

/**
 * 判断脚本是否已显式声明 handler / module.exports（旧写法）。
 */
function isExplicitHandlerScript(source) {
  const text = String(source || '');
  if (/\bexport\s+(?:default\s+)?(?:async\s+)?function\s+handler\b/.test(text)) return true;
  if (/\bexport\s+default\s+(?:async\s+)?(?:function|\()/.test(text)) return true;
  if (/\b(?:async\s+)?function\s+handler\s*\(/.test(text)) return true;
  if (/\bmodule\.exports\b/.test(text)) return true;
  if (/\bexports\.handler\b/.test(text)) return true;
  return false;
}

function ambientTsType(meta) {
  if (meta?.isFile) return 'string';
  if (meta?.isArray) return 'string[]';
  const t = String(meta?.tsType || 'string').toLowerCase();
  if (t.includes('number')) return 'number';
  if (t.includes('boolean')) return 'boolean';
  if (t.includes('[]') || t.includes('array')) return 'string[]';
  return 'string';
}

/**
 * 合成 params ambient；禁止粘贴 interface 原文（避免 StatusType 等别名与编辑器重复声明）。
 */
function buildParamsAmbient(requestParameterInterface) {
  const { fields } = parseRequestParameterInterface(requestParameterInterface);
  const names = Object.keys(fields);
  if (!names.length) {
    return [
      'interface RequestParams { [key: string]: unknown }',
      'declare const params: RequestParams;',
    ].join('\n');
  }
  const lines = names.map((name) => {
    const meta = fields[name];
    const optional = meta.required ? '' : '?';
    return `  ${name}${optional}: ${ambientTsType(meta)};`;
  });
  return [
    'interface RequestParams {',
    ...lines,
    '}',
    'declare const params: RequestParams;',
  ].join('\n');
}

function wrapUserScript(handlerScript) {
  const trimmed = String(handlerScript || '').trim();
  if (!trimmed) {
    return { wrapped: '', bodyStartLine: 1, isBody: true };
  }

  const ambient = buildParamsAmbient('');
  // ambient 由独立虚拟文件提供；此处只包用户代码
  if (isExplicitHandlerScript(trimmed)) {
    // 旧写法：整文件作为模块；去掉 export 便于诊断（保留函数）
    const body = trimmed
      .replace(/^\s*export\s+default\s+/m, '')
      .replace(/^\s*export\s+(async\s+)?/gm, '$1');
    const prelude = [
      ...PRELUDE_LINES,
      'declare function handler(ctx: HandlerContext): Promise<unknown> | unknown;',
      '',
    ];
    const wrapped = `${prelude.join('\n')}${body}\n`;
    return { wrapped, bodyStartLine: prelude.length + 1, isBody: false };
  }

  // 匿名函数体写法
  const prelude = [
    ...PRELUDE_LINES,
    'async function __eadaf_handler_body(): Promise<unknown> {',
  ];
  const wrapped = `${prelude.join('\n')}\n${trimmed}\n}\nvoid __eadaf_handler_body;\n`;
  return { wrapped, bodyStartLine: prelude.length + 1, isBody: true };
}

function loadSdkDts() {
  try {
    return fs.readFileSync(SDK_DTS_PATH, 'utf8');
  } catch {
    return '';
  }
}

function getHandlerSdkDts() {
  return loadSdkDts();
}

/**
 * 对 TypeScript Handler 做语法 + 类型检查，诊断行号映射回编辑器原文。
 * @returns {{ ok: boolean, diagnostics: Array<{ line: number, column: number, message: string, code?: number }> }}
 */
function checkHandlerScript(handlerScript, { requestParameterInterface } = {}) {
  const trimmed = String(handlerScript || '').trim();
  if (!trimmed) {
    return {
      ok: false,
      diagnostics: [{ line: 1, column: 1, message: 'Handler 脚本为空' }],
    };
  }

  // 禁止 queryPg / 原始 SQL 逃生舱（新契约）
  const banned = [];
  const queryPgMatch = trimmed.match(/\b(?:ctx\.)?queryPg\b/);
  if (queryPgMatch) {
    const before = trimmed.slice(0, queryPgMatch.index);
    const line = before.split(/\r?\n/).length;
    const col = before.length - before.lastIndexOf('\n');
    banned.push({
      line,
      column: Math.max(1, col),
      message: '禁止使用 queryPg / 原始 SQL；请改用 db(entityCode).where(...).getMany() 等 SDK API',
    });
  }

  const { wrapped, bodyStartLine } = wrapUserScript(trimmed);
  const sdkDts = loadSdkDts();
  const paramsAmbient = buildParamsAmbient(requestParameterInterface);

  const fileName = 'handler.ts';
  const sdkFile = 'handlerSdk.d.ts';
  const paramsFile = 'handlerParams.d.ts';

  const compilerOptions = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    lib: ['lib.es2020.d.ts'],
    strict: false,
    noImplicitAny: false,
    noEmit: true,
    skipLibCheck: true,
    allowJs: false,
    esModuleInterop: true,
    isolatedModules: true,
  };

  const sourceFiles = new Map([
    [fileName, wrapped],
    [sdkFile, sdkDts],
    [paramsFile, paramsAmbient],
  ]);

  const host = {
    ...ts.createCompilerHost(compilerOptions, true),
    getSourceFile(name, languageVersion, onError) {
      const content = sourceFiles.get(name);
      if (content != null) {
        return ts.createSourceFile(name, content, languageVersion, true);
      }
      // 允许加载 typescript lib
      return ts.createCompilerHost(compilerOptions, true).getSourceFile(name, languageVersion, onError);
    },
    fileExists(name) {
      if (sourceFiles.has(name)) return true;
      return ts.sys.fileExists(name);
    },
    readFile(name) {
      if (sourceFiles.has(name)) return sourceFiles.get(name);
      return ts.sys.readFile(name);
    },
    writeFile() {},
    getCurrentDirectory: () => process.cwd(),
    getCanonicalFileName: (f) => f,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
  };

  const program = ts.createProgram([fileName, sdkFile, paramsFile], compilerOptions, host);
  const allDiagnostics = ts.getPreEmitDiagnostics(program);

  const diagnostics = [...banned];

  allDiagnostics.forEach((diag) => {
    if (diag.category !== ts.DiagnosticCategory.Error) return;
    const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
    // 忽略 lib / d.ts 自身错误
    const file = diag.file?.fileName || '';
    if (file && file !== fileName && !file.endsWith('handler.ts')) {
      // params / sdk ambient 错误仍可能影响用户，映射到第 1 行提示
      if (file === paramsFile || file.endsWith('handlerParams.d.ts')) {
        diagnostics.push({
          line: 1,
          column: 1,
          message: `请求参数结构类型错误：${message}`,
          code: diag.code,
        });
      }
      return;
    }

    let line = 1;
    let column = 1;
    if (diag.file && diag.start != null) {
      const pos = diag.file.getLineAndCharacterOfPosition(diag.start);
      const wrappedLine = pos.line + 1;
      line = Math.max(1, wrappedLine - bodyStartLine + 1);
      column = pos.character + 1;
    }

    diagnostics.push({
      line,
      column,
      message,
      code: diag.code,
    });
  });

  // 去重
  const seen = new Set();
  const unique = diagnostics.filter((d) => {
    const key = `${d.line}:${d.column}:${d.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    ok: unique.length === 0,
    diagnostics: unique,
  };
}

/**
 * 检查失败时抛出带 diagnostics 的 400 错误。
 */
function assertHandlerScriptValid(handlerScript, options = {}) {
  const result = checkHandlerScript(handlerScript, options);
  if (result.ok) return result;

  const first = result.diagnostics[0];
  const summary = result.diagnostics
    .slice(0, 5)
    .map((d) => `L${d.line}:${d.column} ${d.message}`)
    .join('; ');
  const err = Object.assign(
    new Error(`Handler 语法/类型检查未通过：${summary}`),
    {
      status: 400,
      diagnostics: result.diagnostics,
      validationErrors: result.diagnostics,
    },
  );
  throw err;
}

module.exports = {
  checkHandlerScript,
  assertHandlerScriptValid,
  getHandlerSdkDts,
  isExplicitHandlerScript,
  wrapUserScript,
};
