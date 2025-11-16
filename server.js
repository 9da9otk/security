// server.js
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const publicDir = path.join(__dirname, 'public');

console.log('Booting Diriyah Security Map server...');
console.log('__dirname =', __dirname);

// 1) ملفات ثابتة
app.use('/js',  express.static(path.join(publicDir, 'js')));
app.use('/css', express.static(path.join(publicDir, 'css')));
app.use('/img', express.static(path.join(publicDir, 'img')));

// 2) الصفحة الرئيسية مع استبدال مفتاح قوقل
function renderIndex(res) {
  const indexPath = path.join(publicDir, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  const key = process.env.GOOGLE_MAP_KEY || '';
  html = html.replace('%GOOGLE_MAP_KEY%', key);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

app.get('/', (req, res) => {
  try {
    renderIndex(res);
  } catch (err) {
    console.error('Error serving /:', err);
    res.status(500).send('Internal Server Error');
  }
});

// 3) API اختصار الرابط
app.get('/api/short', async (req, res) => {
  try {
    const longUrl = req.query.url;
    if (!longUrl) return res.status(400).json({ error: 'Missing url' });

    const api = 'https://is.gd/create.php?format=simple&url=' + encodeURIComponent(longUrl);

    const r = await fetch(api);
    const txt = await r.text();

    res.json({ short: txt.trim() });
  } catch (err) {
    console.error('Shortening failed:', err);
    res.status(500).json({ error: 'Shortening failed' });
  }
});

// 4) health check
app.get('/health', (req, res) => {
  res.send('OK');
});

// 5) fallback لباقي المسارات (روابط المشاركة)
app.get('*', (req, res) => {
  try {
    renderIndex(res);
  } catch (err) {
    console.error('Error in fallback *:', err);
    res.status(500).send('Internal Server Error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server is running on port', PORT);
});
