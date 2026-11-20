const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('./node_modules/@playwright/test');

const WWW_DIR = path.join(__dirname, 'www');
const OUT_DIR = path.join(__dirname, 'screenshots');
const PORT = 4280;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function createServer() {
  return http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/') reqPath = '/index.html';

    let filePath = path.join(WWW_DIR, reqPath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      // Fallback for SPA routing
      filePath = path.join(WWW_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    try {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch (e) {
      res.writeHead(500);
      res.end('Error loading ' + reqPath);
    }
  });
}

async function capture() {
  const server = createServer();
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Server listening on http://localhost:${PORT}`);

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });

  const page = await context.newPage();

  // Set initial realistic tasks in localStorage
  await page.addInitScript(() => {
    const tasks = [
      {
        id: 1,
        text: 'Aprender la arquitectura de Ionic & Angular',
        description: 'Componentes standalone, ciclo de vida e inyección de dependencias',
        category: 'Estudio',
        priority: 'Alta',
        completed: true,
        createdAt: Date.now() - 86400000
      },
      {
        id: 2,
        text: 'Implementar navegación y menú lateral',
        description: 'Configurar ion-menu y rutas entre páginas',
        category: 'Trabajo',
        priority: 'Alta',
        completed: true,
        createdAt: Date.now() - 43200000
      },
      {
        id: 3,
        text: 'Diseñar interfaz con principios de UI móvil',
        description: 'Jerarquía visual, contraste cromático y touch targets > 44px',
        category: 'Trabajo',
        priority: 'Media',
        completed: true,
        createdAt: Date.now() - 20000000
      },
      {
        id: 4,
        text: 'Compilar el APK final para Android',
        description: 'Usar Capacitor CLI y Gradle para generar el binario',
        category: 'Personal',
        priority: 'Alta',
        completed: false,
        createdAt: Date.now() - 3600000
      },
      {
        id: 5,
        text: 'Documentar proceso de desarrollo e informe técnico',
        description: 'Detallar estructura del proyecto y componentes utilizados',
        category: 'Estudio',
        priority: 'Media',
        completed: false,
        createdAt: Date.now()
      }
    ];
    localStorage.setItem('ionic_todo_tasks_v2', JSON.stringify(tasks));
  });

  console.log('Navigating to app...');
  await page.goto(`http://localhost:${PORT}/home`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Pantalla Principal
  console.log('Capturing 01_pantalla_principal.png...');
  await page.screenshot({ path: path.join(OUT_DIR, '01_pantalla_principal.png') });

  // 2. Menú Lateral (Drawer)
  console.log('Capturing 02_menu_lateral.png...');
  await page.click('ion-menu-button');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, '02_menu_lateral.png') });

  // Close menu by clicking overlay or backdrop
  await page.evaluate(() => {
    const menu = document.querySelector('ion-menu');
    if (menu) menu.close();
  });
  await page.waitForTimeout(500);

  // 3. Modal de Creación Detallada de Tarea
  console.log('Capturing 03_modal_crear_tarea.png...');
  const addBtn = page.locator('ion-toolbar ion-buttons[slot="end"] ion-button').nth(1);
  await addBtn.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT_DIR, '03_modal_crear_tarea.png') });

  // Cancel modal
  const cancelBtn = page.locator('ion-alert button.alert-button:has-text("Cancelar")');
  if (await cancelBtn.count() > 0) {
    await cancelBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(500);

  // 4. Elemento Deslizante (Swiping ion-item-sliding)
  console.log('Capturing 04_deslizar_item.png...');
  await page.evaluate(() => {
    const firstSliding = document.querySelector('ion-item-sliding');
    if (firstSliding) {
      firstSliding.open('end');
    }
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, '04_deslizar_item.png') });

  // Close sliding
  await page.evaluate(() => {
    const firstSliding = document.querySelector('ion-item-sliding');
    if (firstSliding) {
      firstSliding.close();
    }
  });
  await page.waitForTimeout(300);

  // 5. Filtro por Estado: Pendientes
  console.log('Capturing 05_filtro_pendientes.png...');
  const pendingSegment = page.locator('ion-segment-button[value="pending"]');
  await pendingSegment.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, '05_filtro_pendientes.png') });

  // Reset filter back to 'all'
  await page.locator('ion-segment-button[value="all"]').click();
  await page.waitForTimeout(300);

  // 6. Pantalla de Métricas y Estadísticas
  console.log('Capturing 06_metricas_estadisticas.png...');
  await page.goto(`http://localhost:${PORT}/stats`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT_DIR, '06_metricas_estadisticas.png') });

  // 7. Pantalla de Estadísticas en Modo Oscuro (Dark Theme)
  console.log('Capturing 07_modo_oscuro_stats.png...');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, '07_modo_oscuro_stats.png') });

  // 8. Pantalla Principal en Modo Oscuro
  console.log('Capturing 08_modo_oscuro_home.png...');
  await page.goto(`http://localhost:${PORT}/home`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT_DIR, '08_modo_oscuro_home.png') });

  console.log('All screenshots captured successfully!');
  await browser.close();
  server.close();
}

capture().catch((err) => {
  console.error('Error during capture:', err);
  process.exit(1);
});
