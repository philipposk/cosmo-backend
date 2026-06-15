export type GenerateStoryRequest = {
  prompt: string;
  tone?: string;
  genre?: string;
  safetyLevel?: string;
  maxWords: number;
  tags: string[];
  modelIdentifier: string;
};

export type GenerateStoryResult = {
  title: string | null;
  synopsis: string | null;
  content: string;
  tokensUsed?: number;
};

export interface AIProvider {
  supports(modelIdentifier: string): boolean;
  generateStory(request: GenerateStoryRequest): Promise<GenerateStoryResult>;
}
