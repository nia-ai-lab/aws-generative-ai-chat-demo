import { useEffect, useState } from 'react';
import { fetchAuthSession, getCurrentUser, signOut } from 'aws-amplify/auth';
import type { PublicConfig } from '../shared/api-schema';
import { ChatScreen } from './components/ChatScreen';
import { LoginScreen } from './components/LoginScreen';
import { getConfig } from './lib/api';
import { clearBrowserSession } from './lib/session';

type AppState = 'loading' | 'signedOut' | 'signedIn' | 'error';

export function App() {
  const [state, setState] = useState<AppState>('loading');
  const [config, setConfig] = useState<PublicConfig>();
  const [isAdmin, setIsAdmin] = useState(false);

  async function loadSignedInApp() {
    const session = await fetchAuthSession();
    const groups = session.tokens?.accessToken?.payload['cognito:groups'];
    setIsAdmin(Array.isArray(groups) && groups.includes('Admins'));
    setConfig(await getConfig());
    setState('signedIn');
  }

  useEffect(() => {
    void (async () => {
      try {
        await getCurrentUser();
        await loadSignedInApp();
      } catch {
        setState('signedOut');
      }
    })();
  }, []);

  async function handleSignOut() {
    await signOut();
    clearBrowserSession();
    setConfig(undefined);
    setState('signedOut');
  }

  if (state === 'loading') return <div className="app-loading">Generative AI Chat</div>;
  if (state === 'signedOut') return <LoginScreen onSignedIn={loadSignedInApp} />;
  if (state === 'error' || !config) return <div className="app-loading">アプリを読み込めません。</div>;

  return <ChatScreen config={config} isAdmin={isAdmin} onConfigChange={setConfig} onSignOut={handleSignOut} />;
}
