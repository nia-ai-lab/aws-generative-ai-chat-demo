import { useState } from 'react';
import {
  DEFAULT_GENERATION_CONFIG,
  generationConfigSchema,
  type GenerationConfig,
} from '../../shared/generation-config';
import {
  GUARDRAIL_CATALOG,
  GUARDRAIL_POLICY_KEYS,
  type GuardrailPolicyKey,
} from '../../shared/guardrail-catalog';
import { Dialog } from './Dialog';
import { PromptEditor } from './PromptEditor';

interface UserSettingsDialogProps {
  open: boolean;
  value: string;
  generationConfig: GenerationConfig;
  guardrailKeys: GuardrailPolicyKey[];
  requiredGuardrailKeys: GuardrailPolicyKey[];
  onClose: () => void;
  onSave: (value: string, generationConfig: GenerationConfig, guardrailKeys: GuardrailPolicyKey[]) => void;
}

export function UserSettingsDialog({
  open,
  value,
  generationConfig,
  guardrailKeys,
  requiredGuardrailKeys,
  onClose,
  onSave,
}: UserSettingsDialogProps) {
  const [draft, setDraft] = useState(value);
  const [temperature, setTemperature] = useState(String(generationConfig.temperature));
  const [topP, setTopP] = useState(generationConfig.topP === null ? '' : String(generationConfig.topP));
  const [maxOutputTokens, setMaxOutputTokens] = useState(String(generationConfig.maxOutputTokens));
  const [selectedGuardrailKeys, setSelectedGuardrailKeys] = useState<GuardrailPolicyKey[]>(guardrailKeys);

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
    setSelectedGuardrailKeys(guardrailKeys);
    onClose();
  }

  function toggleGuardrail(key: GuardrailPolicyKey) {
    setSelectedGuardrailKeys((current) => current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key]);
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
      <fieldset className="model-fieldset guardrail-fieldset">
        <legend>Guardrail</legend>
        {GUARDRAIL_POLICY_KEYS.map((key) => (
          <label className="check-row guardrail-check-row" key={key}>
            <input
              type="checkbox"
              checked={selectedGuardrailKeys.includes(key)}
              onChange={() => toggleGuardrail(key)}
            />
            <span>
              <strong>{GUARDRAIL_CATALOG[key].label}</strong>
              <small>{GUARDRAIL_CATALOG[key].description}</small>
            </span>
          </label>
        ))}
      </fieldset>
      {requiredGuardrailKeys.length > 0 && (
        <p className="required-setting">
          管理者必須: {requiredGuardrailKeys.map((key) => GUARDRAIL_CATALOG[key].label).join(' / ')}
        </p>
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
            selectedGuardrailKeys,
          )}
        >
          適用
        </button>
      </div>
    </Dialog>
  );
}
