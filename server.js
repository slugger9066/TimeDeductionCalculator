const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// When running behind proxies (dev containers, reverse proxies), allow express
// to trust the X-Forwarded-* headers so rate limiting identifies clients correctly.
// Only trust loopback proxies by default (safer than `true`). In production,
// set this to the number of trusted proxy hops or specific IPs as needed.
app.set('trust proxy', 'loopback');

app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(cors({ origin: false }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

app.use(express.static(path.join(__dirname, 'public')));

function validateDurationParts(obj) {
  const parts = ['days', 'hours', 'minutes', 'seconds'];
  for (const p of parts) {
    if (obj[p] == null) continue;
    if (!Number.isFinite(obj[p]) || obj[p] < 0) return false;
  }
  return true;
}

function toTotalSeconds(d) {
  const days = Number(d.days) || 0;
  const hours = Number(d.hours) || 0;
  const minutes = Number(d.minutes) || 0;
  const seconds = Number(d.seconds) || 0;
  return Math.round(((days * 24 + hours) * 60 + minutes) * 60 + seconds);
}

function breakdown(seconds) {
  seconds = Math.max(0, Math.round(seconds));
  const days = Math.floor(seconds / 86400);
  seconds -= days * 86400;
  const hours = Math.floor(seconds / 3600);
  seconds -= hours * 3600;
  const minutes = Math.floor(seconds / 60);
  seconds -= minutes * 60;
  return { days, hours, minutes, seconds };
}

app.post('/api/calc', (req, res) => {
  try {
    const body = req.body || {};
    const pct = Number(body.percentage);
    if (!Number.isFinite(pct) || pct < 0) {
      return res.status(400).json({ error: 'percentage must be a non-negative number' });
    }

    if (!body.duration || typeof body.duration !== 'object') {
      return res.status(400).json({ error: 'duration object required' });
    }

    if (!validateDurationParts(body.duration)) {
      return res.status(400).json({ error: 'duration parts must be non-negative numbers' });
    }

    const originalSeconds = toTotalSeconds(body.duration);
    const divisor = 1 + pct / 100;
    const newSeconds = Math.round(originalSeconds / divisor);
    const savedSeconds = Math.max(0, originalSeconds - newSeconds);

    return res.json({
      original: { totalSeconds: originalSeconds, breakdown: breakdown(originalSeconds) },
      new: { totalSeconds: newSeconds, breakdown: breakdown(newSeconds) },
      saved: { totalSeconds: savedSeconds, breakdown: breakdown(savedSeconds) },
      input: { percentage: pct }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

app.get('/healthz', (req, res) => res.json({ status: 'ok' }));

app.use((req, res) => res.status(404).send('Not found'));

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
