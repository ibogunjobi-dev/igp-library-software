// Settings — loan period, renewal length, firm name and toggles.
import { useEffect, useState } from 'react';
import { getSettings, saveSettings } from '../../lib/settings';
import { FIRM_NAME } from '../../lib/constants';
import Spinner from '../../components/Spinner';

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try { setSettings(await getSettings()); }
      catch (err) { setError(err.message || 'Failed to load settings.'); }
    })();
  }, []);

  function set(field, value) {
    setSettings((s) => ({ ...s, [field]: value }));
    setSaved(false);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await saveSettings({
        // The firm name is fixed by policy and not editable from the UI.
        firmName: FIRM_NAME,
        loanPeriodDays: Math.max(1, parseInt(settings.loanPeriodDays, 10) || 14),
        renewalLengthDays: Math.max(1, parseInt(settings.renewalLengthDays, 10) || 14),
        allowRenewals: !!settings.allowRenewals,
      });
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  if (error && !settings) return <div className="alert alert--error">{error}</div>;
  if (!settings) return <Spinner center />;

  return (
    <>
      <div className="page-head"><h1>Settings</h1></div>
      {error && <div className="alert alert--error">{error}</div>}
      {saved && <div className="alert alert--ok">Settings saved.</div>}

      <form className="panel" onSubmit={onSubmit}>
        <div className="form-grid">
          <div className="field">
            <label>Firm name</label>
            <input value={FIRM_NAME} readOnly disabled />
            <span className="field__hint">Fixed by firm policy and used across the system and exports.</span>
          </div>
          <div className="field">
            <label>Default loan period (days)</label>
            <input type="number" min="1" value={settings.loanPeriodDays}
              onChange={(e) => set('loanPeriodDays', e.target.value)} />
          </div>
          <div className="field">
            <label>Default renewal length (days)</label>
            <input type="number" min="1" value={settings.renewalLengthDays}
              onChange={(e) => set('renewalLengthDays', e.target.value)} />
          </div>
          <div className="field">
            <label>Renewals</label>
            <label className="row" style={{ cursor: 'pointer' }}>
              <input type="checkbox" style={{ width: 'auto' }}
                checked={!!settings.allowRenewals}
                onChange={(e) => set('allowRenewals', e.target.checked)} />
              <span>Allow loans to be renewed</span>
            </label>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
        </div>
      </form>
    </>
  );
}
