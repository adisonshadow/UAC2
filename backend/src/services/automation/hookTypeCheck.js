/**
 * 钩子脚本类型检查：照 handlerTypeCheck 的「d.ts 虚拟文件 + ts.createProgram」三件套。
 * 用户代码包装为虚拟 hook.ts，与 handlerSdk.d.ts（db SDK）+ hookSdk.d.ts（event/ctx）联合编译。
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const HANDLER_SDK_DTS_PATH = path.join(__dirname, '..', 'apiService', 'handlerSdk.d.ts');
const HOOK_SDK_DTS_PATH = path.join(__dirname, 'hookSdk.d.ts');

const PRELUDE_LINES = [
  '// @ts-nocheck is intentionally NOT used — we want diagnostics',
  'export {};',
  '',
];

function isExplicitHookScript(source) {
  const text = String(source || '');
  if (/\bexport\s+(?:default\s+)?(?:async\s+)?function\s+handler\b/.test(text)) return true;
  if (/\bexport\s+default\s+(?:async\s+)?(?:function|\()/.test(text)) return true;
  if (/\b(?:async\s+)?function\s+handler\s*\(/.test(text)) return true;
  if (/\bmodule\.exports\b/.test(text)) return true;
  if (/\bexports\.handler\b/.test(text)) return true;
  return false;
}

function wrapUserScript(source) {
  const trimmed = String(source || '').trim();
  if (!trimmed) {
    return { wrapped: '', bodyStartLine: 1 };
  }

  if (isExplicitHookScript(trimmed)) {
    const body = trimmed
      .replace(/^\s*export\s+default\s+/m, '')
      .replace(/^\s*export\s+(async\s+)?/gm, '$1');
    const prelude = [
      ...PRELUDE_LINES,
      'declare function handler(event: HookEvent, ctx: HookExecutionContext): Promise<unknown> | unknown;',
      '',
    ];
    const wrapped = `${prelude.join('\n')}${body}\n`;
    return { wrapped, bodyStartLine: prelude.length + 1 };
  }

  const prelude = [
    ...PRELUDE_LINES,
    'async function __eadaf_hook_body(event: HookEvent, ctx: HookExecutionContext): Promise<unknown> {',
  ];
  const wrapped = `${prelude.join('\n')}\n${trimmed}\n}\nvoid __eadaf_hook_body;\n`;
  return { wrapped, bodyStartLine: prelude.length + 1 };
}

function loadDts(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

/**
 * 钩子脚本语法 + 类型检查，诊断行号映射回编辑器原文。
 * @returns {{ ok: boolean, diagnostics: Array<{ line: number, column: number, message: string, code?: number }> }}
 */
function checkHookScript(source) {
  const trimmed = String(source || '').trim();
  if (!trimmed) {
    return {
      ok: false,
      diagnostics: [{ line: 1, column: 1, message: '钩子脚本为空' }],
    };
  }

  const { wrapped, bodyStartLine } = wrapUserScript(trimmed);
  const sdkDts = loadDts(HANDLER_SDK_DTS_PATH);
  const hookDts = loadDts(HOOK_SDK_DTS_PATH);

  const fileName = 'hook.ts';
  const sdkFile = 'handlerSdk.d.ts';
  const hookFile = 'hookSdk.d.ts';

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
    [hookFile, hookDts],
  ]);

  const host = {
    ...ts.createCompilerHost(compilerOptions, true),
    getSourceFile(name, languageVersion, onError) {
      const content = sourceFiles.get(name);
      if (content != null) {
        return ts.createSourceFile(name, content, languageVersion, true);
      }
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

  const program = ts.createProgram([fileName, sdkFile, hookFile], compilerOptions, host);
  const allDiagnostics = ts.getPreEmitDiagnostics(program);

  const diagnostics = [];
  allDiagnostics.forEach((diag) => {
    if (diag.category !== ts.DiagnosticCategory.Error) return;
    const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
    const file = diag.file?.fileName || '';
    if (file && file !== fileName && !file.endsWith('hook.ts')) {
      return; // sdk / ambient 声明自身错误不映射给用户
    }

    let line = 1;
    let column = 1;
    if (diag.file && diag.start != null) {
      const pos = diag.file.getLineAndCharacterOfPosition(diag.start);
      const wrappedLine = pos.line + 1;
      line = Math.max(1, wrappedLine - bodyStartLine + 1);
      column = pos.character + 1;
    }

    diagnostics.push({ line, column, message, code: diag.code });
  });

  const seen = new Set();
  const unique = diagnostics.filter((d) => {
    const key = `${d.line}:${d.column}:${d.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { ok: unique.length === 0, diagnostics: unique };
}

/** 检查失败抛出带 diagnostics 的 400 */
function assertHookScriptValid(source) {
  const result = checkHookScript(source);
  if (result.ok) return result;

  const summary = result.diagnostics
    .slice(0, 5)
    .map((d) => `L${d.line}:${d.column} ${d.message}`)
    .join('; ');
  throw Object.assign(
    new Error(`钩子脚本语法/类型检查未通过：${summary}`),
    { status: 400, diagnostics: result.diagnostics, validationErrors: result.diagnostics },
  );
}

/** 前端 Monaco 编辑器提示用：db SDK + hook 声明拼接 */
function getHookSdkDts() {
  return `${loadDts(HANDLER_SDK_DTS_PATH)}\n${loadDts(HOOK_SDK_DTS_PATH)}\n`;
}

module.exports = {
  checkHookScript,
  assertHookScriptValid,
  getHookSdkDts,
  isExplicitHookScript,
};
