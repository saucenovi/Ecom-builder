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

function seedProducts() {
  const add = db.prepare('INSERT OR IGNORE INTO products (name,slug,description,price,compare_at,image,category,inventory,featured) VALUES (?,?,?,?,?,?,?,?,?)');
  const products = [
    ['Pocket Pixel Projector','pocket-pixel-projector','Turn any wall into movie night with a palm-sized HD projector.',69.99,99.99,'https://images.unsplash.com/photo-1535016120720-40c646be5580?auto=format&fit=crop&w=900&q=80','Gadgets',35,1],
    ['Magnetic Desk Cable Dock','magnetic-cable-dock','Keep your charging cables exactly where you need them.',18.99,29.99,'https://images.unsplash.com/photo-1586953208448-b95a79798f07?auto=format&fit=crop&w=900&q=80','Small Electronics',58,1],
    ['RGB Sunset Lamp','rgb-sunset-lamp','Set the mood with warm, colorful ambient light.',34.99,49.99,'https://images.unsplash.com/photo-1550985543-f6f2a9b8a2b1?auto=format&fit=crop&w=900&q=80','Small Electronics',41,1],
    ['Retro Mini Arcade','retro-mini-arcade','Classic arcade fun in a tiny desktop cabinet.',44.99,64.99,'https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=900&q=80','Toys Adults Love',22,1],
    ['Build-Your-Own Marble Run','marble-run','A satisfying desk toy for creative hands and curious minds.',27.99,39.99,'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=900&q=80','Toys Adults Love',47,0],
    ['Funny Meeting Survivor Tee','meeting-survivor-tee','Soft unisex tee for anyone who has survived one meeting too many.',27.99,36.99,'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80','Funny Shirts',27,1],
    ['Snack-Based Workout Tee','snack-workout-tee','Athletic energy, questionable priorities.',27.99,36.99,'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80','Funny Shirts',33,0],
    ['Wireless Charging Alarm Clock','charging-alarm-clock','Wake up, charge up, and keep your nightstand tidy.',39.99,59.99,'https://images.unsplash.com/photo-1508057198894-247b23fe5ade?auto=format&fit=crop&w=900&q=80','Small Electronics',29,0],
    ['Desktop Zen Garden','desktop-zen-garden','A tiny reset button for busy workdays.',21.99,31.99,'https://images.unsplash.com/photo-1497250681960-ef046c08a56e?auto=format&fit=crop&w=900&q=80','Toys Adults Love',54,0],
    ['Pocket Bluetooth Speaker','pocket-bluetooth-speaker','Small speaker, big sound, ready for every room.',32.99,49.99,'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=80','Gadgets',36,0],
    ['Nope Not Today Tee','nope-not-today-tee','The official uniform of protecting your peace.',27.99,36.99,'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=900&q=80','Funny Shirts',40,0],
    ['USB Mug Warmer','usb-mug-warmer','Keep your coffee warm through the entire email thread.',24.99,34.99,'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=900&q=80','Gadgets',45,0]
  ];
  products.forEach(product => add.run(...product));
}
function init() {
  db.pragma('foreign_keys = ON');
  db.exec(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, description TEXT NOT NULL, price REAL NOT NULL CHECK(price >= 0), compare_at REAL, image TEXT NOT NULL, category TEXT NOT NULL, inventory INTEGER NOT NULL DEFAULT 0 CHECK(inventory >= 0), featured INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', total REAL NOT NULL, shipping_name TEXT NOT NULL, shipping_address TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id));
  CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL, product_id INTEGER NOT NULL, quantity INTEGER NOT NULL, price REAL NOT NULL, FOREIGN KEY(order_id) REFERENCES orders(id), FOREIGN KEY(product_id) REFERENCES products(id));`);
  seedProducts();
  if (!db.prepare('SELECT 1 FROM users WHERE email=?').get('admin@droply.test')) { const add = db.prepare('INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)'); add.run('Demo Customer','demo@droply.test',bcrypt.hashSync('password123',10),'customer'); add.run('Store Admin','admin@droply.test',bcrypt.hashSync('password123',10),'admin'); }
}
init();
const publicUser = user => user && ({ id:user.id,name:user.name,email:user.email,role:user.role });
const publicProduct = product => ({ ...product, featured:Boolean(product.featured) });
const cleanEmail = email => String(email || '').trim().toLowerCase();
function auth(req,res,next){ try { const header=req.headers.authorization||''; if(!header.startsWith('Bearer ')) throw Error(); req.user=jwt.verify(header.slice(7),secret); next(); } catch { res.status(401).json({error:'Please sign in to continue.'}); } }
function admin(req,res,next){ return req.user.role==='admin' ? next() : res.status(403).json({error:'Admin access required.'}); }
app.get('/api/health',(req,res)=>res.json({ok:true,service:'droply'}));
app.get('/api/products',(req,res)=>{const {category,q,featured}=req.query;let sql='SELECT * FROM products WHERE 1=1';const args=[];if(category&&category!=='All'){sql+=' AND category=?';args.push(category)}if(q){sql+=' AND (name LIKE ? OR description LIKE ?)';args.push(`%${q}%`,`%${q}%`)}if(featured==='true')sql+=' AND featured=1';res.json(db.prepare(sql+' ORDER BY featured DESC,id DESC').all(...args).map(publicProduct))});
app.get('/api/products/:slug',(req,res)=>{const product=db.prepare('SELECT * FROM products WHERE slug=?').get(req.params.slug);product?res.json(publicProduct(product)):res.status(404).json({error:'Product not found.'})});
app.post('/api/auth/register',(req,res)=>{const name=String(req.body.name||'').trim(),email=cleanEmail(req.body.email),password=String(req.body.password||'');if(name.length<2||!email.includes('@')||password.length<8)return res.status(400).json({error:'Name, valid email, and an 8+ character password are required.'});try{const result=db.prepare('INSERT INTO users (name,email,password) VALUES (?,?,?)').run(name,email,bcrypt.hashSync(password,10));const user=db.prepare('SELECT * FROM users WHERE id=?').get(result.lastInsertRowid);res.status(201).json({user:publicUser(user),token:jwt.sign({id:user.id,role:user.role},secret,{expiresIn:'7d'})})}catch{res.status(409).json({error:'An account with that email already exists.'})}});
app.post('/api/auth/login',(req,res)=>{const user=db.prepare('SELECT * FROM users WHERE email=?').get(cleanEmail(req.body.email));if(!user||!bcrypt.compareSync(String(req.body.password||''),user.password))return res.status(401).json({error:'Invalid email or password.'});res.json({user:publicUser(user),token:jwt.sign({id:user.id,role:user.role},secret,{expiresIn:'7d'})})});
app.get('/api/me',auth,(req,res)=>res.json(publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id))));
app.post('/api/orders',auth,(req,res)=>{const {items,shipping}=req.body;if(!Array.isArray(items)||!items.length||!shipping?.name||!shipping?.address)return res.status(400).json({error:'Cart and complete shipping details are required.'});const get=db.prepare('SELECT * FROM products WHERE id=?'),lines=[];let total=0;for(const item of items){const product=get.get(Number(item.productId)),quantity=Number(item.quantity);if(!product||!Number.isInteger(quantity)||quantity<1||quantity>99||product.inventory<quantity)return res.status(400).json({error:`${product?.name||'A product'} is unavailable in that quantity.`});lines.push({product,quantity});total+=product.price*quantity}const create=db.transaction(()=>{const order=db.prepare('INSERT INTO orders (user_id,total,shipping_name,shipping_address) VALUES (?,?,?,?)').run(req.user.id,Number(total.toFixed(2)),String(shipping.name).trim(),String(shipping.address).trim());const add=db.prepare('INSERT INTO order_items (order_id,product_id,quantity,price) VALUES (?,?,?,?)'),stock=db.prepare('UPDATE products SET inventory=inventory-? WHERE id=?');lines.forEach(({product,quantity})=>{add.run(order.lastInsertRowid,product.id,quantity,product.price);stock.run(quantity,product.id)});return order.lastInsertRowid});res.status(201).json({orderId:create(),total:Number(total.toFixed(2)),status:'pending'})});
app.get('/api/orders',auth,(req,res)=>res.json(db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC').all(req.user.id)));
app.get('/api/admin/orders',auth,admin,(req,res)=>res.json(db.prepare('SELECT orders.*,users.email FROM orders JOIN users ON users.id=orders.user_id ORDER BY orders.created_at DESC').all()));
app.patch('/api/admin/orders/:id',auth,admin,(req,res)=>{const allowed=['pending','processing','shipped','delivered','cancelled'];if(!allowed.includes(req.body.status))return res.status(400).json({error:'Invalid status.'});db.prepare('UPDATE orders SET status=? WHERE id=?').run(req.body.status,req.params.id);res.json({ok:true})});
app.use(express.static(path.join(__dirname,'public')));app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));app.listen(PORT,()=>console.log(`Droply running at http://localhost:${PORT}`));
