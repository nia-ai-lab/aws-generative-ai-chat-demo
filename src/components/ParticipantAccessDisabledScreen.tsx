interface ParticipantAccessDisabledScreenProps {
  onSignOut: () => Promise<void>;
}

export function ParticipantAccessDisabledScreen({ onSignOut }: ParticipantAccessDisabledScreenProps) {
  return (
    <main className="login-page">
      <section className="access-disabled-card" aria-labelledby="access-disabled-title">
        <div className="brand-mark" aria-hidden="true">AI</div>
        <h1 id="access-disabled-title">Generative AI Chat</h1>
        <p>現在、このアプリは利用できません。</p>
        <button className="secondary-button access-disabled-logout" type="button" onClick={() => void onSignOut()}>
          ログアウト
        </button>
      </section>
    </main>
  );
}
