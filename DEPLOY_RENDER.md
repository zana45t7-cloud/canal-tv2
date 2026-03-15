# Cómo desplegar en Render

Para subir esta aplicación a Render, seguí estos pasos:

## 1. Subir a GitHub
Render necesita que tu código esté en un repositorio de GitHub. 
1. Creá un nuevo repositorio en GitHub (o usá el que ya tenés).
2. Subí el contenido de esta carpeta (`tv-channel`) al repositorio.
   - **Nota**: El archivo `.env` y la carpeta `data/` están ignorados, así que no se subirán. Esto es correcto por seguridad.

## 2. Configurar en Render
1. Entrá a [dashboard.render.com](https://dashboard.render.com).
2. Hacé clic en **New +** y seleccioná **Web Service**.
3. Conectá tu repositorio de GitHub.
4. Render detectará automáticamente el `Dockerfile` y el archivo `render.yaml`.

## 3. Variables de Entorno
En la pestaña **Environment** de tu servicio en Render, agregá las siguientes variables:
- `ADMIN_PASSWORD`: Tu contraseña (ej: `Manzanilla5000`).
- `PORT`: `3000`.

## 4. Importante sobre la Base de Datos
- **AVISO**: Cada vez que Render reinicie el servidor, la base de datos local se borrará. Una vez que funcione, configuraremos Turso.
