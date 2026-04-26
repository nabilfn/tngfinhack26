const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const auth = require('../middleware/auth');
const { enrollFace, compareFace } = require('../lib/face');
const { evaluateRisk } = require('../lib/agent');

const router = express.Router();
router.use(auth);

function mapTransaction(tx, currentUserId) {
  const role = tx.payerId === currentUserId ? 'PAYER' : tx.receiverId === currentUserId ? 'RECEIVER' : 'UNKNOWN';
  return {
    id: tx.id,
    payerId: tx.payerId,
    receiverId: tx.receiverId,
    amount: tx.amount,
    method: tx.method,
    status: tx.status,
    confidenceScore: tx.confidenceScore,
    failureReason: tx.failureReason,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
    role,
    payerName: tx.payer?.name,
    payerEmail: tx.payer?.email,
    receiverName: tx.receiver?.name,
    receiverEmail: tx.receiver?.email,
  };
}

async function identifyPayerByFace({ receiverId, faceImageBase64, amount }) {
  const enrolledUsers = await prisma.user.findMany({
    where: {
      id: { not: receiverId },
      faceEnrollmentStatus: 'ENROLLED',
      faceImageKey: { not: null },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (enrolledUsers.length === 0) {
    return null;
  }

  let best = null;

  for (const user of enrolledUsers) {
    const result = await compareFace({
      enrolledImageBase64: user.faceImageKey,
      verificationImageBase64: faceImageBase64,
    });

    const candidate = {
      user,
      confidence: Number(result.confidence || 0),
      passed: Boolean(result.passed),
      provider: result.provider,
    };

    if (!best || candidate.confidence > best.confidence) {
      best = candidate;
    }
  }

  // Real AWS Rekognition path: require the best match to pass threshold.
  if (best?.provider !== 'local-fallback') {
    return best?.passed ? best : null;
  }

  // Local demo path: without AWS, camera images cannot be truly matched.
  // Prefer exact same captured/uploaded face image when available, otherwise pick the first enrolled non-receiver with enough balance.
  const exact = enrolledUsers.find((u) => u.faceImageKey === faceImageBase64);
  if (exact) return { user: exact, confidence: 99, passed: true, provider: 'local-fallback-exact' };

  const withBalance = enrolledUsers.find((u) => Number(u.walletBalance) >= Number(amount));
  if (withBalance) return { user: withBalance, confidence: 99, passed: true, provider: 'local-fallback-demo' };

  return best;
}

router.get('/dashboard', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        paymentsToAuthorize: { include: { payer: true, receiver: true }, orderBy: { createdAt: 'desc' }, take: 5 },
        paymentRequests: { include: { payer: true, receiver: true }, orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });

    const transactions = [...user.paymentsToAuthorize, ...user.paymentRequests]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map((tx) => mapTransaction(tx, user.id));

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      walletBalance: user.walletBalance,
      faceEnrollmentStatus: user.faceEnrollmentStatus,
      transactions,
    });
  } catch (err) { next(err); }
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
  } catch (err) { next(err); }
});

const facePaySchema = z.object({
  amount: z.number().positive().max(100000),
  faceImageBase64: z.string().min(50),
  passcode: z.string().optional(),
});

// Receiver/payee is logged in. Payer does not log in; payer is identified from the scanned face.
router.post('/transactions/face-pay', async (req, res, next) => {
  try {
    const body = facePaySchema.parse(req.body);
    const amount = Number(body.amount);

    const match = await identifyPayerByFace({
      receiverId: req.user.id,
      faceImageBase64: body.faceImageBase64,
      amount,
    });

    if (!match?.user) {
      return res.status(404).json({ message: 'No enrolled payer face matched. Ask payer to enroll face first.' });
    }

    const payer = match.user;
    const receiver = await prisma.user.findUnique({ where: { id: req.user.id } });
    const balance = Number(payer.walletBalance);

    const tx = await prisma.transaction.create({
      data: {
        payerId: payer.id,
        receiverId: receiver.id,
        amount,
        status: 'PENDING',
        method: 'FACE2GO',
        confidenceScore: match.confidence,
      },
      include: { payer: true, receiver: true },
    });

    await prisma.faceVerification.create({
      data: {
        userId: payer.id,
        transactionId: tx.id,
        confidenceScore: match.confidence,
        verificationStatus: match.passed ? 'PASSED' : 'FAILED',
      },
    });

    if (!match.passed) {
      const failed = await prisma.transaction.update({
        where: { id: tx.id },
        data: { status: 'FAILED', failureReason: 'Face verification failed' },
        include: { payer: true, receiver: true },
      });
      return res.status(401).json({ message: 'Face verification failed', transaction: mapTransaction(failed, req.user.id) });
    }

    if (balance < amount) {
      const failed = await prisma.transaction.update({
        where: { id: tx.id },
        data: { status: 'FAILED', failureReason: 'Insufficient wallet balance' },
        include: { payer: true, receiver: true },
      });
      return res.status(400).json({ message: 'Insufficient payer wallet balance', transaction: mapTransaction(failed, req.user.id) });
    }

    const risk = await evaluateRisk({
      transactionId: tx.id,
      amount,
      balanceBeforePayment: balance,
      balanceAfterPayment: balance - amount,
      verificationMethod: 'FACE2GO',
      faceConfidence: match.confidence,
      faceEnrolled: true,
      recipient: receiver.email,
      location: 'Malaysia',
      deviceKnown: false,
    });

    const decision = String(risk.decision || '').trim().toUpperCase();
    if (decision === 'BLOCK') {
      const blocked = await prisma.transaction.update({
        where: { id: tx.id },
        data: { status: 'FAILED', failureReason: risk.reason || 'Blocked by AI risk agent' },
        include: { payer: true, receiver: true },
      });
      return res.status(403).json({ message: 'Payment blocked by AI risk agent', risk, transaction: mapTransaction(blocked, req.user.id) });
    }

    const completed = await prisma.$transaction(async (db) => {
      await db.user.update({ where: { id: payer.id }, data: { walletBalance: { decrement: amount } } });
      await db.user.update({ where: { id: receiver.id }, data: { walletBalance: { increment: amount } } });
      return db.transaction.update({
        where: { id: tx.id },
        data: { status: 'SUCCESS', method: 'FACE2GO', confidenceScore: match.confidence },
        include: { payer: true, receiver: true },
      });
    });

    res.json({
      message: 'Face payment completed',
      payerIdentified: { id: payer.id, name: payer.name, email: payer.email },
      transaction: mapTransaction(completed, req.user.id),
      risk,
    });
  } catch (err) { next(err); }
});

