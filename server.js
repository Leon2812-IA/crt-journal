 var express = require('express');
  var cors = require('cors');
  var bcrypt = require('bcryptjs');
  var jwt = require('jsonwebtoken');
  var crypto = require('crypto');
  var path = require('path');

  var app = express();
  var PORT = process.env.PORT || 3000;
  var JWT_SECRET = process.env.JWT_SECRET || 'crt_journal_secret_key_2026';

  var ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || 'traderleon2026';
  var ACCESS_HASH = crypto.createHash('sha256').update(ACCESS_PASSWORD).digest('hex');

  var db = { users: [], cuentas: [], trades: [], retiros: [] };

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.static(path.join(__dirname, 'public')));

  function authMiddleware(req, res, next) {
    var token = req.headers.authorization;
    if (!token || !token.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
    token = token.split(' ')[1];
    try {
      var decoded = jwt.verify(token, JWT_SECRET);
      req.userId = decoded.userId;
      next();
    } catch (e) {
      res.status(401).json({ error: 'Token invalido' });
    }
  }

  // ===== ACCESO POR CONTRASEÑA =====
  app.post('/api/verify-access', function(req, res) {
    var password = req.body.password;
    if (!password) return res.status(400).json({ success: false, error: 'Contrasena requerida' });
    var inputHash = crypto.createHash('sha256').update(password).digest('hex');
    if (inputHash === ACCESS_HASH) {
      var userId = 1;
      var token = jwt.sign({ userId: userId }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ success: true, token: token });
    } else {
      res.status(401).json({ success: false, error: 'Contrasena incorrecta' });
    }
  });

  app.get('/api/verify-token', function(req, res) {
    var token = req.headers.authorization;
    if (!token || !token.startsWith('Bearer ')) return res.json({ valid: false });
    token = token.split(' ')[1];
    try { jwt.verify(token, JWT_SECRET); res.json({ valid: true }); }
    catch (e) { res.json({ valid: false }); }
  });

  // ===== REGISTRO / LOGIN =====
  app.post('/api/registro', async function(req, res) {
    var email = req.body.email;
    var password = req.body.password;
    var nombre = req.body.nombre;
    if (!email || !password) return res.status(400).json({ error: 'Email y contrasena requeridos' });
    var existe = db.users.find(function(u) { return u.email === email; });
    if (existe) return res.status(400).json({ error: 'Email ya registrado' });
    var hashedPassword = await bcrypt.hash(password, 10);
    var userId = db.users.length + 1;
    db.users.push({ id: userId, email: email, password: hashedPassword, nombre: nombre || 'Trader', suscripcion_activa: 0,
  fecha_expiracion: null });
    db.cuentas.push({ id: 1, user_id: userId, nombre: '50K Demo', empresa: 'Prop Firm', tamano: 50000, invertido: 0, objetivo: 1250,
  consistenciaPct: 35 });
    var token = jwt.sign({ userId: userId }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token: token, userId: userId, nombre: nombre || 'Trader', suscripcion_activa: false });
  });

  app.post('/api/login', async function(req, res) {
    var email = req.body.email;
    var password = req.body.password;
    var user = db.users.find(function(u) { return u.email === email; });
    if (!user) return res.status(400).json({ error: 'Email no encontrado' });
    var valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Contrasena incorrecta' });
    var token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    var suscripcionActiva = user.suscripcion_activa === 1;
    res.json({ token: token, userId: user.id, nombre: user.nombre, suscripcion_activa: suscripcionActiva });
  });

  app.get('/api/datos', authMiddleware, function(req, res) {
    var cuentas = db.cuentas.filter(function(c) { return c.user_id === req.userId; });
    var trades = db.trades.filter(function(t) { return t.user_id === req.userId; });
    var retiros = db.retiros.filter(function(r) { return r.user_id === req.userId; });
    res.json({ cuentas: cuentas, trades: trades, retiros: retiros });
  });

  app.post('/api/datos', authMiddleware, function(req, res) {
    db.cuentas = db.cuentas.filter(function(c) { return c.user_id !== req.userId; });
    db.trades = db.trades.filter(function(t) { return t.user_id !== req.userId; });
    db.retiros = db.retiros.filter(function(r) { return r.user_id !== req.userId; });
    if (req.body.cuentas) req.body.cuentas.forEach(function(c) { c.user_id = req.userId; db.cuentas.push(c); });
    if (req.body.trades) req.body.trades.forEach(function(t) { t.user_id = req.userId; db.trades.push(t); });
    if (req.body.retiros) req.body.retiros.forEach(function(r) { r.user_id = req.userId; db.retiros.push(r); });
    res.json({ success: true });
  });

  app.get('*', function(req, res) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.listen(PORT, function() {
    console.log('CRT JOURNAL corriendo en puerto ' + PORT);
  });

  Contraseña por defecto: traderleon2026 (configurable en Render con variable de entorno ACCESS_PASSWORD)
