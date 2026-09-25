import { useEffect, useState } from 'react';
import { CreditCard, Database, KeyRound, Sparkles, Workflow } from 'lucide-react';

export default function WorkspaceControlPanel({
  account,
  compact = false,
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState(account.snapshot.workspace.workspaceName);
  const [workspaceSlug, setWorkspaceSlug] = useState(account.snapshot.workspace.workspaceSlug);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setWorkspaceName(account.snapshot.workspace.workspaceName);
    setWorkspaceSlug(account.snapshot.workspace.workspaceSlug);
  }, [account.snapshot.workspace.workspaceName, account.snapshot.workspace.workspaceSlug]);

  const runAction = async (action, successMessage) => {
    setBusy(true);
    try {
      await action();
      if (successMessage) {
        setMessage(successMessage);
      }
    } catch (error) {
      setMessage(error.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const cardStyle = compact
    ? {
        padding: 18,
        borderRadius: 18,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.04)',
      }
    : {
        padding: 24,
        borderRadius: 20,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'linear-gradient(150deg, rgba(0,201,167,0.08), rgba(255,255,255,0.03))',
      };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.42)', textTransform: 'uppercase' }}>
            Workspace control
          </div>
          <h3 style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: compact ? 22 : 28, margin: '10px 0 6px', color: '#fff' }}>
            {account.snapshot.workspace.workspaceName}
          </h3>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, lineHeight: 1.55, color: 'rgba(255,255,255,0.58)', margin: 0, maxWidth: 420 }}>
            {account.hasSupabaseConfig
              ? 'Connect auth, bootstrap the workspace, and keep the Atom Builder scoped to a real customer account.'
              : 'Add Supabase keys to move Ascentra from preview mode into a real multi-user workspace.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {[
            ['Mode', account.snapshot.mode === 'supabase' ? 'Live' : 'Preview'],
            ['Plan', account.snapshot.workspace.plan.label],
            ['Tasks', `${account.snapshot.workspace.usage.tasksUsed}/${account.snapshot.workspace.usage.tasksLimit}`],
          ].map(([label, value]) => (
            <div key={label} style={{ padding: '10px 12px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(6,10,18,0.45)', minWidth: 90 }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' }}>{label}</div>
              <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 15, color: '#fff', marginTop: 4 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: compact ? 'repeat(auto-fit,minmax(140px,1fr))' : 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 18 }}>
        {[
          ['Database', account.snapshot.workspace.setup.database, Database],
          ['Auth', account.snapshot.workspace.setup.auth, KeyRound],
          ['Billing', account.snapshot.workspace.setup.billing, CreditCard],
          ['Automations', account.snapshot.workspace.setup.automations, Workflow],
          ['Make', account.snapshot.workspace.setup.make, Sparkles],
        ].map(([label, value, Icon]) => (
          <div key={label} style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff' }}>
              <Icon size={14} />
              <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 14 }}>{label}</span>
            </div>
            <div style={{ marginTop: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: value === 'ready' ? '#7ff7d7' : value === 'pending' || value === 'preview' ? '#f3d57c' : 'rgba(255,255,255,0.42)' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {!account.hasSupabaseConfig ? (
        <p style={{ marginTop: 18, fontFamily: 'Manrope, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.52)' }}>
          Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env.local</code> to enable account sign-in and live workspace saves.
        </p>
      ) : account.authLoading ? (
        <p style={{ marginTop: 18, fontFamily: 'Manrope, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.52)' }}>
          Checking current session…
        </p>
      ) : !account.user ? (
        <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: compact ? '1fr' : 'repeat(2, minmax(0, 1fr))' }}>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '12px 14px', outline: 'none' }}
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '12px 14px', outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction(() => account.signIn({ email, password }), 'Signed in. You can bootstrap the workspace now.')}
              style={{ padding: '11px 18px', borderRadius: 12, border: 'none', background: '#00C9A7', color: '#000', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}
            >
              Sign in
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction(() => account.signUp({ email, password }), 'Account created. Confirm email if your project requires it.')}
              style={{ padding: '11px 18px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}
            >
              Sign up
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
          <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.62)' }}>
            Signed in as <strong style={{ color: '#fff' }}>{account.user.email}</strong>
          </div>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: compact ? '1fr' : 'repeat(2, minmax(0, 1fr))' }}>
            <input
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              placeholder="Workspace name"
              style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '12px 14px', outline: 'none' }}
            />
            <input
              value={workspaceSlug}
              onChange={(event) => setWorkspaceSlug(event.target.value)}
              placeholder="Workspace slug"
              style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '12px 14px', outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction(() => account.bootstrap({ workspaceName, workspaceSlug }), account.snapshot.mode === 'supabase' ? 'Workspace refreshed from Supabase.' : 'Workspace bootstrapped in Supabase.')}
              style={{ padding: '11px 18px', borderRadius: 12, border: 'none', background: '#00C9A7', color: '#000', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}
            >
              {account.snapshot.mode === 'supabase' ? 'Refresh workspace' : 'Create workspace'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction(() => account.reload(), 'Workspace snapshot refreshed.')}
              style={{ padding: '11px 18px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}
            >
              Refresh state
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction(() => account.signOut(), 'Signed out.')}
              style={{ padding: '11px 18px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}
            >
              Sign out
            </button>
          </div>
        </div>
      )}

      {message || account.error || account.snapshot.warnings?.[0] ? (
        <div style={{ marginTop: 14, fontFamily: 'Manrope, sans-serif', fontSize: 13, color: '#f4efcf' }}>
          {message || account.error || account.snapshot.warnings?.[0]}
        </div>
      ) : null}
    </div>
  );
}