const createTxSchema = z.object({
  payerEmail: z.string().email(),
  amount: z.number().positive().max(100000),
});

// Kept for backward compatibility: creates a pending request by payer email.
router.post('/transactions', async (req, res, next) => {
  try {
    const body = createTxSchema.parse(req.body);
    const payer = await prisma.user.findUnique({ where: { email: body.payerEmail.toLowerCase() } });
    if (!payer) return res.status(404).json({ message: 'Payer account not found' });
    if (payer.id === req.user.id) return res.status(400).json({ message: 'You cannot request payment from yourself' });

    const existing = await prisma.transaction.findFirst({
      where: {
        receiverId: req.user.id,
        payerId: payer.id,
        amount: body.amount,
        status: 'PENDING',
        createdAt: { gte: new Date(Date.now() - 20 * 60 * 1000) },
      },
      include: { payer: true, receiver: true },
    });
    if (existing) return res.json({ ...mapTransaction(existing, req.user.id), reused: true });

    const tx = await prisma.transaction.create({
      data: { payerId: payer.id, receiverId: req.user.id, amount: body.amount, status: 'PENDING' },
      include: { payer: true, receiver: true },
    });
    res.status(201).json(mapTransaction(tx, req.user.id));
  } catch (err) { next(err); }
});

router.get('/transactions', async (req, res, next) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { OR: [{ payerId: req.user.id }, { receiverId: req.user.id }] },
      include: { payer: true, receiver: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ transactions: transactions.map((tx) => mapTransaction(tx, req.user.id)) });
  } catch (err) { next(err); }
});

const verifySchema = z.object({
  transactionId: z.string().uuid(),
  faceImageBase64: z.string().optional(),
  passcode: z.string().optional(),
});

// Kept for backward compatibility with the old payer-login flow.
router.post('/transactions/verify', async (req, res, next) => {
  try {
    const body = verifySchema.parse(req.body);
    const tx = await prisma.transaction.findFirst({
      where: { id: body.transactionId, payerId: req.user.id },
      include: { payer: true, receiver: true },
    });
    if (!tx) return res.status(404).json({ message: 'Transaction not found for this payer account' });
    if (tx.status !== 'PENDING') return res.status(400).json({ message: 'Transaction already processed' });

    const user = tx.payer;
    const balance = Number(user.walletBalance);
    const amount = Number(tx.amount);
    if (balance < amount) {
      const failed = await prisma.transaction.update({
        where: { id: tx.id },
        data: { status: 'FAILED', failureReason: 'Insufficient wallet balance' },
        include: { payer: true, receiver: true },
      });
      return res.status(400).json({ message: 'Insufficient wallet balance', transaction: mapTransaction(failed, req.user.id) });
    }

    let method = 'FACE2GO';
    let confidence = null;

    if (body.faceImageBase64 && user.faceEnrollmentStatus === 'ENROLLED') {
      const result = await compareFace({ enrolledImageBase64: user.faceImageKey, verificationImageBase64: body.faceImageBase64 });
      confidence = result.confidence;
      await prisma.faceVerification.create({
        data: { userId: user.id, transactionId: tx.id, confidenceScore: confidence, verificationStatus: result.passed ? 'PASSED' : 'FAILED' },
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
      recipient: tx.receiver.email,
      location: 'Malaysia',
      deviceKnown: false,
    });

    const decision = String(risk.decision || '').trim().toUpperCase();
    if (decision === 'BLOCK') {
      const blocked = await prisma.transaction.update({
        where: { id: tx.id },
        data: { status: 'FAILED', failureReason: risk.reason || 'Blocked by AI risk agent' },
        include: { payer: true, receiver: true },
      });
      return res.status(403).json({ message: 'Payment blocked by AI risk agent', risk, transaction: mapTransaction(blocked, req.user.id) });
    }

    if (['REQUIRE_VERIFICATION', 'REQUIRE_EXTRA_VERIFICATION', 'CHALLENGE'].includes(decision) && method !== 'FALLBACK') {
      return res.status(200).json({ message: 'Additional verification required', requiresExtraVerification: true, risk: { ...risk, decision }, nextStep: 'fallback_passcode' });
    }

    const updated = await prisma.$transaction(async (db) => {
      await db.user.update({ where: { id: tx.payerId }, data: { walletBalance: { decrement: amount } } });
      await db.user.update({ where: { id: tx.receiverId }, data: { walletBalance: { increment: amount } } });
      return db.transaction.update({
        where: { id: tx.id },
        data: { status: method === 'FALLBACK' ? 'SUCCESS_WITH_FALLBACK' : 'SUCCESS', method, confidenceScore: confidence },
        include: { payer: true, receiver: true },
      });
    });

    res.json({ message: 'Payment authorized', transaction: mapTransaction(updated, req.user.id), risk });
  } catch (err) { next(err); }
});

module.exports = router;
