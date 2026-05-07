const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'crt_journal_secret_key_2026';

const db = new Database('crt_journal.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nombre TEXT DEFAULT 'Trader',
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    suscripcion_activa INTEGER DEFAULT 0,
    fecha_expiracion DATE
  );
  
  CREATE TABLE IF NOT EXISTS cuentas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    nombre TEXT,
    empresa TEXT,
    tamano REAL,
    invertido REAL,
    objetivo REAL,
    consistenciaPct REAL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  
  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    cuenta_id INTEGER,
    fecha DATE,
    hora_entrada TEXT,
    hora_salida TEXT,
    activo TEXT,
    tipo TEXT,
    cierre TEXT,
    resultado REAL,
    resultado_pct REAL,
    notas TEXT,
    imagen TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  
  CREATE TABLE IF NOT EXISTS retiros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    cuenta_id INTEGER,
    monto REAL,
    fecha DATE,
    notas TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Token invalido' });
  }
}

app.post('/api/registro', async (req, res) => {
  const { email, password, nombre } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y contrasena requeridos' });
  
  const existe = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existe) return res.status(400).json({ error: 'Email ya registrado' });
  
  const hashedPassword = await bcrypt.hash(password, 10);
  const result = db.prepare('INSERT INTO users (email, password, nombre) VALUES (?, ?, ?)').run(email, hashedPassword, nombre || 'Trader');
  
  db.prepare('INSERT INTO cuentas (user_id, nombre, empresa, tamano, invertido, objetivo, consistenciaPct) VALUES (?, ?, ?, ?, ?, ?, ?)').run(result.lastInsertRowid, '50K Demo', 'CRT', 50000, 0, 1250, 35);
  
  const token = jwt.sign({ userId: result.lastInsertRowid }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, userId: result.lastInsertRowid, nombre: nombre || 'Trader', suscripcion_activa: false });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(400).json({ error: 'Email no encontrado' });
  
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: 'Contrasena incorrecta' });
  
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
  const suscripcionActiva = user.suscripcion_activa === 1 && (!user.fecha_expiracion || new Date(user.fecha_expiracion) > new Date());
  
  res.json({ token, userId: user.id, nombre: user.nombre, suscripcion_activa: suscripcionActiva });
});

app.get('/api/datos', authMiddleware, (req, res) => {
  const cuentas = db.prepare('SELECT * FROM cuentas WHERE user_id = ?').all(req.userId);
  const trades = db.prepare('SELECT * FROM trades WHERE user_id = ?').all(req.userId);
  const retiros = db.prepare('SELECT * FROM retiros WHERE user_id = ?').all(req.userId);
  res.json({ cuentas, trades, retiros });
});

app.post('/api/datos', authMiddleware, (req, res) => {
  const { cuentas, trades, retiros } = req.body;
  
  db.prepare('DELETE FROM cuentas WHERE user_id = ?').run(req.userId);
  db.prepare('DELETE FROM trades WHERE user_id = ?').run(req.userId);
  db.prepare('DELETE FROM retiros WHERE user_id = ?').run(req.userId);
  
  if (cuentas) {
    const insertCuenta = db.prepare('INSERT INTO cuentas (user_id, nombre, empresa, tamano, invertido, objetivo, consistenciaPct) VALUES (?, ?, ?, ?, ?, ?, ?)');
    cuentas.forEach(c => insertCuenta.run(req.userId, c.nombre, c.empresa, c.tamano, c.invertido, c.objetivo, c.consistenciaPct));
  }
  if (trades) {
    const insertTrade = db.prepare('INSERT INTO trades (user_id, cuenta_id, fecha, hora_entrada, hora_salida, activo, tipo, cierre, resultado, resultado_pct, notas, imagen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    trades.forEach(t => insertTrade.run(req.userId, t.cuenta_id, t.fecha, t.hora_entrada, t.hora_salida, t.activo, t.tipo, t.cierre, t.resultado, t.resultado_pct, t.notas, t.imagen));
  }
  if (retiros) {
    const insertRetiro = db.prepare('INSERT INTO retiros (user_id, cuenta_id, monto, fecha, notas) VALUES (?, ?, ?, ?, ?)');
    retiros.forEach(r => insertRetiro.run(req.userId, r.cuenta_id, r.monto, r.fecha, r.notas));
  }
  
  res.json({ success: true });
});

app.get('/api/estado-suscripcion', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT suscripcion_activa, fecha_expiracion FROM users WHERE id = ?').get(req.userId);
  const activa = user.suscripcion_activa === 1 && (!user.fecha_expiracion || new Date(user.fecha_expiracion) > new Date());
  res.json({ suscripcion_activa: activa, fecha_expiracion: user.fecha_expiracion });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('CRT JOURNAL corriendo en puerto ' + PORT);
});
