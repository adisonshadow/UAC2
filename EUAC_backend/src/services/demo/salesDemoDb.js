const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../../config');

let dbInstance = null;

function resolveDbPath() {
  const configured = config.salesDemo?.dbPath;
  if (configured && path.isAbsolute(configured)) {
    return configured;
  }
  const relative = configured || './data/sales-demo.db';
  return path.resolve(__dirname, '../../..', relative);
}

function getDb() {
  if (dbInstance) {
    return dbInstance;
  }
  const dbPath = resolveDbPath();
  if (!fs.existsSync(dbPath)) {
    throw new Error(`销售 Demo SQLite 不存在: ${dbPath}，请先运行 yarn init-sales-demo-db`);
  }
  dbInstance = new Database(dbPath, { readonly: true, fileMustExist: true });
  dbInstance.pragma('foreign_keys = ON');
  return dbInstance;
}

function resetDbInstance() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

function getOrderByOrderNo(orderNo) {
  const db = getDb();
  const order = db.prepare(`
    SELECT o.*, u.name AS user_name, u.phone AS user_phone, u.email AS user_email, u.city AS user_city, u.level AS user_level
    FROM orders o
    JOIN users u ON u.id = o.user_id
    WHERE o.order_no = ?
  `).get(String(orderNo || '').trim().toUpperCase());

  if (!order) {
    return null;
  }

  const items = db.prepare(`
    SELECT oi.*, p.sku, p.name AS product_name, p.category
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ?
  `).all(order.id);

  return { ...order, items };
}

function searchOrders(args = {}) {
  const db = getDb();
  const page = Math.max(parseInt(args.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(args.pageSize, 10) || 10, 1), 50);
  const offset = (page - 1) * pageSize;

  const conditions = ['1=1'];
  const params = [];

  if (args.status) {
    conditions.push('o.status = ?');
    params.push(String(args.status));
  }
  if (args.userId || args.user_id) {
    conditions.push('o.user_id = ?');
    params.push(parseInt(args.userId || args.user_id, 10));
  }
  if (args.dateFrom || args.date_from) {
    conditions.push('o.created_at >= ?');
    params.push(String(args.dateFrom || args.date_from));
  }
  if (args.dateTo || args.date_to) {
    conditions.push('o.created_at <= ?');
    params.push(String(args.dateTo || args.date_to));
  }
  if (args.keyword) {
    conditions.push('(o.order_no LIKE ? OR u.name LIKE ?)');
    const kw = `%${String(args.keyword).trim()}%`;
    params.push(kw, kw);
  }

  const where = conditions.join(' AND ');
  const total = db.prepare(`
    SELECT COUNT(*) AS count FROM orders o JOIN users u ON u.id = o.user_id WHERE ${where}
  `).get(...params).count;

  const items = db.prepare(`
    SELECT o.id, o.order_no, o.user_id, u.name AS user_name, o.status, o.total_amount, o.created_at, o.shipped_at
    FROM orders o
    JOIN users u ON u.id = o.user_id
    WHERE ${where}
    ORDER BY o.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset);

  return { page, pageSize, total, items };
}

function orderStatsByStatus() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT status, COUNT(*) AS order_count, ROUND(SUM(total_amount), 2) AS total_amount
    FROM orders
    GROUP BY status
    ORDER BY status
  `).all();
  const summary = db.prepare(`
    SELECT COUNT(*) AS total_orders, ROUND(SUM(total_amount), 2) AS grand_total
    FROM orders
  `).get();
  return { summary, byStatus: rows };
}

