# 🚀 TaskFlow Pro - Backend API & Base de Datos

Servicio Backend independiente y modular con **Node.js, Express y SQLite** (con soporte para PostgreSQL), diseñado específicamente para respaldar la aplicación móvil y web **TaskFlow Pro (Ionic + Angular + Capacitor)**.

---

## 📁 Estructura del Proyecto Separado

El proyecto ahora cuenta con dos carpetas independientes:

```text
to-do-list/
├── backend/                  <--- [ESTA CARPETA]: Se sube al servidor como backend
│   ├── src/
│   │   ├── config/db.js      <--- Conexión y creación automática de tablas SQLite
│   │   ├── controllers/      <--- Lógica de autenticación y CRUD de tareas
│   │   ├── middleware/       <--- Seguridad y validación JWT
│   │   ├── routes/           <--- Rutas de la API (/api/auth, /api/tasks)
│   │   └── index.js          <--- Servidor Express y configuración CORS
│   ├── Dockerfile            <--- Despliegue con Docker
│   ├── docker-compose.yml    <--- Despliegue en VPS
│   ├── package.json          <--- Dependencias del backend
│   └── .env.example          <--- Variables de entorno
│
├── src/                      <--- [FRONTEND]: Aplicación Angular + Ionic
└── android/                  <--- [MÓVIL]: Proyecto Android Studio y APK
```

---

## 🛠️ Requisitos
* **Node.js**: v18, v20 o v22+
* **npm**: v9+

---

## ⚡ 1. Ejecución Local (Pruebas en tu Computador)

1. Abre una terminal y entra en la carpeta `backend`:
   ```bash
   cd backend
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. (Opcional) Crea tu archivo `.env`:
   ```bash
   cp .env.example .env
   ```

4. Inicia el servidor:
   ```bash
   npm run dev
   ```

El servidor quedará disponible en:
* **API:** `http://localhost:3000/api`
* **Health Check:** `http://localhost:3000/api/health`

---

## ☁️ 2. Cómo Subir el Backend a un Servidor (Paso a Paso)

Tienes tres opciones recomendadas:

### Opción A: Despliegue Gratuito en Render.com (La más fácil y recomendada)

1. **Subir a GitHub:**
   * Sube tu carpeta `backend/` a un repositorio en GitHub (puede ser el mismo repositorio o uno independiente llamado `taskflow-backend`).
2. **Crear cuenta en [Render.com](https://render.com):**
   * Es gratuito y no requiere tarjeta de crédito.
3. **Crear un nuevo "Web Service":**
   * Haz clic en **New +** > **Web Service**.
   * Conecta tu repositorio de GitHub.
   * Si el backend está dentro de un monorepo, en **Root Directory** escribe: `backend`.
   * En **Runtime**, selecciona: `Node`.
   * En **Build Command**, escribe: `npm install`.
   * En **Start Command**, escribe: `npm start`.
   * En el plan, selecciona **Free**.
4. **Variables de Entorno (Environment Variables):**
   * Agrega:
     * `JWT_SECRET` = `clave_secreta_super_segura_de_tu_app`
     * `CORS_ORIGIN` = `*`
5. **Crear Disco Persistente (Para que la base de datos no se borre al reiniciar):**
   * En la pestaña **Disks** de tu servicio en Render, agrega un disco:
     * **Name:** `taskflow-data`
     * **Mount Path:** `/app/data`
     * **Size:** 1 GB (Gratis)
     * Configura la variable `DATABASE_FILE` = `/app/data/database.sqlite`.
6. Haz clic en **Create Web Service**. En 2 minutos tendrás tu URL pública HTTPS:
   `https://mi-backend-taskflow.onrender.com`

---

### Opción B: Despliegue en Railway.app

1. Entra a [Railway.app](https://railway.app) e inicia sesión con GitHub.
2. Haz clic en **New Project** > **Deploy from GitHub repo**.
3. Selecciona tu repositorio y la carpeta `backend`.
4. En **Variables**, define:
   * `PORT` = `3000`
   * `JWT_SECRET` = `tu_clave_secreta`
   * `CORS_ORIGIN` = `*`
5. En **Settings** > **Volumes**, añade un volumen montado en `/app/data` para que el archivo SQLite persista.
6. En **Settings** > **Networking**, haz clic en **Generate Domain** para obtener tu URL HTTPS pública.

---

### Opción C: Despliegue en un VPS Propio (Ubuntu / DigitalOcean / AWS / Linode)

Si tienes un servidor Linux:

1. **Con Docker (Recomendado):**
   ```bash
   # Clonar o subir la carpeta backend al servidor
   cd backend
   docker compose up -d --build
   ```
   ¡Listo! El backend estará corriendo en el puerto 3000 con persistencia automática de la base de datos en un volumen Docker.

2. **Con Node y PM2 (Nativo):**
   ```bash
   cd backend
   npm install --production
   sudo npm install -g pm2
   pm2 start src/index.js --name "taskflow-api"
   pm2 startup
   pm2 save
   ```

---

## 📱 3. Cómo Conectar la App Móvil / Web (Frontend) al Backend

La aplicación ya se encuentra configurada para conectarse a tu dominio `https://todolist.nennge.me`:

1. En `src/environments/environment.prod.ts` (Producción / APK Móvil):
   ```typescript
   export const environment = {
     production: true,
     apiUrl: 'https://todolist.nennge.me/api',
   };
   ```

2. En `src/environments/environment.ts` (Desarrollo local):
   ```typescript
   export const environment = {
     production: false,
     apiUrl: 'https://todolist.nennge.me/api',
   };
   ```

---

## 📡 4. Endpoints de la API REST

### Autenticación (`/api/auth`)
* `POST /api/auth/register` - Registra un nuevo usuario:
  ```json
  { "username": "carlos", "email": "carlos@test.com", "name": "Carlos Gomez", "password": "mi_password_seguro" }
  ```
* `POST /api/auth/login` - Inicia sesión:
  ```json
  { "username": "carlos", "password": "mi_password_seguro" }
  ```
  *Respuesta:* Retorna `{ token, user }`. El token se usa en el header `Authorization: Bearer <token>`.
* `GET /api/auth/profile` - Obtiene los datos del usuario activo (requiere token).
* **Usuario Demo pre-cargado:** Usuario: `demo` / Clave: `123456`.

### Tareas (`/api/tasks`) *(Todas requieren Header `Authorization: Bearer <token>`)*
* `GET /api/tasks` - Lista las tareas del usuario. Filtros opcionales: `?category=Personal&completed=false&search=comprar`.
* `GET /api/tasks/:id` - Obtiene una tarea específica.
* `POST /api/tasks` - Crea una nueva tarea:
  ```json
  {
    "text": "Comprar materiales",
    "description": "Lista de herramientas y pinturas",
    "category": "Trabajo",
    "priority": "Alta",
    "completed": false,
    "location": { "latitude": -33.45, "longitude": -70.66, "city": "Santiago", "address": "Santiago Centro" },
    "weather": { "temperature": 24, "description": "Despejado" }
  }
  ```
* `PUT /api/tasks/:id` - Actualiza una tarea existente.
* `DELETE /api/tasks/:id` - Elimina una tarea por su ID.
* `DELETE /api/tasks/completed` - Elimina en lote todas las tareas completadas.
* `POST /api/tasks/sync` - **Sincronización en lote offline-first:** Recibe un lote de tareas creadas o modificadas sin conexión en el teléfono y las sincroniza en la base de datos central.

### Diagnóstico
* `GET /api/health` - Estado del servidor y tiempo de actividad.
