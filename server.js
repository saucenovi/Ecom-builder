const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
require('dotenv').config();

const app = express();
const db = new Database(process.env.DB_FILE || 'droply.db');
const PORT = Number(process.env.PORT || 3000);
const secret = process.env.JWT_SECRET || 'development-only-secret';
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

function init() {
  db.pragma('foreign_keys = ON');
  db.exec(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, description TEXT NOT NULL, price REAL NOT NULL CHECK(price >= 0), compare_at REAL, image TEXT NOT NULL, category TEXT NOT NULL, inventory INTEGER NOT NULL DEFAULT 0 CHECK(inventory >= 0), featured INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', total REAL NOT NULL, shipping_name TEXT NOT NULL, shipping_address TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL, product_id INTEGER NOT NULL, quantity INTEGER NOT NULL CHECK(quantity > 0), price REAL NOT NULL, FOREIGN KEY(order_id) REFERENCES orders(id), FOREIGN KEY(product_id) REFERENCES products(id));`);
  if (!db.prepare('SELECT 1 FROM products LIMIT 1').get()) {
    const add = db.prepare('INSERT INTO products (name,slug,description,price,compare_at,image,category,inventory,featured) VALUES (?,?,?,?,?,?,?,?,?)');
    [
      ['Cloud Knit Lounge Set','cloud-knit-set','Soft, breathable comfort for slow mornings and travel days.',49.99,79.99,'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80','Apparel',42,1],
      ['Arc Ceramic Table Lamp','arc-ceramic-lamp','A warm sculptural glow for your desk or bedside table.',64,92,'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80','Home',18,1],
      ['Everyday Carry Sling','everyday-sling','Water-resistant crossbody storage for daily essentials.',38.5,55,'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80','Accessories',64,1],
      ['Stoneware Matcha Set','matcha-set','Hand-finished cup, whisk and scoop for a calmer ritual.',32,45,'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=900&q=80','Kitchen',31,0],
      ['Minimal Chronograph','minimal-watch','A clean everyday watch with a brushed steel case.',89,129,'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=900&q=80','Accessories',12,0],
      ['Linen Throw Blanket','linen-throw','Textured natural linen to layer over sofa or bed.',71,99,'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=900&q=80','Home',25,0],
      ['Ribbed Everyday Tee','ribbed-tee','A structured cotton tee designed for repeat wear.',26,39,'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80','Apparel',70,0],
      ['Woven Market Tote','woven-tote','A roomy, reusable tote with reinforced handles.',29,42,'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=900&q=80','Accessories',46,0],
      ['Cedar Candle','cedar-candle','Soy wax, cedarwood, and a clean 40-hour burn.',24,34,'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=900&q=80','Home',55,0],
      ['Pour Over Brewer','pour-over','A compact glass brewer for a better morning cup.',28,40,'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80','Kitchen',37,0],
      ['Soft Dad Cap','soft-cap','Unstructured cotton cap with an adjustable back strap.',22,31,'https://images.unsplash.com/photo-1521369909029-2afed882baee?auto=format&fit=crop&w=900&q=80','Apparel',80,0],
      ['Travel Organizer','travel-organizer','Smart compartments for cables, cards, and small essentials.',34,49,'https://images.unsplash.com/photo-1553531384-cc64ac80f931?auto=format&fit=crop&w=900&q=80','Accessories',29,0]
    ].forEach(product => add.run(...product));
  }
  if (!db.prepare('SELECT 1 FROM users WHERE email=?').get('admin@droply.test')) {
    const add = db.prepare('INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)');
    add.run('Demo Customer','demo@droply.test',bcrypt.hashSync('password123', 10),'customer');
    add.run('Store Admin','admin@droply.test',bcrypt.hashSync('password123', 10),'admin');
  }
}
init();

const publicUser = user => user && ({ id: user.id, name: user.name, email: user.email, role: user.role });
const publicProduct = product => product && ({ ...product, featured: Boolean(product.featured) });
function issueToken(user) { return jwt.sign({ id: user.id, role: user.role }, secret, { expiresIn: '7d' }); }
function auth(req, res, next) { try { const header = req.headers.authorization || ''; if (!header.startsWith('Bearer ')) throw new Error(); req.user = jwt.verify(header.slice(7), secret); next(); } catch { res.status(401).json({ error: 'Please sign in to continue.' }); } }
function admin(req, res, next) { return req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Admin access required.' }); }
function cleanEmail(email) { return String(email || '').trim().toLowerCase(); }

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'droply', time: new Date().toISOString() }));
app.get('/api/products', (req, res) => { const { category, q, featured } = req.query; let sql = 'SELECT * FROM products WHERE 1=1'; const args = []; if (category && category !== 'All') { sql += ' AND category=?'; args.push(category); } if (q) { sql += ' AND (name LIKE ? OR description LIKE ?)'; args.push(`%${q}%`, `%${q}%`); } if (featured === 'true') sql += ' AND featured=1'; res.json(db.prepare(sql + ' ORDER BY featured DESC, id DESC').all(...args).map(publicProduct)); });
app.get('/api/products/:slug', (req, res) => { const product = db.prepare('SELECT * FROM products WHERE slug=?').get(req.params.slug); return product ? res.json(publicProduct(product)) : res.status(404).json({ error: 'Product not found.' }); });
app.post('/api/auth/register', (req, res) => { const name = String(req.body.name || '').trim(); const email = cleanEmail(req.body.email); const password = String(req.body.password || ''); if (name.length < 2 || !email.includes('@') || password.length < 8) return res.status(400).json({ error: 'Name, valid email, and an 8+ character password are required.' }); try { const result = db.prepare('INSERT INTO users (name,email,password) VALUES (?,?,?)').run(name, email, bcrypt.hashSync(password, 10)); const user = db.prepare('SELECT * FROM users WHERE id=?').get(result.lastInsertRowid); res.status(201).json({ user: publicUser(user), token: issueToken(user) }); } catch { res.status(409).json({ error: 'An account with that email already exists.' }); } });
app.post('/api/auth/login', (req, res) => { const user = db.prepare('SELECT * FROM users WHERE email=?').get(cleanEmail(req.body.email)); if (!user || !bcrypt.compareSync(String(req.body.password || ''), user.password)) return res.status(401).json({ error: 'Invalid email or password.' }); res.json({ user: publicUser(user), token: issueToken(user) }); });
app.get('/api/me', auth, (req, res) => res.json(publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id))));
app.post('/api/orders', auth, (req, res) => { const { items, shipping } = req.body; if (!Array.isArray(items) || !items.length || !shipping || String(shipping.name || '').trim().length < 2 || String(shipping.address || '').trim().length < 8) return res.status(400).json({ error: 'Cart and complete shipping details are required.' }); const get = db.prepare('SELECT * FROM products WHERE id=?'); const lines = []; let total = 0; for (const item of items) { const product = get.get(Number(item.productId)); const quantity = Number(item.quantity); if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 99 || product.inventory < quantity) return res.status(400).json({ error: `${product?.name || 'A product'} is unavailable in that quantity.` }); lines.push({ product, quantity }); total += product.price * quantity; } const create = db.transaction(() => { const order = db.prepare('INSERT INTO orders (user_id,total,shipping_name,shipping_address) VALUES (?,?,?,?)').run(req.user.id, Number(total.toFixed(2)), String(shipping.name).trim(), String(shipping.address).trim()); const add = db.prepare('INSERT INTO order_items (order_id,product_id,quantity,price) VALUES (?,?,?,?)'); const stock = db.prepare('UPDATE products SET inventory=inventory-? WHERE id=?'); lines.forEach(({ product, quantity }) => { add.run(order.lastInsertRowid, product.id, quantity, product.price); stock.run(quantity, product.id); }); return order.lastInsertRowid; }); res.status(201).json({ orderId: create(), total: Number(total.toFixed(2)), status: 'pending' }); });
app.get('/api/orders', auth, (req, res) => res.json(db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC').all(req.user.id)));
app.get('/api/orders/:id', auth, (req, res) => { const order = db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(req.params.id, req.user.id); if (!order) return res.status(404).json({ error: 'Order not found.' }); order.items = db.prepare('SELECT order_items.*, products.name, products.image FROM order_items JOIN products ON products.id=order_items.product_id WHERE order_id=?').all(order.id); res.json(order); });
app.get('/api/admin/orders', auth, admin, (req, res) => res.json(db.prepare('SELECT orders.*, users.email FROM orders JOIN users ON users.id=orders.user_id ORDER BY orders.created_at DESC').all()));
app.patch('/api/admin/orders/:id', auth, admin, (req, res) => { const allowed = ['pending','processing','shipped','delivered','cancelled']; if (!allowed.includes(req.body.status)) return res.status(400).json({ error: 'Invalid status.' }); db.prepare('UPDATE orders SET status=? WHERE id=?').run(req.body.status, req.params.id); res.json({ ok: true }); });
app.post('/api/admin/products', auth, admin, (req, res) => { const p = req.body; if (!p.name || !p.slug || !p.description || !p.image || !p.category || !Number.isFinite(Number(p.price))) return res.status(400).json({ error: 'name, slug, description, price, image, and category are required.' }); try { const result = db.prepare('INSERT INTO products (name,slug,description,price,compare_at,image,category,inventory,featured) VALUES (?,?,?,?,?,?,?,?,?)').run(p.name,p.slug,p.description,Number(p.price),Number(p.compare_at || 0),p.image,p.category,Math.max(0,Number(p.inventory || 0)),p.featured ? 1 : 0); res.status(201).json(publicProduct(db.prepare('SELECT * FROM products WHERE id=?').get(result.lastInsertRowid))); } catch { res.status(409).json({ error: 'Product slug already exists.' }); } });
app.patch('/api/admin/products/:id', auth, admin, (req, res) => { const fields = ['name','description','price','compare_at','image','category','inventory','featured']; const updates = fields.filter(key => req.body[key] !== undefined); if (!updates.length) return res.status(400).json({ error: 'No product fields supplied.' }); const values = updates.map(key => key === 'featured' ? (req.body[key] ? 1 : 0) : req.body[key]); db.prepare(`UPDATE products SET ${updates.map(key => `${key}=?`).join(',')} WHERE id=?`).run(...values, req.params.id); const product = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id); product ? res.json(publicProduct(product)) : res.status(404).json({ error: 'Product not found.' }); });

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`Droply running at http://localhost:${PORT}`));
