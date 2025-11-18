const express = require('express');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

const app = express();
const publicDir = path.join(__dirname, 'public');
const jsDir = path.join(publicDir, 'js');

// تأكيد وجود المجلدات
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);
if (!fs.existsSync(jsDir)) fs.mkdirSync(jsDir);

// Middlewares
app.use(express.json());

// =========================
//   Serve index.html (قبل static!)
// =========================
function renderIndex(req, res) {
  try {
    const indexPath = path.join(publicDir, 'index.html');
    let html = fs.readFileSync(indexPath, 'utf8');

    const key = process.env.GOOGLE_MAP_KEY || '';
    html = html.replace(/%GOOGLE_MAP_KEY%/g, key);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);

  } catch (err) {
    console.error('Error serving index:', err);
    res.status(500).send('Internal Server Error');
  }
}

app.get('/', renderIndex);

// Health check
app.get('/health', (req, res) => res.send('OK'));

// =========================
//   API Shortener is.gd
// =========================
app.post('/api/shorten', async (req, res) => {
  try {
    const longUrl = req.body.url;
    if (!longUrl) {
      return res.status(400).json({ error: 'Missing url in request body' });
    }

    const api = 'https://is.gd/create.php?format=simple&url=' +
      encodeURIComponent(longUrl);

    const result = await fetch(api);
    const txt = await result.text();

    if (!result.ok || txt.startsWith('Error')) {
      throw new Error(txt);
    }

    res.json({ shortUrl: txt.trim() });

  } catch (err) {
    console.error('Shortening failed:', err.message);
    res.status(500).json({ error: 'Shortening failed' });
  }
});

// =========================
//   Static files AFTER index
// =========================
app.use('/js', express.static(jsDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

app.use(express.static(publicDir));

// أي صفحة أخرى → index
app.get('*', renderIndex);

// تشغيل السيرفر
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log('Server is running on port', PORT);
  console.log('Public directory:', publicDir);
  console.log('JS directory:', jsDir);
});
