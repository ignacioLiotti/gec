const HIGH_DEMAND_PATTERNS = [
  "this model is currently experiencing high demand",
  "spikes in demand are usually temporary",
  "please try again later",
];

const HIGH_DEMAND_MESSAGE_ES =
  "Este modelo esta experimentando alta demanda. Los picos de demanda suelen ser temporales. Intenta de nuevo mas tarde.";

export function localizeOcrProviderErrorMessage(message: string): string {
  const normalizedMessage = message.trim();
  if (!normalizedMessage) return normalizedMessage;

  const lowerMessage = normalizedMessage.toLowerCase();
  const matchesHighDemand = HIGH_DEMAND_PATTERNS.every((pattern) =>
    lowerMessage.includes(pattern)
  );

  if (matchesHighDemand) {
    return HIGH_DEMAND_MESSAGE_ES;
  }

  return normalizedMessage;
}
