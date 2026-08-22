import { useState } from 'react';
import type { AdminConfig, UpdateAdminConfig } from '../../shared/api-schema';
import {
  GUARDRAIL_CATALOG,
  GUARDRAIL_POLICY_KEYS,
  type GuardrailPolicyKey,
} from '../../shared/guardrail-catalog';
import { MODEL_CATALOG, MODEL_KEYS, type ModelKey } from '../../shared/model-catalog';
import { MAX_USD_TO_JPY_RATE, MIN_USD_TO_JPY_RATE } from '../../shared/model-pricing';
import { Dialog } from './Dialog';
import { PromptEditor } from './PromptEditor';
import { TOOL_CATALOG, TOOL_KEYS, type ToolKey } from '../../shared/tool-catalog';

interface AdminSettingsDialogProps {
  open: boolean;
  config?: AdminConfig;
  loading: boolean;
  error: string;
  onClose: () => void;
  onSave: (value: UpdateAdminConfig) => Promise<void>;
}

export function AdminSettingsDialog(props: AdminSettingsDialogProps) {
  const { open, config, loading, error, onClose, onSave } = props;

  return (
    <Dialog open={open} title="管理設定" onClose={onClose}>
      {loading && <p className="muted">読み込み中...</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {config && <AdminSettingsForm key={config.configVersion} config={config} onClose={onClose} onSave={onSave} />}
    </Dialog>
  );
}

function AdminSettingsForm({ config, onClose, onSave }: {
  config: AdminConfig;
  onClose: () => void;
  onSave: (value: UpdateAdminConfig) => Promise<void>;
}) {
  const [prompt, setPrompt] = useState(config.defaultSystemPrompt);
  const [enabled, setEnabled] = useState<ModelKey[]>(config.enabledModelKeys);
  const [defaultModel, setDefaultModel] = useState<ModelKey>(config.defaultModelKey);
  const [requiredGuardrailKeys, setRequiredGuardrailKeys] = useState<GuardrailPolicyKey[]>(config.requiredGuardrailKeys);
  const [defaultToolKeys, setDefaultToolKeys] = useState<ToolKey[]>(config.defaultToolKeys);
  const [usdToJpyRate, setUsdToJpyRate] = useState(String(config.usdToJpyRate));
  const [saving, setSaving] = useState(false);
  const parsedUsdToJpyRate = Number(usdToJpyRate);
  const validUsdToJpyRate = Number.isFinite(parsedUsdToJpyRate)
    && parsedUsdToJpyRate >= MIN_USD_TO_JPY_RATE
    && parsedUsdToJpyRate <= MAX_USD_TO_JPY_RATE;

  function toggleModel(key: ModelKey) {
    setEnabled((current) => {
      if (current.includes(key)) {
        if (current.length === 1 || key === defaultModel) return current;
        return current.filter((item) => item !== key);
      }
      return [...current, key];
    });
  }

  function toggleRequiredGuardrail(key: GuardrailPolicyKey) {
    setRequiredGuardrailKeys((current) => current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key]);
  }

  function toggleTool(key: ToolKey) {
    setDefaultToolKeys((current) => current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key]);
  }

  async function save() {
    setSaving(true);
    try {
      await onSave({
        expectedConfigVersion: config.configVersion,
        defaultModelKey: defaultModel,
        enabledModelKeys: enabled,
        defaultSystemPrompt: prompt,
        requiredGuardrailKeys,
        defaultToolKeys,
        usdToJpyRate: parsedUsdToJpyRate,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <fieldset className="model-fieldset">
        <legend>利用モデル</legend>
        {MODEL_KEYS.map((key) => (
          <label className="check-row" key={key}>
            <input type="checkbox" checked={enabled.includes(key)} onChange={() => toggleModel(key)} />
            <span>{MODEL_CATALOG[key].label}</span>
          </label>
        ))}
      </fieldset>
      <label className="field-block">
        <span>既定モデル</span>
        <select value={defaultModel} onChange={(event) => setDefaultModel(event.target.value as ModelKey)}>
          {enabled.map((key) => <option key={key} value={key}>{MODEL_CATALOG[key].label}</option>)}
        </select>
      </label>
      <PromptEditor
        label="アプリ既定プロンプト"
        rows={8}
        maxLength={8_000}
        value={prompt}
        onChange={setPrompt}
      />
      <fieldset className="model-fieldset guardrail-fieldset">
        <legend>ツール設定</legend>
        <p className="setting-hint">新しいブラウザセッションで、最初からオンにするツールを選択します。</p>
        {TOOL_KEYS.map((key) => (
          <label className="check-row guardrail-check-row" key={key}>
            <input
              type="checkbox"
              checked={defaultToolKeys.includes(key)}
              onChange={() => toggleTool(key)}
            />
            <span>
              <strong>{TOOL_CATALOG[key].label}</strong>
              <small>{TOOL_CATALOG[key].description} 受講者は後から変更できます。</small>
            </span>
          </label>
        ))}
      </fieldset>
      <label className="field-block">
        <span>USD/JPY換算レート</span>
        <input
          type="number"
          min={MIN_USD_TO_JPY_RATE}
          max={MAX_USD_TO_JPY_RATE}
          step="0.01"
          inputMode="decimal"
          value={usdToJpyRate}
          onChange={(event) => setUsdToJpyRate(event.target.value)}
        />
        <small className="setting-hint">1 USDあたりの日本円。モデル推論料金の概算表示に使用します。</small>
      </label>
      <fieldset className="model-fieldset guardrail-fieldset">
        <legend>必須Guardrail</legend>
        {GUARDRAIL_POLICY_KEYS.map((key) => (
          <label className="check-row guardrail-check-row" key={key}>
            <input
              type="checkbox"
              checked={requiredGuardrailKeys.includes(key)}
              onChange={() => toggleRequiredGuardrail(key)}
            />
            <span>
              <strong>{GUARDRAIL_CATALOG[key].label}</strong>
              <small>{GUARDRAIL_CATALOG[key].description}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="dialog-actions">
        <button type="button" className="secondary-button" onClick={onClose}>キャンセル</button>
        <button type="button" className="primary-button" disabled={saving || !validUsdToJpyRate} onClick={save}>
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </>
  );
}
