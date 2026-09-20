export interface AIExtractProfileInput {
  resumeText: string;
}

export interface AIExtractProfileOutput {
  identity: { fullName: string; headline: string; location?: string };
  about?: string;
  experiences: Array<{ role: string; company: string; description: string }>;
  education: Array<{ degree: string; institution: string; field?: string }>;
  skills: string[];
  links: Array<{ label: string; url: string }>;
}

export interface AIAnswerInput {
  question: string;
  profileContext: string;
}

export interface AIAnswerOutput {
  answer: string;
  confidence: 'low' | 'medium' | 'high';
  grounded: boolean;
}

export interface AIProvider {
  readonly name: string;
  extractProfile(input: AIExtractProfileInput): Promise<AIExtractProfileOutput>;
  answerQuestion(input: AIAnswerInput): Promise<AIAnswerOutput>;
}

export function createNoopProvider(): AIProvider {
  return {
    name: 'noop',
    extractProfile() {
      return Promise.reject(new Error('AI provider not configured'));
    },
    answerQuestion() {
      return Promise.reject(new Error('AI provider not configured'));
    },
  };
}
