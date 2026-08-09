/**
 * SQL 文本工具：注释剥离等（供命名参数扫描，避免注释里的 :name 被误识别）。
 */

/**
 * 去掉行注释（--）与块注释，供命名参数扫描使用；不修改实际执行 SQL。
 * 字符串字面量内的伪注释极少见，此处按简单规则处理。
 */
function stripSqlComments(sql) {
  return String(sql || '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n\r]*/g, ' ');
}

module.exports = {
  stripSqlComments,
};
