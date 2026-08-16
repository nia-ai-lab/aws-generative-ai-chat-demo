import { useState } from 'react';
import type { AdminConfig, UpdateAdminConfig } from '../../shared/api-schema';
import { MODEL_CATALOG, MODEL_KEYS, type ModelKey } from '../../shared/model-catalog';
import { Dialog } from './Dialog';

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
  const [saving, setSaving] = useState(false);

  function toggleModel(key: ModelKey) {
    setEnabled((current) => {
      if (current.includes(key)) {
        if (current.length === 1 || key === defaultModel) return current;
        return current.filter((item) => item !== key);
      }
      return [...current, key];
    });
  }

  async function save() {
    setSaving(true);
    try {
      await onSave({
        expectedConfigVersion: config.configVersion,
        defaultModelKey: defaultModel,
        enabledModelKeys: enabled,
        defaultSystemPrompt: prompt,
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
      <label className="field-block">
        <span>アプリ既定プロンプト</span>
        <textarea rows={8} maxLength={8_000} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
      </label>
      <div className="dialog-actions">
        <button type="button" className="secondary-button" onClick={onClose}>キャンセル</button>
        <button type="button" className="primary-button" disabled={saving || !prompt.trim()} onClick={save}>
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </>
  );
}
