const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { enrollFace } = require('../lib/face');

const router = express.Router();

function signToken(user) {
  return jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().transform((v) => v.toLowerCase()),
  password: z.string().min(8),
  passcode: z.string().regex(/^\d{6}$/, 'Passcode must be exactly 6 digits'),
  initialWalletBalance: z.number().min(0).max(100000).default(0),
  faceImageBase64: z.string().optional(),
});

router.post('/signup', async (req, res, next) => {
  try {
    const body = signupSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) return res.status(409).json({ message: 'Email already registered' });

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash: await bcrypt.hash(body.password, 12),
        passcodeHash: await bcrypt.hash(body.passcode, 12),
        walletBalance: body.initialWalletBalance,
      },
    });

    let updatedUser = user;
    if (body.faceImageBase64) {
      const face = await enrollFace({ userId: user.id, faceImageBase64: body.faceImageBase64 });
      updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          faceImageKey: body.faceImageBase64,
          faceId: face.faceId,
          rekognitionCollectionId: face.collectionId,
          faceEnrollmentStatus: 'ENROLLED',
        },
      });
    }

    res.status(201).json({ token: signToken(updatedUser), user: safeUser(updatedUser) });
  } catch (err) {
    next(err);
  }
});

const loginSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  password: z.string().min(1),
});

router.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid email or password' });

    res.json({ token: signToken(user), user: safeUser(user) });
  } catch (err) {
    next(err);
  }
});

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    walletBalance: user.walletBalance,
    faceEnrollmentStatus: user.faceEnrollmentStatus,
  };
}

module.exports = router;
