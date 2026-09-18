const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
require('dotenv').config();

const app = express();
const db = new Database(process.env.DB_FILE || 'droply.db');
const PORT = process.env.PORT || 3000;
const secret = process.env.JWT_SECRET || 'development-only-secret';
app.use(express.json());

function init() {
  db.exec(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, description TEXT, price REAL NOT NULL, compare_at REAL, image TEXT NOT NULL, category TEXT NOT NULL, inventory INTEGER NOT NULL DEFAULT 100, featured INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', total REAL NOT NULL, shipping_name TEXT NOT NULL, shipping_address TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL, product_id INTEGER NOT NULL, quantity INTEGER NOT NULL, price REAL NOT NULL, FOREIGN KEY(order_id) REFERENCES orders(id));`);
  const count = db.prepare('SELECT COUNT(*) count FROM products').get().count;
  if (!count) {
    const add = db.prepare('INSERT INTO products (name,slug,description,price,compare_at,image,category,inventory,featured) VALUES (?,?,?,?,?,?,?,?,?)');
    const products = [
      ['Cloud Knit Lounge Set','cloud-knit-set','Soft, breathable comfort for slow mornings and travel days.',49.99,79.99,'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80','Apparel',42,1],
      ['Arc Ceramic Table Lamp','arc-ceramic-lamp','A warm sculptural glow for your desk or bedside table.',64.00,92.00,'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80','Home',18,1],
      ['Everyday Carry Sling','everyday-sling','Water-resistant crossbody storage for essentials.',38.50,55.00,'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80','Accessories',64,1],
      ['Stoneware Matcha Set','matcha-set','Hand-finished cup, whisk and scoop for a calmer ritual.',32.00,45.00,'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=900&q=80','Kitchen',31,0],
      ['Minimal Chronograph','minimal-watch','A clean everyday watch with a brushed steel case.',89.00,129.00,'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=900&q=80','Accessories',12,0],
      ['Linen Throw Blanket','linen-throw','Textured natural linen to layer over sofa or bed.',71.00,99.00,'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=900&q=80','Home',25,0]
    ]; products.forEach(p => add.run(...p));
  }
  if (!db.prepare('SELECT 1 FROM users WHERE email=?').get('admin@droply.test')) {
    const addUser = db.prepare('INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)');
    addUser.run('Demo Customer','demo@droply.test',bcrypt.hashSync('password123',10),'customer');
    addUser.run('Store Admin','admin@droply.test',bcrypt.hashSync('password123',10),'admin');
  }
}
init();

const publicUser = row => row && ({ id: row.id, name: row.name, email: row.email, role: row.role });
function token(user) { return jwt.sign({ id: user.id, role: user.role }, secret, { expiresIn: '7d' }); }
function auth(req, res, next) { try { req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), secret); next(); } catch { res.status(401).json({ error: 'Please sign in to continue.' }); } }
function admin(req, res, next) { if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' }); next(); }

app.get('/api/products', (req, res) => { const { category, q, featured } = req.query; let sql = 'SELECT * FROM products WHERE 1=1', args = []; if (category && category !== 'All') { sql += ' AND category=?'; args.push(category); } if (q) { sql += ' AND (name LIKE ? OR description LIKE ?)'; args.push(`%${q}%`, `%${q}%`); } if (featured === 'true') sql += ' AND featured=1'; res.json(db.prepare(sql + ' ORDER BY featured DESC, created_at DESC').all(...args)); });
app.get('/api/products/:slug', (req, res) => { const product = db.prepare('SELECT * FROM products WHERE slug=?').get(req.params.slug); product ? res.json(product) : res.status(404).json({ error: 'Product not found.' }); });
app.post('/api/auth/register', (req, res) => { const { name, email, password } = req.body; if (!name || !email || !password || password.length < 8) return res.status(400).json({ error: 'Name, email and an 8+ character password are required.' }); try { const result = db.prepare('INSERT INTO users (name,email,password) VALUES (?,?,?)').run(name.trim(), email.toLowerCase().trim(), bcrypt.hashSync(password, 10)); const user = db.prepare('SELECT * FROM users WHERE id=?').get(result.lastInsertRowid); res.status(201).json({ user: publicUser(user), token: token(user) }); } catch { res.status(409).json({ error: 'An account with that email already exists.' }); } });
app.post('/api/auth/login', (req, res) => { const user = db.prepare('SELECT * FROM users WHERE email=?').get((req.body.email || '').toLowerCase().trim()); if (!user || !bcrypt.compareSync(req.body.password || '', user.password)) return res.status(401).json({ error: 'Invalid email or password.' }); res.json({ user: publicUser(user), token: token(user) }); });
app.get('/api/me', auth, (req, res) => res.json(publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id))));
app.post('/api/orders', auth, (req, res) => { const { items, shipping } = req.body; if (!Array.isArray(items) || !items.length || !shipping?.name || !shipping?.address) return res.status(400).json({ error: 'Cart and shipping details are required.' }); const get = db.prepare('SELECT * FROM products WHERE id=?'); let total = 0, lines = []; for (const item of items) { const p = get.get(item.productId); const quantity = Math.max(1, Math.min(99, Number(item.quantity))); if (!p || p.inventory < quantity) return res.status(400).json({ error: `${p?.name || 'A product'} is unavailable.` }); total += p.price * quantity; lines.push({ p, quantity }); } const create = db.transaction(() => { const order = db.prepare('INSERT INTO orders (user_id,total,shipping_name,shipping_address) VALUES (?,?,?,?)').run(req.user.id, total, shipping.name, shipping.address); const add = db.prepare('INSERT INTO order_items (order_id,product_id,quantity,price) VALUES (?,?,?,?)'); const stock = db.prepare('UPDATE products SET inventory=inventory-? WHERE id=?'); lines.forEach(({p,quantity}) => { add.run(order.lastInsertRowid,p.id,quantity,p.price); stock.run(quantity,p.id); }); return order.lastInsertRowid; }); res.status(201).json({ orderId: create(), total }); });
app.get('/api/orders', auth, (req, res) => res.json(db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC').all(req.user.id)));
app.get('/api/admin/orders', auth, admin, (req, res) => res.json(db.prepare('SELECT orders.*, users.email FROM orders JOIN users ON users.id=orders.user_id ORDER BY orders.created_at DESC').all()));
app.patch('/api/admin/orders/:id', auth, admin, (req, res) => { const allowed = ['pending','processing','shipped','delivered','cancelled']; if (!allowed.includes(req.body.status)) return res.status(400).json({ error: 'Invalid status.' }); db.prepare('UPDATE orders SET status=? WHERE id=?').run(req.body.status, req.params.id); res.json({ ok: true }); });
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`Droply running at http://localhost:${PORT}`));
