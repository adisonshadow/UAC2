/**
 * 移除 Handler / 采集脚本中的 TypeScript 语法，供 vm.Script 执行。
 * 注意：不可粗暴删除所有 `: Type`，否则会破坏对象字面量（如 status: map[key]）。
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

  // 函数/调用参数类型
  code = code.replace(/\(([^)]*)\)/g, (full, inner) => {
    if (!/:\s*[\w"'[{]/.test(inner)) return full;
    return `(${stripParamTypes(inner)})`;
  });

  // 变量声明类型：const x: Type = → const x =
  code = code.replace(/\b(let|const|var)\s+(\w+)\s*:\s*[^=\n]+(?==)/g, '$1 $2');

  // 返回类型：): Promise<void> { → ) {
  code = code.replace(/\)\s*:\s*[^{=\n]+\{/g, ') {');

  return code;
}

module.exports = {
  stripTypeScriptForVm,
};
