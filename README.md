# Cotizador Simple para Servicios Informales

App web mínima lista para Railway. Permite crear cotizaciones, imprimirlas/guardarlas como PDF y almacenar cada transacción en un archivo JSON del servidor.

## Funciones

- Crear cotizaciones para servicios informales.
- Agregar varios servicios con cantidad y precio.
- Calcular subtotal, impuesto y total estimado.
- Guardar cotizaciones en `data/quotes.json`.
- Consentimiento claro para uso interno y estadísticas agregadas.
- Imprimir o guardar como PDF desde el navegador.
- Endpoint privado básico para consultar cotizaciones guardadas.

## Importante sobre datos

El consentimiento debe mostrarse de forma clara. No se recomienda ocultar el uso de información ni usar textos engañosos. Esta versión usa un aviso discreto pero transparente.

## Cómo correr localmente

```bash
npm install
npm start
```

Abre:

```text
http://localhost:3000
```

## Cómo subir a Railway desde iPad

1. Crea un repositorio en GitHub.
2. Sube estos archivos al repositorio.
3. En Railway, crea un proyecto nuevo.
4. Elige Deploy from GitHub repo.
5. Selecciona este repositorio.
6. Railway detectará Node.js y ejecutará `npm start`.

## Variable opcional de seguridad

Para proteger la consulta de cotizaciones guardadas, en Railway puedes crear una variable:

```text
ADMIN_KEY=pon-una-clave-larga-aqui
```

Luego puedes consultar las cotizaciones con el header:

```text
x-admin-key: pon-una-clave-larga-aqui
```

Endpoint:

```text
GET /api/quotes
```

## Nota para producción

Railway puede reiniciar el servidor y el archivo local `data/quotes.json` puede no ser ideal para datos permanentes. Para una versión real, conviene conectar PostgreSQL en Railway.
