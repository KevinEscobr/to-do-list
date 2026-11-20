try {
  require('dotenv').config();
} catch (_) {}

const express = require('express');
const cors = require('cors');

const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth.routes');
const taskRoutes = require('./routes/task.routes');

const app = express();
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// Configuración de CORS para permitir conexiones desde la app web e híbrida (Capacitor Android/iOS)
app.use(
  cors({
    origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(','),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Parser de JSON con límite ampliado a 15mb para permitir imágenes base64 tomadas con la cámara
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Registro simple de peticiones (Logging)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Endpoint de verificación de salud (Health check para Render, Railway, AWS, etc.)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'TaskFlow Pro Backend API',
    uptime: process.uptime(),
    timestamp: Date.now(),
    database: 'SQLite Conectado',
  });
});

// Registrar rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);

// Servir la aplicación web (Frontend Angular/Ionic compilado en public/ si existe)
const publicDir = path.join(__dirname, '../public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get('*', (req, res, next) => {
    if (req.originalUrl.startsWith('/api')) return next();
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

// Manejo de rutas inexistentes de la API (404)
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Ruta de la API no encontrada',
    path: req.originalUrl,
  });
});

// Manejo centralizado de errores
app.use((err, req, res, next) => {
  console.error(' Error en el servidor:', err);
  res.status(err.status || 500).json({
    error: 'Error interno del servidor',
    message: err.message,
  });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log('====================================================');
  console.log(`🚀 TaskFlow Pro API corriendo en http://localhost:${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Rutas Auth:   http://localhost:${PORT}/api/auth`);
  console.log(`📝 Rutas Tareas: http://localhost:${PORT}/api/tasks`);
  console.log('====================================================');
});
