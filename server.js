const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'tjp_secret_key_2026';

let db = { users: [], cuentas: [], trades: [], retiros: [] };

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
  if (db.users.find(u => u.email === email)) return res.status(400).json({ error: 'Email ya registrado' });
  
  const hashedPassword = await bcrypt.hash(password, 10);
  const userId = db.users.length + 1;
  db.users.push({ id: userId, email, password: hashedPassword, nombre: nombre || 'Trader', suscripcion_activa: 0, fecha_expiracion: null });
  db.cuentas.push({ id: 1, user_id: userId, nombre: '50K Demo', empresa: 'Prop Firm', tamano: 50000, invertido: 0, objetivo: 1250, consistenciaPct: 35 });
  
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, userId, nombre: nombre || 'Trader', suscripcion_activa: false });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.users.find(u => u.email === email);
  if (!user) return res.status(400).json({ error: 'Email no encontrado' });
  
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: 'Contrasena incorrecta' });
  
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
  const suscripcionActiva = user.suscripcion_activa === 1;
  res.json({ token, userId: user.id, nombre: user.nombre, suscripcion_activa: suscripcionActiva });
});

app.get('/api/datos', authMiddleware, (req, res) => {
  const cuentas = db.cuentas.filter(c => c.user_id === req.userId);
  const trades = db.trades.filter(t => t.user_id === req.userId);
  const retiros = db.retiros.filter(r => r.user_id === req.userId);
  res.json({ cuentas, trades, retiros });
});

app.post('/api/datos', authMiddleware, (req, res) => {
  const { cuentas, trades, retiros } = req.body;
  db.cuentas = db.cuentas.filter(c => c.user_id !== req.userId);
  db.trades = db.trades.filter(t => t.user_id !== req.userId);
  db.retiros = db.retiros.filter(r => r.user_id !== req.userId);
  if (cuentas) cuentas.forEach(c => db.cuentas.push({ ...c, user_id: req.userId }));
  if (trades) trades.forEach(t => db.trades.push({ ...t, user_id: req.userId }));
  if (retiros) retiros.forEach(r => db.retiros.push({ ...r, user_id: req.userId }));
  res.json({ success: true });
});

app.get('/api/estado-suscripcion', authMiddleware, (req, res) => {
  const user = db.users.find(u => u.id === req.userId);
  res.json({ suscripcion_activa: user?.suscripcion_activa === 1, fecha_expiracion: user?.fecha_expiracion });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('Trading Journal Pro corriendo en puerto ' + PORT);
});
