const router = require('express').Router();
const bcrypt = require('bcryptjs');
const prisma = require('../services/prisma');
const auth = require('../middleware/auth');
const { createTxSchema, facePaySchema, passcodeSchema, transactionIdSchema } = require('../validators/schemas');
const { compareFaces } = require('../services/rekognition.service');
const { Prisma } = require('@prisma/client');

router.use(auth);

function toMoney(value) {
  return new Prisma.Decimal(value);
}

function serializeTx(tx) {
  if (!tx) return tx;
  return {
    ...tx,
    amount: tx.amount?.toString?.() ?? tx.amount,
  };
}

function serializeUser(user) {
  if (!user) return user;
  return {
    ...user,
    walletBalance: user.walletBalance?.toString?.() ?? user.walletBalance,
    transactions: user.transactions?.map(serializeTx),
  };
}

async function approveTransaction({ txId, userId, method, status, confidenceScore = null }) {
  return prisma.$transaction(async (db) => {
    const tx = await db.transaction.findFirst({
      where: { id: txId, payerId: userId, status: 'PENDING' },
    });
    if (!tx) throw Object.assign(new Error('Pending transaction not found'), { status: 404 });

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

    if (new Prisma.Decimal(user.walletBalance).lt(tx.amount)) {
      const failed = await db.transaction.update({
        where: { id: txId },
        data: { status: 'FAILED', failureReason: 'Insufficient balance', method, confidenceScore },
      });
      return failed;
    }

    await db.user.update({
      where: { id: userId },
      data: { walletBalance: new Prisma.Decimal(user.walletBalance).minus(tx.amount) },
    });

    return db.transaction.update({
      where: { id: txId },
      data: { method, status, confidenceScore, failureReason: null },
    });
  });
}

router.get('/dashboard', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        walletBalance: true,
        faceEnrollmentStatus: true,
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    res.json(serializeUser(user));
  } catch (e) {
    next(e);
  }
});

router.post('/transactions/create', async (req, res, next) => {
  try {
    const d = createTxSchema.parse(req.body);
    const tx = await prisma.transaction.create({
      data: {
        payerId: req.user.id,
        recipient: d.recipient,
        amount: toMoney(d.amount),
        status: 'PENDING',
      },
    });
    res.json(serializeTx(tx));
  } catch (e) {
    next(e);
  }
});

router.post('/transactions/pay/tng', async (req, res, next) => {
  try {
    const d = transactionIdSchema.parse(req.body);
    const tx = await approveTransaction({ txId: d.transactionId, userId: req.user.id, method: 'TNG', status: 'SUCCESS' });
    res.json(serializeTx(tx));
  } catch (e) {
    next(e);
  }
});

router.post('/transactions/pay/face2go', async (req, res, next) => {
  try {
    const d = facePaySchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user?.faceImageBase64 || user.faceEnrollmentStatus !== 'ENROLLED') {
      return res.status(400).json({ message: 'Face2Go is not enrolled for this account' });
    }

    const tx = await prisma.transaction.findFirst({ where: { id: d.transactionId, payerId: req.user.id } });
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    if (tx.status !== 'PENDING') return res.status(400).json({ message: `Transaction is already ${tx.status}` });

    const result = await compareFaces(user.faceImageBase64, d.capturedFaceBase64);

    await prisma.faceVerification.create({
      data: {
        userId: req.user.id,
        transactionId: d.transactionId,
        confidenceScore: result.confidence,
        verificationStatus: result.passed ? 'PASSED' : 'FALLBACK_REQUIRED',
      },
    });

    if (!result.passed) {
      const updated = await prisma.transaction.update({
        where: { id: d.transactionId },
        data: { confidenceScore: result.confidence, method: 'FACE2GO' },
      });
      return res.json({ fallbackRequired: true, confidenceScore: result.confidence, transaction: serializeTx(updated) });
    }

    const approved = await approveTransaction({
      txId: d.transactionId,
      userId: req.user.id,
      method: 'FACE2GO',
      status: 'SUCCESS',
      confidenceScore: result.confidence,
    });

    res.json({ fallbackRequired: false, transaction: serializeTx(approved) });
  } catch (e) {
    next(e);
  }
});

router.post('/transactions/passcode/verify', async (req, res, next) => {
  try {
    const d = passcodeSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const tx = await prisma.transaction.findFirst({ where: { id: d.transactionId, payerId: req.user.id } });
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    if (tx.status !== 'PENDING') return res.status(400).json({ message: `Transaction is already ${tx.status}` });

    const ok = await bcrypt.compare(d.passcode, user.passcodeHash);
    if (!ok) {
      const failed = await prisma.transaction.update({
        where: { id: d.transactionId },
        data: { status: 'FAILED', failureReason: 'Invalid fallback passcode', method: 'FALLBACK' },
      });
      return res.status(400).json(serializeTx(failed));
    }

    const approved = await approveTransaction({
      txId: d.transactionId,
      userId: req.user.id,
      method: 'FALLBACK',
      status: 'SUCCESS_WITH_FALLBACK',
    });
    res.json(serializeTx(approved));
  } catch (e) {
    next(e);
  }
});

router.get('/transactions/history', async (req, res, next) => {
  try {
    const rows = await prisma.transaction.findMany({
      where: { payerId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows.map(serializeTx));
  } catch (e) {
    next(e);
  }
});

router.get('/transactions/:id/result', async (req, res, next) => {
  try {
    const tx = await prisma.transaction.findFirst({ where: { id: req.params.id, payerId: req.user.id } });
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    res.json(serializeTx(tx));
  } catch (e) {
    next(e);
  }
});

module.exports = router;
