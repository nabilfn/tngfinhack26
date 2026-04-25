require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { ZodError } = require('zod');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: process.env.JSON_LIMIT || '10mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: Number(process.env.RATE_LIMIT_MAX || 300) }));

app.get('/health', (req, res) => res.json({ ok: true, service: 'face2go-api' }));
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api', require('./routes/app.routes'));

app.use((err, req, res, next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ message: err.issues?.[0]?.message || 'Invalid input', issues: err.issues });
  }
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

app.listen(process.env.PORT || 4000, () => console.log(`API running on ${process.env.PORT || 4000}`));
