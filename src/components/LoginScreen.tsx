import { useState, type FormEvent } from 'react';
import { signIn } from 'aws-amplify/auth';

interface LoginScreenProps {
  onSignedIn: () => Promise<void>;
}

export function LoginScreen({ onSignedIn }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await signIn({ username, password });
      if (!result.isSignedIn) {
        throw new Error(`Unsupported sign-in step: ${result.nextStep.signInStep}`);
      }
      await onSignedIn();
    } catch {
      setError('ユーザー名またはパスワードを確認してください。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="brand-mark" aria-hidden="true">AI</div>
        <h1>Generative AI Chat</h1>
        <label>
          <span>ユーザー名</span>
          <input
            autoComplete="username"
            autoCapitalize="none"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </label>
        <label>
          <span>パスワード</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button login-button" type="submit" disabled={busy}>
          {busy ? 'ログイン中...' : 'ログイン'}
        </button>
        <p className="audit-note">会話は監査のため記録されます。</p>
      </form>
    </main>
  );
}
