const { RekognitionClient, CompareFacesCommand } = require('@aws-sdk/client-rekognition');

const threshold = Number(process.env.REKOGNITION_THRESHOLD || 95);

function base64ToBytes(data) {
  if (!data || typeof data !== 'string') {
    throw Object.assign(new Error('Image is required for face verification'), { status: 400 });
  }
  const cleaned = data.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(cleaned, 'base64');
}

function assertAwsConfigured() {
  const missing = [];
  if (!process.env.AWS_REGION) missing.push('AWS_REGION');
  if (!process.env.AWS_ACCESS_KEY_ID) missing.push('AWS_ACCESS_KEY_ID');
  if (!process.env.AWS_SECRET_ACCESS_KEY) missing.push('AWS_SECRET_ACCESS_KEY');
  if (missing.length) {
    throw Object.assign(
      new Error(`AWS Rekognition is not configured. Missing: ${missing.join(', ')}`),
      { status: 503 }
    );
  }
}

exports.compareFaces = async (sourceBase64, targetBase64) => {
  assertAwsConfigured();

  const client = new RekognitionClient({ region: process.env.AWS_REGION });
  const out = await client.send(
    new CompareFacesCommand({
      SourceImage: { Bytes: base64ToBytes(sourceBase64) },
      TargetImage: { Bytes: base64ToBytes(targetBase64) },
      SimilarityThreshold: 80,
      QualityFilter: 'AUTO',
    })
  );

  const confidence = Number(out.FaceMatches?.[0]?.Similarity || 0);
  return {
    confidence,
    passed: confidence >= threshold,
    provider: 'aws-rekognition',
  };
};
