const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../services/prisma');
const { signupSchema, loginSchema } = require('../validators/schemas');

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    walletBalance: user.walletBalance,
    faceEnrollmentStatus: user.faceEnrollmentStatus,
  };
}

function signToken(user) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24) {
    throw Object.assign(new Error('JWT_SECRET must be set to a long random value'), { status: 500 });
  }
  return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1d' });
}

router.post('/signup', async (req, res, next) => {
  try {
    const d = signupSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: d.email } });
    if (exists) return res.status(409).json({ message: 'Email already registered' });

    const hasFace = Boolean(d.faceImageBase64);
    const user = await prisma.user.create({
      data: {
        name: d.name,
        email: d.email,
        passwordHash: await bcrypt.hash(d.password, 12),
        passcodeHash: await bcrypt.hash(d.passcode, 12),
        walletBalance: d.initialWalletBalance,
        faceImageBase64: hasFace ? d.faceImageBase64 : null,
        faceImageKey: null,
        faceEnrollmentStatus: hasFace ? 'ENROLLED' : 'NOT_ENROLLED',
      },
    });

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const d = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: d.email } });
    if (!user || !(await bcrypt.compare(d.password, user.passwordHash))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
