require('dotenv').config(); // Ensure env variables are loaded
const router = require('express').Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../services/prisma');
const auth = require('../middleware/auth');
const { createTxSchema, facePaySchema, passcodeSchema, transactionIdSchema } = require('../validators/schemas');
const { compareFaces } = require('../services/rekognition.service');
const { Prisma } = require('@prisma/client');

// ============================================================================
// ENCRYPTION SETUP
// ============================================================================
const keyString = process.env.ENCRYPTION_KEY;
if (!keyString || keyString.length !== 64) {
  console.warn("WARNING: ENCRYPTION_KEY is missing or invalid in .env. Transactions will fail.");
}
const ENCRYPTION_KEY = keyString ? Buffer.from(keyString, 'hex') : crypto.randomBytes(32);

function encryptTransactionData(transactionObject) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  
  const transactionString = JSON.stringify(transactionObject);
  let encryptedData = cipher.update(transactionString, 'utf8', 'hex');
  encryptedData += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return {
    encryptedData: encryptedData,
    iv: iv.toString('hex'),
    authTag: authTag
  };
}

// ============================================================================
// UTILS
// ============================================================================
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

// ============================================================================
// CORE TRANSACTION LOGIC (WITH CHECKER & ROLLBACK)
// ============================================================================
async function approveTransaction({ txId, userId, method, status, confidenceScore = null }) {
  // 1. Fetch pending transaction
  const tx = await prisma.transaction.findFirst({
    where: { id: txId, payerId: userId, status: 'PENDING' },
  });
  if (!tx) throw Object.assign(new Error('Pending transaction not found'), { status: 404 });

  // 2. Fetch Sender and Receiver (assuming tx.recipient holds the receiver's User ID)
  const sender = await prisma.user.findUnique({ where: { id: userId } });
  const receiver = await prisma.user.findUnique({ where: { id: tx.recipient } });

  if (!sender) throw Object.assign(new Error('Sender not found'), { status: 404 });
  if (!receiver) throw Object.assign(new Error('Recipient not found'), { status: 404 });

  const senderInitialBalance = new Prisma.Decimal(sender.walletBalance);
  const receiverInitialBalance = new Prisma.Decimal(receiver.walletBalance);
  const amount = new Prisma.Decimal(tx.amount);

  // 3. Encrypt the transaction record
  const encryptedTx = encryptTransactionData({
    txId: tx.id,
    senderId: sender.id,
    receiverId: receiver.id,
    amount: amount.toString(),
    method,
    timestamp: Date.now()
  });

  // 4. Initial Balance Check
  if (senderInitialBalance.lt(amount)) {
    const failedTx = await prisma.transaction.update({
      where: { id: txId },
      data: { 
        status: 'FAILED', 
        failureReason: 'Insufficient balance', 
        method, 
        confidenceScore 
      },
    });
    return failedTx;
  }

  // 5. Process Transfer & Track Changes for Potential Rollback
  let senderDecreased = false;
  let receiverIncreased = false;

  try {
    // Decrease Sender
    await prisma.user.update({
      where: { id: sender.id },
      data: { walletBalance: senderInitialBalance.minus(amount) },
    });
    senderDecreased = true;

    // Increase Receiver
    await prisma.user.update({
      where: { id: receiver.id },
      data: { walletBalance: receiverInitialBalance.plus(amount) },
    });
    receiverIncreased = true;

    // 6. The Checker: Verify database state exactly matches math expectations
    const currentSender = await prisma.user.findUnique({ where: { id: sender.id } });
    const currentReceiver = await prisma.user.findUnique({ where: { id: receiver.id } });

    const expectedSenderBalance = senderInitialBalance.minus(amount);
    const expectedReceiverBalance = receiverInitialBalance.plus(amount);

    if (
      !new Prisma.Decimal(currentSender.walletBalance).equals(expectedSenderBalance) ||
      !new Prisma.Decimal(currentReceiver.walletBalance).equals(expectedReceiverBalance)
    ) {
      throw new Error("Checker Failed: Wallet balances do not match expected mathematical outcome.");
    }

    // 7. Success: Save encrypted transaction
    return await prisma.transaction.update({
      where: { id: txId },
      data: { 
        method, 
        status, 
        confidenceScore, 
        failureReason: null,
        encryptedData: encryptedTx.encryptedData,
        iv: encryptedTx.iv,
        authTag: encryptedTx.authTag
      },
    });

  } catch (error) {
    console.error("Transaction Error, Initiating Rollback:", error.message);

    // 8. The Rollback: Negate the transaction and revert balances safely
    if (senderDecreased) {
      await prisma.user.update({
        where: { id: sender.id },
        data: { walletBalance: senderInitialBalance },
      });
    }
    if (receiverIncreased) {
      await prisma.user.update({
        where: { id: receiver.id },
        data: { walletBalance: receiverInitialBalance },
      });
    }

    // Mark as failed and store encryption
    const failedTx = await prisma.transaction.update({
      where: { id: txId },
      data: { 
        status: 'FAILED', 
        failureReason: 'System verification failed: ' + error.message, 
        method, 
        confidenceScore,
        encryptedData: encryptedTx.encryptedData,
        iv: encryptedTx.iv,
        authTag: encryptedTx.authTag
      },
    });

    return failedTx;
  }
}

// ============================================================================
// ROUTES
// ============================================================================

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
