const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');
const { enrollFace, compareFace } = require('../lib/face');
const { evaluateRisk } = require('../lib/agent');

const router = express.Router();
router.use(auth);

router.get('/dashboard', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      walletBalance: user.walletBalance,
      faceEnrollmentStatus: user.faceEnrollmentStatus,
      transactions: user.transactions,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/enroll-face', async (req, res, next) => {
  try {
    const body = z.object({ faceImageBase64: z.string().min(50) }).parse(req.body);
    const face = await enrollFace({ userId: req.user.id, faceImageBase64: body.faceImageBase64 });
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        faceImageKey: body.faceImageBase64,
        faceId: face.faceId,
        rekognitionCollectionId: face.collectionId,
        faceEnrollmentStatus: 'ENROLLED',
      },
    });
    res.json({ message: 'Face enrolled', faceEnrollmentStatus: user.faceEnrollmentStatus, provider: face.provider });
  } catch (err) {
    next(err);
  }
});

const createTxSchema = z.object({
  recipient: z.string().min(2),
  amount: z.number().positive().max(100000),
});

router.post('/transactions', async (req, res, next) => {
  try {
    const body = createTxSchema.parse(req.body);
    const tx = await prisma.transaction.create({
      data: {
        payerId: req.user.id,
        recipient: body.recipient,
        amount: body.amount,
        status: 'PENDING',
      },
    });
    res.status(201).json(tx);
  } catch (err) {
    next(err);
  }
});

router.get('/transactions', async (req, res, next) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { payerId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ transactions });
  } catch (err) {
    next(err);
  }
});

const verifySchema = z.object({
  transactionId: z.string().uuid(),
  faceImageBase64: z.string().optional(),
  passcode: z.string().optional(),
});

router.post('/transactions/verify', async (req, res, next) => {
  try {
    const body = verifySchema.parse(req.body);
    const tx = await prisma.transaction.findFirst({ where: { id: body.transactionId, payerId: req.user.id } });
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    if (tx.status !== 'PENDING') return res.status(400).json({ message: 'Transaction already processed' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const balance = Number(user.walletBalance);
    const amount = Number(tx.amount);
    if (balance < amount) {
      const failed = await prisma.transaction.update({
        where: { id: tx.id },
        data: { status: 'FAILED', failureReason: 'Insufficient wallet balance' },
      });
      return res.status(400).json({ message: 'Insufficient wallet balance', transaction: failed });
    }

    let method = 'FACE2GO';
    let confidence = null;

    if (body.faceImageBase64 && user.faceEnrollmentStatus === 'ENROLLED') {
      const result = await compareFace({
        enrolledImageBase64: user.faceImageKey,
        verificationImageBase64: body.faceImageBase64,
      });
      confidence = result.confidence;
      await prisma.faceVerification.create({
        data: {
          userId: user.id,
          transactionId: tx.id,
          confidenceScore: confidence,
          verificationStatus: result.passed ? 'PASSED' : 'FAILED',
        },
      });
      if (!result.passed) return res.status(401).json({ message: 'Face verification failed', confidenceScore: confidence });
    } else {
      if (!body.passcode) return res.status(400).json({ message: 'Face image or fallback passcode is required' });
      const ok = await bcrypt.compare(body.passcode, user.passcodeHash);
      if (!ok) return res.status(401).json({ message: 'Invalid fallback passcode' });
      method = 'FALLBACK';
    }

    const risk = await evaluateRisk({
  transactionId: tx.id,
  amount,
  balanceBeforePayment: balance,
  balanceAfterPayment: balance - amount,
  verificationMethod: method,
  faceConfidence: confidence,
  faceEnrolled: user.faceEnrollmentStatus === 'ENROLLED',
  recipient: tx.recipient,
  location: 'Malaysia',
  deviceKnown: false,
});

const decision = String(risk.decision || '').trim().toUpperCase();

if (decision === 'BLOCK') {
  const blocked = await prisma.transaction.update({
    where: { id: tx.id },
    data: {
      status: 'FAILED',
      failureReason: risk.reason || 'Blocked by AI risk agent',
    },
  });

  return res.status(403).json({
    message: 'Payment blocked by AI risk agent',
    risk,
    transaction: blocked,
  });
}

if (
  ['REQUIRE_VERIFICATION', 'REQUIRE_EXTRA_VERIFICATION', 'CHALLENGE'].includes(decision) &&
  method !== 'FALLBACK'
) {
  return res.status(200).json({
    message: 'Additional verification required',
    requiresExtraVerification: true,
    risk: {
      ...risk,
      decision,
    },
    nextStep: 'fallback_passcode',
  });
}

    const updated = await prisma.$transaction(async (db) => {
      await db.user.update({ where: { id: user.id }, data: { walletBalance: balance - amount } });
      return db.transaction.update({
        where: { id: tx.id },
        data: { status: method === 'FALLBACK' ? 'SUCCESS_WITH_FALLBACK' : 'SUCCESS', method, confidenceScore: confidence },
      });
    });

    res.json({
  message: 'Payment authorized',
  transaction: updated,
  risk,
});
  } catch (err) {
    next(err);
  }
});

module.exports = router;
