#!/usr/bin/env node
/**
 * 读取受限的 eadaf.app.yaml，向 stdout 打印一行 JSON。
 * 支持标量、以及 services 下的对象列表。不支持嵌套列表以外的复杂结构。
 */
'use strict';

const fs = require('fs');

const file = process.argv[2];
if (!file) {
  console.error('用法: node read-app-manifest.cjs <eadaf.app.yaml>');
  process.exit(1);
}
const text = fs.readFileSync(file, 'utf8');
const root = {};
let currentList = null;
let currentItem = null;

function parseScalar(raw) {
  const v = raw.trim();
  if (v === '' || v === 'null' || v === '~') return '';
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

for (const rawLine of text.split(/\r?\n/)) {
  const line = rawLine.replace(/\t/g, '  ');
  if (!line.trim() || line.trim().startsWith('#')) continue;
  const indent = line.match(/^ */)[0].length;
  const body = line.trim();
  if (indent === 0 && body.endsWith(':') && !body.includes(': ')) {
    currentList = [];
    currentItem = null;
    root[body.slice(0, -1)] = currentList;
    continue;
  }
  if (indent === 0) {
    currentList = null;
    currentItem = null;
    const eq = body.indexOf(':');
    if (eq === -1) continue;
    root[body.slice(0, eq).trim()] = parseScalar(body.slice(eq + 1));
    continue;
  }
  if (!currentList) {
    console.error(`无法解析: ${body}`);
    process.exit(1);
  }
  if (body.startsWith('- ')) {
    currentItem = {};
    currentList.push(currentItem);
    const rest = body.slice(2);
    const eq = rest.indexOf(':');
    if (eq !== -1) currentItem[rest.slice(0, eq).trim()] = parseScalar(rest.slice(eq + 1));
    continue;
  }
  if (!currentItem) {
    console.error(`services 项格式不对: ${body}`);
    process.exit(1);
  }
  const eq = body.indexOf(':');
  if (eq === -1) continue;
  currentItem[body.slice(0, eq).trim()] = parseScalar(body.slice(eq + 1));
}

const name = root.name;
if (!name) {
  console.error('eadaf.app.yaml 缺少 name');
  process.exit(1);
}
process.stdout.write(JSON.stringify(root));
