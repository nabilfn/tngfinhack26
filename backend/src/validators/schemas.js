const { z } = require('zod');

const base64Image = z
  .string()
  .min(50, 'Image is required')
  .refine((v) => /^data:image\/(jpeg|jpg|png|webp);base64,/.test(v), 'Image must be a base64 data URL');

exports.signupSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
  passcode: z.string().regex(/^\d{6}$/, 'Passcode must be 6 digits'),
  initialWalletBalance: z.coerce.number().min(0),
  faceImageBase64: base64Image.optional(),
});

exports.loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

exports.createTxSchema = z.object({
  recipient: z.string().trim().min(2),
  amount: z.coerce.number().positive(),
});

exports.transactionIdSchema = z.object({
  transactionId: z.string().uuid(),
});

exports.facePaySchema = z.object({
  transactionId: z.string().uuid(),
  capturedFaceBase64: base64Image,
});

exports.passcodeSchema = z.object({
  transactionId: z.string().uuid(),
  passcode: z.string().regex(/^\d{6}$/, 'Passcode must be 6 digits'),
});
