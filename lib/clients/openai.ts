// Lazy OpenAI client to prevent build-time initialization errors
import OpenAI from 'openai';

let openaiInstance: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    
    openaiInstance = new OpenAI({
      apiKey: key,
    });
  }
  
  return openaiInstance;
}