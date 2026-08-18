import * as ollamaProvider from "@/lib/ollama";
import * as openaiProvider from "@/lib/openai";
import type {
  GenerateArticleRequest,
  GenerateArticleResponsePayload,
} from "@/lib/schemas";
import type { NewsSourceArticle } from "@/lib/newsdata";

export const generateArticleDraft = (
  input: GenerateArticleRequest,
): Promise<GenerateArticleResponsePayload> =>
  input.provider === "ollama"
    ? ollamaProvider.generateArticleDraft(input)
    : openaiProvider.generateArticleDraft(input);

export const rewriteNewsAsOriginalArticle = (input: {
  category: string;
  tone: string;
  wordCount: number;
  provider?: "openai" | "ollama";
  model?: string;
  article: NewsSourceArticle;
}): Promise<GenerateArticleResponsePayload> =>
  input.provider === "ollama"
    ? ollamaProvider.rewriteNewsAsOriginalArticle(input)
    : openaiProvider.rewriteNewsAsOriginalArticle(input);
