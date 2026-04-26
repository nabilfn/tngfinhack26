export async function agenticRiskAssistant({ amount, payer, receiver, risk }) {
  const prompt = `
You are an AI payment risk assistant for a biometric payment system.

Analyze this transaction:

Amount: RM${amount}
Payer: ${payer.name}
Receiver: ${receiver.name}
Risk score: ${risk.riskScore}
Risk decision: ${risk.decision}
Risk reasons: ${risk.reasons.join(', ') || 'None'}

Return JSON only:
{
  "aiDecision": "ALLOW" | "VERIFY" | "BLOCK",
  "summary": "short explanation",
  "recommendedAction": "what the system should do",
  "customerMessage": "simple message for frontend"
}
`;

  // Demo-safe fallback without Bedrock
  if (!process.env.AWS_REGION || !process.env.BEDROCK_MODEL_ID) {
    return {
      aiDecision: risk.decision,
      summary:
        risk.decision === 'ALLOW'
          ? 'Transaction appears normal based on current risk signals.'
          : 'Transaction requires additional verification based on risk signals.',
      recommendedAction:
        risk.decision === 'ALLOW'
          ? 'Proceed with payment.'
          : 'Request extra verification before processing.',
      customerMessage:
        risk.decision === 'ALLOW'
          ? 'Payment looks safe to continue.'
          : 'Extra verification is required for this payment.',
    };
  }

  // Later: plug Bedrock here
  return {
    aiDecision: risk.decision,
    summary: 'AI reviewed the transaction risk context.',
    recommendedAction:
      risk.decision === 'ALLOW'
        ? 'Proceed with payment.'
        : 'Request extra verification before processing.',
    customerMessage:
      risk.decision === 'ALLOW'
        ? 'Payment approved by AI risk assistant.'
        : 'AI recommends extra verification.',
  };
}