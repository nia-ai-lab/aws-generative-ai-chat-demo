import type { PromptVariable } from '../../shared/prompt-variables';

export function insertPromptVariable(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  variable: PromptVariable,
  maxLength: number,
): { value: string; cursor: number } | undefined {
  const next = `${value.slice(0, selectionStart)}${variable}${value.slice(selectionEnd)}`;
  if (next.length > maxLength) return undefined;
  return { value: next, cursor: selectionStart + variable.length };
}
