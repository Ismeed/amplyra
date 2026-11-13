import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiProviderService {
  constructor(private readonly configService: ConfigService) {}

  async generateText(params: {
    systemPrompt: string;
    userPrompt: string;
    fallbackGenerator: () => string;
  }): Promise<{ text: string; providerUsed: string }> {
    const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (geminiKey) {
      try {
        const model =
          this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.0-flash';
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: params.systemPrompt }] },
              contents: [{ parts: [{ text: params.userPrompt }] }],
            }),
          },
        );
        if (res.ok) {
          const data = (await res.json()) as {
            candidates?: Array<{
              content?: { parts?: Array<{ text?: string }> };
            }>;
          };
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) {
            return { text, providerUsed: `gemini:${model}` };
          }
        }
      } catch {
        // Fall through cleanly to next provider or deterministic engine
      }
    }

    const openAiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (openAiKey) {
      try {
        const model =
          this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openAiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: params.systemPrompt },
              { role: 'user', content: params.userPrompt },
            ],
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const text = data.choices?.[0]?.message?.content?.trim();
          if (text) {
            return { text, providerUsed: `openai:${model}` };
          }
        }
      } catch {
        // Fall through cleanly
      }
    }

    return {
      text: params.fallbackGenerator(),
      providerUsed: 'amplyra-brand-engine',
    };
  }
}
