const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require('@aws-sdk/client-bedrock-runtime');

const clientConfig = {
  region: process.env.AWS_REGION || 'ap-southeast-1',
};

if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  clientConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    ...(process.env.AWS_SESSION_TOKEN && { sessionToken: process.env.AWS_SESSION_TOKEN }),
  };
}

const client = new BedrockRuntimeClient(clientConfig);

async function evaluateRisk(data) {
  if (process.env.BEDROCK_LOCAL_FALLBACK === 'true') {
    return {
      decision: 'APPROVE',
      riskLevel: 'LOW',
      reason: 'Local fallback enabled. Transaction approved for demo mode.',
    };
  }

  const prompt = `
You are a fintech fraud detection AI.

Rules:
- Low amount + high confidence → APPROVE
- High amount + unknown device → REQUIRE_VERIFICATION
- Multiple risks → BLOCK

Transaction:
${JSON.stringify(data)}

Return JSON only.
`;

  const command = new InvokeModelCommand({
    modelId:
      process.env.BEDROCK_MODEL_ID ||
      'anthropic.claude-3-haiku-20240307-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: prompt }],
        },
      ],
    }),
  });

  const response = await client.send(command);
  const decoded = new TextDecoder().decode(response.body);
  const parsed = JSON.parse(decoded);
  const text = parsed.content?.[0]?.text || '{}';

  return JSON.parse(text);
}

module.exports = { evaluateRisk };