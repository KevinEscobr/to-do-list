const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const WWW_DIR = path.resolve(__dirname, '..', 'www');
const OUT_DIR = path.resolve(__dirname, '..', 'screenshots');
const PORT = 4281;

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

async function captureDetail() {
  const server = createStaticServer();
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  const page = await context.newPage();

  // Iniciar sesión con Demo
  await page.goto(`http://127.0.0.1:${PORT}/login`, { waitUntil: 'networkidle' });
  const quickDemoBtn = page.getByRole('button', { name: /Acceso Rápido Demo/i });
  await quickDemoBtn.click();
  await page.waitForURL('**/home', { timeout: 10000 });
  await page.waitForTimeout(600);

  // Sembrar tarea con foto y GPS
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
    ];
    localStorage.setItem('ionic_todo_tasks_user_usr_demo_101', JSON.stringify(tasks));
  });

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // Abrir detalle directamente
  console.log('Abriendo detalle de la tarea...');
  const taskLabel = page.locator('.task-label').first();
  await taskLabel.click();
  await page.waitForTimeout(800);

  console.log('Capturando 05_detalle_tarea_gps.png...');
  await page.screenshot({ path: path.join(OUT_DIR, '05_detalle_tarea_gps.png') });

  await browser.close();
  server.close();
  console.log('Captura de detalle finalizada exitosamente.');
}

captureDetail().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
