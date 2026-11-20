const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const WWW_DIR = path.resolve(__dirname, '..', 'www');
const OUT_DIR = path.resolve(__dirname, '..', 'screenshots');
const PORT = 4280;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function createStaticServer() {
  return http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/') reqPath = '/index.html';
    let filePath = path.join(WWW_DIR, reqPath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(WWW_DIR, 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}

async function captureAll() {
  const server = createStaticServer();
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  console.log(`Servidor local listo en http://127.0.0.1:${PORT}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  const page = await context.newPage();

  // 1. Pantalla de Login y Autenticación
  console.log('Capturando 01_login_autenticacion.png...');
  await page.goto(`http://127.0.0.1:${PORT}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT_DIR, '01_login_autenticacion.png') });

  // Iniciar sesión con Demo
  console.log('Iniciando sesión con usuario Demo...');
  const quickDemoBtn = page.getByRole('button', { name: /Acceso Rápido Demo/i });
  await quickDemoBtn.click();
  await page.waitForURL('**/home', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Sembrar tareas enriquecidas con periféricos (Cámara, GPS, Clima)
  await page.evaluate(() => {
    const tasks = [
      {
        id: 1731600001,
        userId: 'usr_demo_101',
        text: 'Inspección de equipamiento y cableado en terreno',
        description: 'Verificación visual de conexiones y captura fotográfica de tableros.',
        category: 'Trabajo',
        priority: 'Alta',
        completed: false,
        createdAt: Date.now() - 3600000,
        imageUrl:
          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%231e3c72"/><circle cx="200" cy="150" r="70" fill="%232a5298"/><text x="200" y="155" font-size="22" font-family="sans-serif" fill="white" text-anchor="middle">Foto Adjunta (Cámara)</text></svg>',
        location: {
          latitude: -33.4489,
          longitude: -70.6693,
          accuracy: 12,
          address: 'Plaza de Armas, Santiago, Chile',
          city: 'Santiago',
          country: 'Chile',
        },
        weather: {
          temperature: 22,
          weatherCode: 0,
          description: 'Despejado',
          windSpeed: 8.5,
        },
        synced: true,
        remoteId: 101,
      },
      {
        id: 1731600002,
        userId: 'usr_demo_101',
        text: 'Revisión bibliográfica: Sensores móviles y GPS',
        description: 'Estudiar API de Geolocation y Capacitor Camera para informe.',
        category: 'Estudio',
        priority: 'Media',
        completed: true,
        createdAt: Date.now() - 7200000,
        synced: true,
        remoteId: 102,
      },
      {
        id: 1731600003,
        userId: 'usr_demo_101',
        text: 'Sincronizar tareas pendientes con servidor remoto REST',
        description: 'Prueba de sincronización por lotes con API externa.',
        category: 'Trabajo',
        priority: 'Alta',
        completed: false,
        createdAt: Date.now() - 1800000,
        location: {
          latitude: -33.4372,
          longitude: -70.6506,
          accuracy: 10,
          address: 'Providencia, Región Metropolitana, Chile',
          city: 'Santiago',
          country: 'Chile',
        },
        weather: {
          temperature: 21,
          weatherCode: 1,
          description: 'Parcialmente nublado',
          windSpeed: 10.2,
        },
        synced: false,
      },
    ];
    // Guardar en Capacitor Preferences (localStorage fallback en web)
    localStorage.setItem('ionic_todo_tasks_user_usr_demo_101', JSON.stringify(tasks));
  });

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 2. Pantalla Principal con Tareas, Badges y Periféricos
  console.log('Capturando 02_pantalla_principal.png...');
  await page.screenshot({ path: path.join(OUT_DIR, '02_pantalla_principal.png') });

  // 3. Menú Lateral (Drawer con perfil y sync)
  console.log('Capturando 03_menu_lateral.png...');
  await page.click('ion-menu-button');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, '03_menu_lateral.png') });

  // Cerrar menú
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // 4. Modal de Creación Avanzada con Opciones de Cámara y GPS
  console.log('Capturando 04_modal_perifericos.png...');
  const openModalBtn = page.locator('ion-toolbar ion-button[title*="Nueva tarea"]').first();
  await openModalBtn.click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT_DIR, '04_modal_perifericos.png') });

  // Cerrar modal
  const closeModalBtn = page.locator('ion-modal ion-toolbar ion-buttons ion-button').first();
  await closeModalBtn.click();
  await page.waitForTimeout(500);

  // 5. Modal de Detalle de Tarea con Mapa y Periféricos
  console.log('Capturando 05_detalle_tarea_gps.png...');
  const firstTaskLabel = page.locator('.task-label').first();
  await firstTaskLabel.click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT_DIR, '05_detalle_tarea_gps.png') });

  await browser.close();
  server.close();
  console.log('¡Todas las capturas se generaron correctamente en:', OUT_DIR);
}

captureAll().catch((err) => {
  console.error('Error al capturar:', err);
  process.exit(1);
});
