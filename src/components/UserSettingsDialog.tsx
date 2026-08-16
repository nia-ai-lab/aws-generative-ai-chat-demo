import { useState } from 'react';
import {
  DEFAULT_GENERATION_CONFIG,
  generationConfigSchema,
  type GenerationConfig,
} from '../../shared/generation-config';
import {
  GUARDRAIL_CATALOG,
  GUARDRAIL_KEYS,
  type GuardrailKey,
} from '../../shared/guardrail-catalog';
import { Dialog } from './Dialog';
import { PromptEditor } from './PromptEditor';

interface UserSettingsDialogProps {
  open: boolean;
  value: string;
  generationConfig: GenerationConfig;
  guardrailKey: GuardrailKey;
  requiredGuardrailKey: GuardrailKey;
  onClose: () => void;
  onSave: (value: string, generationConfig: GenerationConfig, guardrailKey: GuardrailKey) => void;
}

export function UserSettingsDialog({
  open,
  value,
  generationConfig,
  guardrailKey,
  requiredGuardrailKey,
  onClose,
  onSave,
}: UserSettingsDialogProps) {
  const [draft, setDraft] = useState(value);
  const [temperature, setTemperature] = useState(String(generationConfig.temperature));
  const [topP, setTopP] = useState(generationConfig.topP === null ? '' : String(generationConfig.topP));
  const [maxOutputTokens, setMaxOutputTokens] = useState(String(generationConfig.maxOutputTokens));
  const [selectedGuardrailKey, setSelectedGuardrailKey] = useState<GuardrailKey>(guardrailKey);

  const parsedGenerationConfig = generationConfigSchema.safeParse({
    temperature: temperature === '' ? undefined : Number(temperature),
    topP: topP === '' ? null : Number(topP),
    maxOutputTokens: maxOutputTokens === '' ? undefined : Number(maxOutputTokens),
  });

  function cancel() {
    setDraft(value);
    setTemperature(String(generationConfig.temperature));
    setTopP(generationConfig.topP === null ? '' : String(generationConfig.topP));
    setMaxOutputTokens(String(generationConfig.maxOutputTokens));
    setSelectedGuardrailKey(guardrailKey);
    onClose();
  }

  function resetGenerationDefaults() {
    setTemperature(String(DEFAULT_GENERATION_CONFIG.temperature));
    setTopP(DEFAULT_GENERATION_CONFIG.topP === null ? '' : String(DEFAULT_GENERATION_CONFIG.topP));
    setMaxOutputTokens(String(DEFAULT_GENERATION_CONFIG.maxOutputTokens));
  }

  return (
    <Dialog open={open} title="チャット設定" onClose={cancel}>
      <PromptEditor
        label="システムプロンプト(ペルソナ)"
        rows={7}
        maxLength={4_000}
        placeholder="例: 親しみやすい先生として簡潔に答えてください。"
        value={draft}
        onChange={setDraft}
      />
      <label className="field-block">
        <span>Guardrail</span>
        <select
          aria-label="Guardrail"
          value={selectedGuardrailKey}
          onChange={(event) => setSelectedGuardrailKey(event.target.value as GuardrailKey)}
        >
          {GUARDRAIL_KEYS.map((key) => (
            <option key={key} value={key}>{GUARDRAIL_CATALOG[key].label}</option>
          ))}
        </select>
      </label>
      <p className="setting-hint">{GUARDRAIL_CATALOG[selectedGuardrailKey].description}</p>
      {requiredGuardrailKey !== 'none' && (
        <p className="required-setting">管理者必須: {GUARDRAIL_CATALOG[requiredGuardrailKey].label}</p>
      )}
      <div className="generation-settings">
        <label className="field-block">
          <span>Temperature</span>
          <input
            type="number"
            min="0"
            max="1"
            step="0.1"
            inputMode="decimal"
            value={temperature}
            onChange={(event) => setTemperature(event.target.value)}
          />
        </label>
        <label className="field-block">
          <span>Top P</span>
          <input
            type="number"
            min="0"
            max="1"
            step="0.1"
            inputMode="decimal"
            placeholder="モデル既定"
            value={topP}
            onChange={(event) => setTopP(event.target.value)}
          />
        </label>
        <label className="field-block full-width">
          <span>最大アウトプットトークン</span>
          <input
            type="number"
            min="1"
            max="4096"
            step="1"
            inputMode="numeric"
            value={maxOutputTokens}
            onChange={(event) => setMaxOutputTokens(event.target.value)}
          />
        </label>
      </div>
      <div className="dialog-actions">
        <button type="button" className="secondary-button reset-button" onClick={resetGenerationDefaults}>
          デフォルトに戻す
        </button>
        <button type="button" className="secondary-button" onClick={cancel}>キャンセル</button>
        <button
          type="button"
          className="primary-button"
          disabled={!parsedGenerationConfig.success}
          onClick={() => parsedGenerationConfig.success && onSave(
            draft,
            parsedGenerationConfig.data,
            selectedGuardrailKey,
          )}
        >
          適用
        </button>
      </div>
    </Dialog>
  );
}
