/**
 * AFIE AnthropicProvider
 *
 * Production-ready AI provider adapter for Anthropic Claude.
 *
 * Implements the BaseAIProvider contract.
 * Wraps the @anthropic-ai/sdk used in the original AIClient.js,
 * but exposes the provider-agnostic AIRequest/AIResponse interface.
 *
 * This is the only provider that is active by default.
 * All others are placeholders awaiting API key configuration.
 */

import Anthropic           from '@anthropic-ai/sdk';
import { BaseAIProvider }  from './BaseAIProvider.js';
import { Logger }          from '../../core/Logger.js';

const logger = new Logger('AnthropicProvider');

export class AnthropicProvider extends BaseAIProvider {
  constructor(providerConfig) {
    super(providerConfig);
    this._client = null;
  }

  _getClient() {
    if (!this._client) {
      const apiKey = process.env[this.config.auth.apiKeyEnv];
      if (!apiKey) {
        throw new Error(
          `Anthropic API key not found. Set the ${this.config.auth.apiKeyEnv} environment variable.`
        );
      }
      this._client = new Anthropic({ apiKey });
    }
    return this._client;
  }

  async complete(request) {
    const { model, systemPrompt, userPrompt, maxTokens, temperature, responseFormat } = request;
    const startMs = Date.now();

    logger.debug(`Anthropic call — model: ${model}, maxTokens: ${maxTokens}`);

    const message = await this._getClient().messages.create({
      model,
      max_tokens:  maxTokens,
      temperature,
      system:      systemPrompt,
      messages:    [{ role: 'user', content: userPrompt }],
    });

    const durationMs    = Date.now() - startMs;
    const rawText       = message.content?.[0]?.text || '';
    const inputTokens   = message.usage?.input_tokens  ?? 0;
    const outputTokens  = message.usage?.output_tokens ?? 0;

    logger.debug(
      `Anthropic complete — ${outputTokens} output tokens, ${durationMs}ms`
    );

    const text = responseFormat === 'json'
      ? this.parseJsonResponse(rawText)
      : rawText;

    return {
      text,
      inputTokens,
      outputTokens,
      durationMs,
      model:      message.model ?? model,
      providerId: this.id,
    };
  }
}
