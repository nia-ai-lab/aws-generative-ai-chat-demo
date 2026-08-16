import { useState } from 'react';
import { Dialog } from './Dialog';

interface UserSettingsDialogProps {
  open: boolean;
  value: string;
  onClose: () => void;
  onSave: (value: string) => void;
}

export function UserSettingsDialog({ open, value, onClose, onSave }: UserSettingsDialogProps) {
  const [draft, setDraft] = useState(value);

  function cancel() {
    setDraft(value);
    onClose();
  }

  return (
    <Dialog open={open} title="チャット設定" onClose={cancel}>
      <label className="field-block">
        <span>AIへの追加指示</span>
        <textarea
          rows={7}
          maxLength={4_000}
          placeholder="例: 親しみやすい先生として簡潔に答えてください。"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </label>
      <div className="dialog-actions">
        <button type="button" className="secondary-button" onClick={cancel}>キャンセル</button>
        <button type="button" className="primary-button" onClick={() => onSave(draft)}>適用</button>
      </div>
    </Dialog>
  );
}
