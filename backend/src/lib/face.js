const { RekognitionClient, IndexFacesCommand, CompareFacesCommand } = require('@aws-sdk/client-rekognition');

function hasAwsConfig() {
  return Boolean(process.env.AWS_REGION && process.env.REKOGNITION_COLLECTION_ID && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

function base64ToBuffer(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') throw new Error('Face image is required');
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  return Buffer.from(base64, 'base64');
}

const client = new RekognitionClient({
  region: process.env.AWS_REGION || 'ap-southeast-1',
  ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && {
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      ...(process.env.AWS_SESSION_TOKEN && { sessionToken: process.env.AWS_SESSION_TOKEN }),
    },
  }),
});

async function enrollFace({ userId, faceImageBase64 }) {
  const imageBytes = base64ToBuffer(faceImageBase64);

  if (!hasAwsConfig() || process.env.REKOGNITION_LOCAL_FALLBACK === 'true') {
    return {
      provider: 'local-fallback',
      faceId: `local-${userId}`,
      collectionId: process.env.REKOGNITION_COLLECTION_ID || 'local-face2go-users',
    };
  }

  const result = await client.send(new IndexFacesCommand({
    CollectionId: process.env.REKOGNITION_COLLECTION_ID,
    ExternalImageId: userId.replace(/[^a-zA-Z0-9_.:-]/g, '_'),
    Image: { Bytes: imageBytes },
    MaxFaces: 1,
    QualityFilter: 'AUTO',
    DetectionAttributes: ['DEFAULT'],
  }));

  const face = result.FaceRecords?.[0]?.Face;
  if (!face?.FaceId) throw new Error('No face detected. Please use a clear front-facing image.');

  return {
    provider: 'aws-rekognition',
    faceId: face.FaceId,
    collectionId: process.env.REKOGNITION_COLLECTION_ID,
  };
}

async function compareFace({ enrolledImageBase64, verificationImageBase64 }) {
  if (!verificationImageBase64) throw new Error('Verification face image is required');

  if (!hasAwsConfig() || process.env.REKOGNITION_LOCAL_FALLBACK === 'true' || !enrolledImageBase64) {
    return { passed: true, confidence: 99, provider: 'local-fallback' };
  }

  const result = await client.send(new CompareFacesCommand({
    SourceImage: { Bytes: base64ToBuffer(enrolledImageBase64) },
    TargetImage: { Bytes: base64ToBuffer(verificationImageBase64) },
    SimilarityThreshold: Number(process.env.REKOGNITION_THRESHOLD || 95),
  }));

  const best = result.FaceMatches?.sort((a, b) => (b.Similarity || 0) - (a.Similarity || 0))[0];
  const confidence = best?.Similarity || 0;
  return {
    passed: confidence >= Number(process.env.REKOGNITION_THRESHOLD || 95),
    confidence,
    provider: 'aws-rekognition',
  };
}

module.exports = { enrollFace, compareFace };
