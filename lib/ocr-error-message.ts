const HIGH_DEMAND_PATTERNS = [
  "this model is currently experiencing high demand",
  "spikes in demand are usually temporary",
  "please try again later",
];

const HIGH_DEMAND_MESSAGE_ES =
  "Este modelo esta experimentando alta demanda. Los picos de demanda suelen ser temporales. Intenta de nuevo mas tarde.";
const HIGH_DEMAND_PATTERNS_ES = [
  "este modelo esta experimentando alta demanda",
  "los picos de demanda suelen ser temporales",
  "intenta de nuevo mas tarde",
];

export function isHighDemandOcrProviderMessage(message: string): boolean {
  const normalizedMessage = message.trim();
  if (!normalizedMessage) return false;

  const lowerMessage = normalizedMessage.toLowerCase();
  const matchesEnglish = HIGH_DEMAND_PATTERNS.every((pattern) =>
    lowerMessage.includes(pattern)
  );
  const matchesSpanish = HIGH_DEMAND_PATTERNS_ES.every((pattern) =>
    lowerMessage.includes(pattern)
  );
  return matchesEnglish || matchesSpanish;
}

export function localizeOcrProviderErrorMessage(message: string): string {
  const normalizedMessage = message.trim();
  if (!normalizedMessage) return normalizedMessage;

  if (isHighDemandOcrProviderMessage(normalizedMessage)) {
    return HIGH_DEMAND_MESSAGE_ES;
  }

  return normalizedMessage;
}
