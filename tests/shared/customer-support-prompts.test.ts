import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const promptDirectory = path.resolve('demo-prompts/customer-support');
const stageFiles = readdirSync(promptDirectory)
  .filter((name) => name.startsWith('stage-') && name.endsWith('.md'))
  .sort();

describe('customer support responsible AI prompts', () => {
  it('provides one complete prompt for the baseline and each of the eight aspects', () => {
    expect(stageFiles).toHaveLength(9);
  });

  it('keeps every stage within the participant system prompt limit', () => {
    for (const filename of stageFiles) {
      const prompt = readFileSync(path.join(promptDirectory, filename), 'utf8');
      expect(prompt.length, filename).toBeLessThanOrEqual(4_000);
    }
  });

  it('pins governance metadata in the final prompt', () => {
    const finalPrompt = readFileSync(path.join(promptDirectory, 'stage-8-governance-final.md'), 'utf8');
    expect(finalPrompt).toContain('ポリシーバージョン: CS-AI-1.0');
    expect(finalPrompt).toContain('実際の修理受付');
  });
});
