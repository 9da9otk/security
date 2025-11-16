// server.js
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const publicDir = path.join(__dirname, 'public');

console.log('Booting Diriyah Security Map server...');
console.log('__dirname =', __dirname);

// ---------------- Static Files ----------------
// أفضل ترتيب للملفات الثابتة (لتفادي مشاكل MIME type)
app.use('/js', express.static(path.join(publicDir, 'js')));
app.use('/css', express.static(path.join(publicDir, 'css')));
app.use('/img', express.static(path.join(publicDir, 'img')));
app.use(express.static(publicDir, {
  extensions: ['html'],
}));

// ---------------- render index.html ----------------
function renderIndex(req, res) {
  try {
    const indexPath = path.join(publicDir, 'index.html');
    let html = fs.readFileSync(indexPath, 'utf8');
    const key = process.env.GOOGLE_MAP_KEY || '';
    html = html.replace('%GOOGLE_MAP_KEY%', key);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('Error serving index:', err);
    res.status(500).send('Internal Server Error');
  }
}

// ---------------- Routes ----------------
app.get('/', (req, res) => {
  renderIndex(req, res);
});

app.get('/api/short', async (req, res) => {
  try {
    const longUrl = req.query.url;
    if (!longUrl) return res.status(400).json({ error: 'Missing url' });

    const api = 'https://is.gd/create.php?format=simple&url=' + encodeURIComponent(longUrl);
    const result = await fetch(api);
    const txt = await result.text();

    res.json({ short: txt.trim() });
  } catch (err) {
    console.error('Shortening failed:', err);
    res.status(500).json({ error: 'Shortening failed' });
  }
});

app.get('/health', (req, res) => {
  res.send('OK');
});

// ---------------- Fallback (for shared links etc.) ----------------
app.get('*', (req, res, next) => {
  // لا تعالج الملفات أو API عبر fallback
  if (req.path.includes('.') || req.path.startsWith('/api')) {
    return next();
  }

  renderIndex(req, res);
});

// ---------------- Start ----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server is running on port', PORT);
});
