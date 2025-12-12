const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;

// When running behind proxies (dev containers, reverse proxies), allow express
// to trust the X-Forwarded-* headers so rate limiting identifies clients correctly.
// Only trust loopback proxies by default (safer than `true`). In production,
// set this to the number of trusted proxy hops or specific IPs as needed.
app.set('trust proxy', 'loopback');

const isProd = process.env.NODE_ENV === 'production';

// Configure Helmet: disable HSTS in non-production and set an explicit
// Content Security Policy that does NOT include `upgrade-insecure-requests`.
app.use(helmet({
  hsts: isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
  // disable CSP in development to avoid automatic upgrades or surprises;
  // in production, set a tight CSP via environment-specific config.
  contentSecurityPolicy: isProd ? {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", 'https:', 'data:'],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
    }
  } : false
}));

app.use(express.json({ limit: '10kb' }));

// Request logging
app.use(morgan(process.env.MORGAN_FORMAT || 'combined'));

// Configurable CORS: set ALLOWED_ORIGINS to a comma-separated list.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no Origin header (server-to-server or same-origin)
    if (!origin) return cb(null, true);
    if (allowedOrigins.length === 0) return cb(null, false);
    cb(null, allowedOrigins.includes(origin));
  }
}));

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
    const n = Number(obj[p]);
    if (!Number.isFinite(n) || n < 0) return false;
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
    const MAX_PERCENTAGE = Number(process.env.MAX_PERCENTAGE || 10000);
    if (!Number.isFinite(pct) || pct < 0 || pct > MAX_PERCENTAGE) {
      return res.status(400).json({ error: `percentage must be a non-negative number ≤ ${MAX_PERCENTAGE}` });
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

// Only start the server when run directly (so tests can import the app).
if (require.main === module) {
  // attempt to listen on PORT and, if unavailable, try subsequent ports
  const basePort = Number(process.env.PORT) || 3000;
  const maxRetries = 5;
  let attempt = 0;
  let currentServer = null;

  function startOnPort(port) {
    currentServer = app.listen(port, () => {
      console.log(`Server listening on http://localhost:${port}`);
    });

    currentServer.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE' && attempt < maxRetries) {
        console.warn(`Port ${port} in use — trying ${port + 1}...`);
        attempt += 1;
        setTimeout(() => startOnPort(port + 1), 200);
        return;
      }
      console.error('Failed to start server:', err);
      process.exit(1);
    });
  }

  const shutdown = (signal) => {
    console.log(`Received ${signal}, shutting down...`);
    if (!currentServer) return process.exit(0);
    currentServer.close(err => {
      if (err) {
        console.error('Error during shutdown', err);
        process.exit(1);
      }
      console.log('Shutdown complete');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  startOnPort(basePort);
}

module.exports = {
  app,
  validateDurationParts,
  toTotalSeconds,
  breakdown
};
