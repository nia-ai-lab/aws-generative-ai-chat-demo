import { describe, expect, it } from 'vitest';
import { chatRequestSchema, updateAdminConfigSchema } from '../../shared/api-schema.js';

const validChat = {
  requestId: '550e8400-e29b-41d4-a716-446655440000',
  browserSessionId: '55f4ec01-f06b-4d97-8cf7-19999ddabda0',
  conversationSessionId: 'b52817f8-3778-45be-8ca6-5ad67956b9f7',
  modelKey: 'claude-sonnet-5',
  message: '生成AIとは何ですか？',
  userSystemPrompt: '',
  timeZone: 'Asia/Tokyo',
};

describe('chat request validation', () => {
  it('accepts a valid Japanese message', () => {
    expect(chatRequestSchema.parse(validChat).message).toBe(validChat.message);
  });

  it('rejects blank and oversized input', () => {
    expect(() => chatRequestSchema.parse({ ...validChat, message: '  ' })).toThrow();
    expect(() => chatRequestSchema.parse({ ...validChat, message: 'x'.repeat(8_001) })).toThrow();
  });

  it('rejects an invalid time zone', () => {
    expect(() => chatRequestSchema.parse({ ...validChat, timeZone: 'Moon/SeaOfTranquility' })).toThrow();
  });
});

describe('admin config validation', () => {
  it('allows an empty app default prompt', () => {
    const result = updateAdminConfigSchema.parse({
      expectedConfigVersion: 1,
      defaultModelKey: 'claude-sonnet-5',
      enabledModelKeys: ['claude-sonnet-5'],
      defaultSystemPrompt: '',
    });
    expect(result.defaultSystemPrompt).toBe('');
  });

  it('requires the default model to remain enabled', () => {
    expect(() => updateAdminConfigSchema.parse({
      expectedConfigVersion: 1,
      defaultModelKey: 'claude-sonnet-5',
      enabledModelKeys: ['nova-2-lite'],
      defaultSystemPrompt: '安全に回答する',
    })).toThrow();
  });
});
