# Guia de Despliegue Local y Compilacion de APK - TaskFlow Pro (Frontend)

Este documento describe exclusivamente los pasos para ejecutar la aplicacion frontend en un entorno local y compilar el archivo APK para Android.

---

## Proyecto en Produccion con Servidor Propio

- URL de acceso a la aplicacion: https://todolist.nennge.me/login
- Enlace de descarga de APK: https://todolist.nennge.me/TaskFlowPro.apk

---

## 1. Requisitos Previos

Para ejecutar la aplicacion web y compilar el archivo APK, se requiere contar con las siguientes herramientas instaladas:

- Node.js: Version 18, 20 o 22 LTS (https://nodejs.org/)
- npm: Version 9 o superior (incluido junto con Node.js)
- Java Development Kit (JDK): Version 17 o 21 (recomendado para proyectos de Android)
- Android Studio y Android SDK: Configurado con la variable de entorno `ANDROID_HOME` o el archivo `local.properties` apuntando a la ruta del SDK de Android

---

## 2. Instalacion y Ejecucion Local del Frontend (Web)

La aplicacion frontend esta desarrollada con Angular e Ionic Framework.

### Paso 1: Ingresar a la carpeta del proyecto
Abra una terminal y dirijase a la carpeta del proyecto:
```bash
cd to-do-list
```
*(Si ya se encuentra dentro del directorio `to-do-list`, omita este paso).*

### Paso 2: Instalar las dependencias
Instale los paquetes de Node.js necesarios:
```bash
npm install
```

### Paso 3: Iniciar el servidor de desarrollo
Ejecute el siguiente comando para levantar el servidor local:
```bash
npm start
```

Una vez finalizada la compilacion inicial, acceda desde su navegador web a:
```text
http://localhost:4200
```

Nota: Si dispone de Ionic CLI instalado de forma global, tambien puede utilizar:
```bash
ionic serve
```
El cual abrira la aplicacion por defecto en `http://localhost:8100`.

### Paso 4: Inicio de Sesion y Autenticacion (Login)
Al ingresar a la aplicacion (en `http://localhost:4200` o en produccion `https://todolist.nennge.me/login`):
- **Cuenta de Prueba (Demo):** Puede presionar el boton "Auto-rellenar cuenta demo" o utilizar:
  - **Usuario:** `demo`
  - **Contraseña:** `123456`
- **Registro de Nuevos Usuarios:** Puede ingresar a la pestaña "Registrarse" para crear una cuenta con sus propias credenciales.
- **Seguridad:** El sistema implementa autenticacion mediante JWT (JSON Web Tokens) con soporte offline en caso de perdida de conexion con el servidor.

---

## 3. Compilacion del APK de Android

El proyecto utiliza Capacitor para empaquetar el frontend web dentro de un contenedor nativo de Android.

### Paso 1: Compilar los archivos web de produccion
Antes de sincronizar con Android, es obligatorio compilar el frontend:
```bash
npm run build
```
Este comando genera los archivos optimizados dentro del directorio `www/`.

### Paso 2: Sincronizar los cambios con la plataforma Android
Copie los archivos generados y sincronice los plugins de Capacitor con el proyecto nativo:
```bash
npx cap sync android
```

### Paso 3: Generar el archivo APK

Existen dos metodos para compilar el APK:

#### Metodo A: Compilacion directa desde la terminal (Gradle)

En Windows (PowerShell o CMD):
```powershell
cd android
.\gradlew assembleDebug
```

En Linux / macOS / Bash:
```bash
cd android
./gradlew assembleDebug
```

Una vez concluida la tarea de Gradle, el archivo APK compilado estara ubicado en:
```text
android/app/build/outputs/apk/debug/app-debug.apk
```

#### Metodo B: Compilacion desde Android Studio

1. Abra el proyecto nativo en Android Studio con el siguiente comando desde la raiz de `to-do-list`:
   ```bash
   npx cap open android
   ```
2. Espere a que Gradle termine de indexar el proyecto.
3. En la barra superior de Android Studio, dirijase al menu:
   `Build` > `Build Bundle(s) / APK(s)` > `Build APK(s)`.
4. Al finalizar la compilacion, aparecera un aviso en la esquina inferior derecha con un enlace denominado `locate`, el cual abre la carpeta donde se genero `app-debug.apk`.

---

## 4. Instalacion del APK en un Dispositivo o Emulador

Puede descargar el APK directamente desde:
- Enlace directo: https://todolist.nennge.me/TaskFlowPro.apk

O una vez generado `app-debug.apk` localmente, puede instalarlo utilizando cualquiera de las siguientes alternativas:

1. Mediante la herramienta ADB (Android Debug Bridge):
   Con su dispositivo conectado por USB (con depuracion USB habilitada) o con un emulador abierto:
   ```bash
   adb install android/app/build/outputs/apk/debug/app-debug.apk
   ```

2. Arrastrar y soltar en emulador:
   Abra un emulador desde Android Studio y arrastre directamente el archivo `app-debug.apk` sobre la ventana del emulador para iniciar la instalacion automatica.

3. Instalacion manual en dispositivo fisico:
   Copie el archivo `app-debug.apk` a la memoria interna de su telefono, abralo con un explorador de archivos y acepte el permiso de instalacion desde origenes desconocidos.

---

## 5. Scripts Disponibles en el Frontend

Dentro de la carpeta `to-do-list`, dispone de los siguientes comandos:

- `npm start`: Inicia el servidor de desarrollo local de Angular.
- `npm run build`: Genera la compilacion de produccion en la carpeta `www/`.
- `npm run watch`: Compila y vigila cambios en los archivos para desarrollo.
- `npm run lint`: Ejecuta el analisis estatico de codigo con ESLint y Prettier.
- `npm run test:unit`: Ejecuta las pruebas unitarias.
- `npm run test:e2e`: Ejecuta las pruebas de extremo a extremo (E2E).
