/**
 * AFIE AI Provider Placeholders
 *
 * These providers implement the full BaseAIProvider contract but throw
 * a clear "not yet configured" error when called.
 *
 * To activate a provider:
 *   1. Set `enabled: true` in config/providers.config.js
 *   2. Set the required environment variable (see each provider's apiKeyEnv)
 *   3. Install the provider's SDK if required (noted in each class)
 *   4. Replace the complete() body with the real API call
 *
 * The contract (BaseAIProvider) does not change when a placeholder is filled in.
 * The AIProviderRegistry and all callers are unaffected.
 */

import { BaseAIProvider } from './BaseAIProvider.js';
import { Logger }         from '../../core/Logger.js';

// ── OpenAI ────────────────────────────────────────────────────────────────────
// SDK: npm install openai
// Env: OPENAI_API_KEY

export class OpenAIProvider extends BaseAIProvider {
  constructor(config) { super(config); }

  async complete(request) {
    // ── PLACEHOLDER ──────────────────────────────────────────────────
    // Replace this body with the real implementation:
    //
    //   import OpenAI from 'openai';
    //   const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    //   const response = await client.chat.completions.create({
    //     model: request.model,
    //     max_tokens: request.maxTokens,
    //     temperature: request.temperature,
    //     messages: [
    //       { role: 'system', content: request.systemPrompt },
    //       { role: 'user',   content: request.userPrompt  },
    //     ],
    //   });
    //   const rawText = response.choices[0]?.message?.content ?? '';
    //   return {
    //     text: request.responseFormat === 'json' ? this.parseJsonResponse(rawText) : rawText,
    //     inputTokens:  response.usage?.prompt_tokens     ?? 0,
    //     outputTokens: response.usage?.completion_tokens ?? 0,
    //     durationMs:   0,
    //     model:        response.model,
    //     providerId:   this.id,
    //   };
    // ─────────────────────────────────────────────────────────────────
    throw new Error(
      'OpenAIProvider is not yet configured. ' +
      'Set enabled: true in providers.config.js and provide OPENAI_API_KEY.'
    );
  }
}

// ── Google Gemini ─────────────────────────────────────────────────────────────
// SDK: npm install @google/generative-ai
// Env: GOOGLE_AI_API_KEY

export class GoogleProvider extends BaseAIProvider {
  constructor(config) { super(config); }

  async complete(request) {
    // ── PLACEHOLDER ──────────────────────────────────────────────────
    // Replace this body with the real implementation:
    //
    //   import { GoogleGenerativeAI } from '@google/generative-ai';
    //   const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    //   const model = genAI.getGenerativeModel({ model: request.model });
    //   const result = await model.generateContent([
    //     { text: request.systemPrompt + '\n\n' + request.userPrompt },
    //   ]);
    //   const rawText = result.response.text();
    //   return {
    //     text: request.responseFormat === 'json' ? this.parseJsonResponse(rawText) : rawText,
    //     inputTokens:  result.response.usageMetadata?.promptTokenCount     ?? 0,
    //     outputTokens: result.response.usageMetadata?.candidatesTokenCount ?? 0,
    //     durationMs: 0,
    //     model: request.model,
    //     providerId: this.id,
    //   };
    // ─────────────────────────────────────────────────────────────────
    throw new Error(
      'GoogleProvider is not yet configured. ' +
      'Set enabled: true in providers.config.js and provide GOOGLE_AI_API_KEY.'
    );
  }
}

// ── OpenRouter ────────────────────────────────────────────────────────────────
// OpenRouter exposes an OpenAI-compatible API.
// SDK: npm install openai  (reuse openai client pointed at openrouter base URL)
// Env: OPENROUTER_API_KEY

export class OpenRouterProvider extends BaseAIProvider {
  constructor(config) { super(config); }

  async complete(request) {
    // ── PLACEHOLDER ──────────────────────────────────────────────────
    // Replace this body with the real implementation:
    //
    //   import OpenAI from 'openai';
    //   const client = new OpenAI({
    //     apiKey: process.env.OPENROUTER_API_KEY,
    //     baseURL: this.config.auth.baseUrl,
    //     defaultHeaders: { 'HTTP-Referer': 'https://afie.app', 'X-Title': 'AFIE' },
    //   });
    //   const response = await client.chat.completions.create({
    //     model: request.model,
    //     max_tokens: request.maxTokens,
    //     temperature: request.temperature,
    //     messages: [
    //       { role: 'system', content: request.systemPrompt },
    //       { role: 'user',   content: request.userPrompt  },
    //     ],
    //   });
    //   const rawText = response.choices[0]?.message?.content ?? '';
    //   return {
    //     text: request.responseFormat === 'json' ? this.parseJsonResponse(rawText) : rawText,
    //     inputTokens:  response.usage?.prompt_tokens     ?? 0,
    //     outputTokens: response.usage?.completion_tokens ?? 0,
    //     durationMs:   0,
    //     model:        response.model,
    //     providerId:   this.id,
    //   };
    // ─────────────────────────────────────────────────────────────────
    throw new Error(
      'OpenRouterProvider is not yet configured. ' +
      'Set enabled: true in providers.config.js and provide OPENROUTER_API_KEY.'
    );
  }
}

// ── Local Model (Ollama-compatible) ───────────────────────────────────────────
// Ollama exposes an OpenAI-compatible API at localhost.
// SDK: npm install openai  (reuse openai client pointed at localhost)
// Env: none required (local endpoint)

export class LocalModelProvider extends BaseAIProvider {
  constructor(config) { super(config); }

  async complete(request) {
    // ── PLACEHOLDER ──────────────────────────────────────────────────
    // Replace this body with the real implementation:
    //
    //   import OpenAI from 'openai';
    //   const client = new OpenAI({
    //     apiKey: 'ollama',            // Ollama ignores the key value
    //     baseURL: this.config.auth.baseUrl + '/v1',
    //   });
    //   const response = await client.chat.completions.create({
    //     model: request.model,
    //     max_tokens: request.maxTokens,
    //     temperature: request.temperature,
    //     messages: [
    //       { role: 'system', content: request.systemPrompt },
    //       { role: 'user',   content: request.userPrompt  },
    //     ],
    //   });
    //   const rawText = response.choices[0]?.message?.content ?? '';
    //   return {
    //     text: request.responseFormat === 'json' ? this.parseJsonResponse(rawText) : rawText,
    //     inputTokens: 0, outputTokens: 0, durationMs: 0,
    //     model: request.model,
    //     providerId: this.id,
    //   };
    // ─────────────────────────────────────────────────────────────────
    throw new Error(
      'LocalModelProvider is not yet configured. ' +
      'Set enabled: true in providers.config.js and ensure Ollama is running locally.'
    );
  }
}
