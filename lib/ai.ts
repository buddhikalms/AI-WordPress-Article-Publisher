import * as geminiProvider from "@/lib/gemini";
import * as ollamaProvider from "@/lib/ollama";
import * as openaiProvider from "@/lib/openai";
import type {
  EditArticleRequest,
  GenerateArticleRequest,
  GenerateArticleResponsePayload,
} from "@/lib/schemas";
import type { NewsSourceArticle } from "@/lib/newsdata";

export const generateArticleDraft = (
  input: GenerateArticleRequest & { apiKey?: string },
): Promise<GenerateArticleResponsePayload> =>
  input.provider === "gemini"
    ? geminiProvider.generateArticleDraft(input)
    : input.provider === "ollama"
    ? ollamaProvider.generateArticleDraft(input)
    : openaiProvider.generateArticleDraft(input);

export const editArticleDraft = (
  input: EditArticleRequest & { apiKey?: string },
): Promise<GenerateArticleResponsePayload> =>
  input.provider === "gemini"
    ? geminiProvider.editArticleDraft(input)
    : input.provider === "ollama"
    ? ollamaProvider.editArticleDraft(input)
    : openaiProvider.editArticleDraft(input);

export const rewriteNewsAsOriginalArticle = (input: {
  category: string;
  tone: string;
  wordCount: number;
  provider?: "openai" | "gemini" | "ollama";
  model?: string;
  apiKey?: string;
  article: NewsSourceArticle;
}): Promise<GenerateArticleResponsePayload> =>
  input.provider === "gemini"
    ? geminiProvider.rewriteNewsAsOriginalArticle(input)
    : input.provider === "ollama"
    ? ollamaProvider.rewriteNewsAsOriginalArticle(input)
    : openaiProvider.rewriteNewsAsOriginalArticle(input);