function orderStatsByPeriod(args = {}) {
  const db = getDb();
  const days = Math.min(Math.max(parseInt(args.days, 10) || 30, 1), 365);
  const groupBy = ['day', 'week', 'month'].includes(args.groupBy || args.group_by)
    ? (args.groupBy || args.group_by)
    : 'day';

  let periodExpr = "strftime('%Y-%m-%d', created_at)";
  if (groupBy === 'week') {
    periodExpr = "strftime('%Y-W%W', created_at)";
  } else if (groupBy === 'month') {
    periodExpr = "strftime('%Y-%m', created_at)";
  }

  const rows = db.prepare(`
    SELECT ${periodExpr} AS period,
           COUNT(*) AS order_count,
           ROUND(SUM(total_amount), 2) AS total_amount
    FROM orders
    WHERE date(created_at) >= date('now', ?)
    GROUP BY period
    ORDER BY period ASC
  `).all(`-${days - 1} days`);

  return { days, groupBy, items: rows };
}

function listComplaints(args = {}) {
  const db = getDb();
  const page = Math.max(parseInt(args.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(args.pageSize, 10) || 10, 1), 50);
  const offset = (page - 1) * pageSize;

  const conditions = ['1=1'];
  const params = [];

  if (args.type) {
    conditions.push('c.type = ?');
    params.push(String(args.type));
  }
  if (args.status) {
    conditions.push('c.status = ?');
    params.push(String(args.status));
  }
  if (args.orderNo || args.order_no) {
    conditions.push('o.order_no = ?');
    params.push(String(args.orderNo || args.order_no).trim().toUpperCase());
  }

  const where = conditions.join(' AND ');
  const total = db.prepare(`
    SELECT COUNT(*) AS count
    FROM order_complaints c
    JOIN orders o ON o.id = c.order_id
    WHERE ${where}
  `).get(...params).count;

  const items = db.prepare(`
    SELECT c.*, o.order_no, u.name AS user_name
    FROM order_complaints c
    JOIN orders o ON o.id = c.order_id
    JOIN users u ON u.id = c.user_id
    WHERE ${where}
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset);

  return { page, pageSize, total, items };
}

function getComplaintById(id) {
  const db = getDb();
  const complaintId = parseInt(id, 10);
  if (!complaintId) return null;

  return db.prepare(`
    SELECT c.*, o.order_no, o.status AS order_status, o.total_amount,
           u.name AS user_name, u.phone AS user_phone, u.email AS user_email
    FROM order_complaints c
    JOIN orders o ON o.id = c.order_id
    JOIN users u ON u.id = c.user_id
    WHERE c.id = ?
  `).get(complaintId);
}

function complaintStatsByType() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT type, COUNT(*) AS complaint_count
    FROM order_complaints
    GROUP BY type
    ORDER BY complaint_count DESC
  `).all();
  return { byType: rows };
}

function complaintStatsByStatus() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT status, COUNT(*) AS complaint_count
    FROM order_complaints
    GROUP BY status
    ORDER BY status
  `).all();
  return { byStatus: rows };
}

function listUsers() {
  const db = getDb();
  return db.prepare('SELECT * FROM users ORDER BY id ASC').all();
}

function listProducts() {
  const db = getDb();
  return db.prepare('SELECT * FROM products ORDER BY id ASC').all();
}

function listOrders(args = {}) {
  return searchOrders({ ...args, pageSize: args.pageSize || 20 });
}

function getDashboardStats() {
  const db = getDb();
  const orderSummary = db.prepare(`
    SELECT
      COUNT(*) AS total_orders,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
      SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) AS shipped_count,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
      ROUND(SUM(total_amount), 2) AS total_amount
    FROM orders
  `).get();
  const complaintSummary = db.prepare(`
    SELECT COUNT(*) AS total_complaints,
           SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open_count
    FROM order_complaints
  `).get();
  return { orders: orderSummary, complaints: complaintSummary };
}

module.exports = {
  getDb,
  resetDbInstance,
  resolveDbPath,
  getOrderByOrderNo,
  searchOrders,
  orderStatsByStatus,
  orderStatsByPeriod,
  listComplaints,
  getComplaintById,
  complaintStatsByType,
  complaintStatsByStatus,
  listUsers,
  listProducts,
  listOrders,
  getDashboardStats
};
