import { useEffect, useState } from 'react';
import { fetchAuthSession, getCurrentUser, signOut } from 'aws-amplify/auth';
import type { PublicConfig } from '../shared/api-schema';
import { ChatScreen } from './components/ChatScreen';
import { LoginScreen } from './components/LoginScreen';
import { ParticipantAccessDisabledScreen } from './components/ParticipantAccessDisabledScreen';
import { getConfig } from './lib/api';
import { clearBrowserSession, resetConversationSessionId } from './lib/session';

type AppState = 'loading' | 'signedOut' | 'signedIn' | 'error';

export function App() {
  const [state, setState] = useState<AppState>('loading');
  const [config, setConfig] = useState<PublicConfig>();
  const [isAdmin, setIsAdmin] = useState(false);
  const participantAccessEnabled = config?.participantAccessEnabled;

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

  useEffect(() => {
    if (state !== 'signedIn') return undefined;
    let active = true;
    const refreshConfig = async () => {
      try {
        const latest = await getConfig();
        if (active) setConfig(latest);
      } catch {
        // Keep the current application state when a background refresh fails.
      }
    };
    const interval = window.setInterval(() => void refreshConfig(), 60_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshConfig();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [state]);

  useEffect(() => {
    if (state === 'signedIn' && !isAdmin && participantAccessEnabled === false) {
      resetConversationSessionId();
    }
  }, [state, participantAccessEnabled, isAdmin]);

  async function handleSignOut() {
    await signOut();
    clearBrowserSession();
    setConfig(undefined);
    setState('signedOut');
  }

  if (state === 'loading') return <div className="app-loading">Generative AI Chat</div>;
  if (state === 'signedOut') return <LoginScreen onSignedIn={loadSignedInApp} />;
  if (state === 'error' || !config) return <div className="app-loading">アプリを読み込めません。</div>;
  if (!isAdmin && !config.participantAccessEnabled) {
    return <ParticipantAccessDisabledScreen onSignOut={handleSignOut} />;
  }

  return <ChatScreen config={config} isAdmin={isAdmin} onConfigChange={setConfig} onSignOut={handleSignOut} />;
}
