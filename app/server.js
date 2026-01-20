import express from 'express';

const app = express();

const port = Number.parseInt(process.env.COLOR_ROOM_PORT ?? '8080', 10);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Color Room</title>
</head>
<body>
  <h1>Color Room</h1>
  <p>Serveur JS (V1). Endpoint santé: <a href="/health">/health</a></p>
</body>
</html>`);
});

app.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`[color-room] listening on http://0.0.0.0:${port}`);
});
