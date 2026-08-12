/**
 * 移除 Handler / 采集脚本中的 TypeScript 语法，供 vm.Script 执行。
 * 注意：不可粗暴删除所有 `: Type`，否则会破坏对象字面量（如 status: map[key]）。
 * 也不可对任意函数调用括号做剥离，否则 insert({ id: workCardDbId }) 会被误伤。
 */
function stripParamTypes(inner) {
  return inner.replace(/\b(\w+)\??\s*:\s*(\{[^}]*\}|[^,)]+)/g, (match, name, typePart) => {
    const type = typePart.trim();
    // TS 内联对象类型：ctx: { params: Record<...> }
    if (/^\{[^}]*\}$/.test(type)) {
      return name;
    }
    // 对象字面量属性值（含数组下标表达式）不是类型注解
    if (/[\[{]/.test(type) && !/^(Record|Array|Promise|Partial|Pick|Omit)</.test(type)) {
      return match;
    }
    // 仅剥离常见 TS 类型写法
    if (/^(string|number|boolean|any|unknown|void|null|undefined|object|[A-Za-z_$][\w$]*(\[\])?(\s*\|\s*[\w$]+)*)$/.test(type)) {
      return name;
    }
    if (/^(Record|Array|Promise|Partial|Pick|Omit)<[^>]+>$/.test(type)) {
      return name;
    }
    return match;
  });
}

function stripTypeScriptForVm(source) {
  let code = String(source || '');
  code = code.replace(/^\s*import\s+.+$/gm, '');
  code = code.replace(/^\s*export\s+(async\s+)?/gm, '$1');

  // 仅处理函数声明 / 函数表达式的参数类型（勿扫描任意调用括号）
  code = code.replace(
    /\b(async\s+)?function(\s+\w+)?\s*\(([^)]*)\)/g,
    (full, asyncKw = '', name = '', inner) => {
      if (!/:\s*[\w"'[{]/.test(inner)) return full;
      return `${asyncKw || ''}function${name || ''}(${stripParamTypes(inner)})`;
    },
  );

  // 箭头函数参数：(x: Type) => / async (x: Type) =>
  code = code.replace(
    /(\basync\s*)?\(([^)]*)\)(\s*:\s*[^={\n]+)?\s*=>/g,
    (full, asyncKw = '', inner, _retType) => {
      const params = /:\s*[\w"'[{]/.test(inner) ? stripParamTypes(inner) : inner;
      return `${asyncKw || ''}(${params}) =>`;
    },
  );

  // 单参数箭头：x: Type 不适用；保留 name => 原样

  // 变量声明类型：const x: Type = → const x =
  code = code.replace(/\b(let|const|var)\s+(\w+)\s*:\s*[^=\n]+(?==)/g, '$1 $2');

  // 返回类型：): Promise<void> { → ) {
  code = code.replace(/\)\s*:\s*[^{=\n]+\{/g, ') {');

  return code;
}

module.exports = {
  stripTypeScriptForVm,
};
