// server.js
// Diriyah Security Map – Backend (Express + is.gd URL shortener)

const express = require('express');

const app = express();
const path = require('path');

// تقديم الملفات الثابتة من مجلد public
app.use(express.static(path.join(__dirname, 'public')));

// خدمة اختصار الروابط عبر is.gd
app.get('/api/shorten', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) {
      return res.status(400).json({ error: 'url query parameter is required' });
    }

    const apiUrl = 'https://is.gd/create.php?format=simple&url=' + encodeURIComponent(url);

    // Node 18+ فيه fetch مدمج
    const response = await fetch(apiUrl);
    if (!response.ok) {
      return res.status(500).json({ error: 'Failed to contact is.gd' });
    }

    const text = (await response.text()).trim();
    // is.gd يرجع الرابط المختصر مباشرة كنص
    if (!text.startsWith('http')) {
      return res.status(500).json({ error: 'Unexpected is.gd response', raw: text });
    }

    res.json({ shortUrl: text });
  } catch (err) {
    console.error('shorten error:', err);
    res.status(500).json({ error: 'Shorten failed' });
  }
});

// أي مسار آخر يرجع index.html (لأمان التصفح)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Diriyah Security Map backend running on port', PORT);
});
