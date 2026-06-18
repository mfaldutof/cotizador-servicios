# Cotizador Simple para Servicios Informales

Versión V6 con soporte para PostgreSQL en Railway.

## Qué guarda esta versión

Si agregas PostgreSQL en Railway, la app guarda en base de datos:

- Profesionales independientes.
- Rubro / servicio profesional.
- Clientes.
- Cotizaciones.
- Servicios cotizados.
- Totales.
- Consentimiento estadístico.
- Número correlativo por cada profesional.

Si todavía no existe `DATABASE_URL`, la app usa `data/quotes.json` como respaldo temporal.

## Cómo conectar PostgreSQL en Railway

1. En Railway entra a tu proyecto.
2. Pulsa **Add**.
3. Selecciona **Database**.
4. Selecciona **PostgreSQL**.
5. Railway creará la variable `DATABASE_URL` automáticamente.
6. Haz redeploy del servicio si no se actualiza solo.

## Cómo correr

```bash
npm install
npm start
```

Abre:

```text
http://localhost:3000
```

## Consulta privada de cotizaciones

Puedes proteger la consulta de datos creando una variable en Railway:

```text
ADMIN_KEY=pon-una-clave-larga-aqui
```

Luego consulta:

```text
GET /api/quotes
```

con el header:

```text
x-admin-key: pon-una-clave-larga-aqui
```
