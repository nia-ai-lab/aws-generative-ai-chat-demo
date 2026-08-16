import { useId, useRef } from 'react';
import { PROMPT_VARIABLES, type PromptVariable } from '../../shared/prompt-variables';
import { insertPromptVariable } from '../lib/prompt-editor';

interface PromptEditorProps {
  label: string;
  value: string;
  maxLength: number;
  rows: number;
  placeholder?: string;
  onChange: (value: string) => void;
}

export function PromptEditor({ label, value, maxLength, rows, placeholder, onChange }: PromptEditorProps) {
  const id = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertVariable(variable: PromptVariable) {
    const textarea = textareaRef.current;
    const result = insertPromptVariable(
      value,
      textarea?.selectionStart ?? value.length,
      textarea?.selectionEnd ?? value.length,
      variable,
      maxLength,
    );
    if (!result) return;
    onChange(result.value);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(result.cursor, result.cursor);
    });
  }

  return (
    <div className="field-block prompt-editor">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        ref={textareaRef}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="prompt-variable-tools" aria-label="プロンプト変数">
        {PROMPT_VARIABLES.map((variable) => (
          <button
            key={variable}
            type="button"
            title={`${variable}をカーソル位置に挿入`}
            aria-label={`${variable}を挿入`}
            onClick={() => insertVariable(variable)}
          >
            {variable}
          </button>
        ))}
      </div>
    </div>
  );
}
