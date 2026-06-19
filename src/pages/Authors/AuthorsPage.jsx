// Authors maintenance — list distinct authors and merge similar names into one
// canonical spelling across the whole catalogue.
import { useEffect, useState } from 'react';
import { getAuthors, mergeAuthors } from '../../lib/catalogue';
import { norm } from '../../lib/format';
import Spinner from '../../components/Spinner';
import DataTable from '../../components/DataTable';

export default function AuthorsPage() {
  const [authors, setAuthors] = useState(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState({});
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try { setAuthors(await getAuthors()); }
    catch (err) { setError(err.message || 'Failed to load authors.'); }
  }
  useEffect(() => { load(); }, []);

  if (error && !authors) return <div className="alert alert--error">{error}</div>;
  if (!authors) return <Spinner center />;

  const term = norm(q);
  const filtered = term ? authors.filter((a) => norm(a.name).includes(term)) : authors;
  const selectedNames = Object.keys(selected).filter((n) => selected[n]);

  function toggle(name, on) {
    setSelected((s) => ({ ...s, [name]: on }));
    // Default the canonical target to the first one picked.
    if (on && !target) setTarget(name);
  }

  async function doMerge() {
    const to = target.trim();
    if (!to || selectedNames.length === 0) return;
    setBusy(true);
    setError(''); setInfo('');
    try {
      const res = await mergeAuthors(selectedNames, to);
      setInfo(`Merged into “${to}” — ${res.changed} record(s) updated.`);
      setSelected({});
      setTarget('');
      await load();
    } catch (err) {
      setError(err.message || 'Merge failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <span className="page-head__sub">Legal &amp; Knowledge Resources Centre</span>
          <h1>Authors</h1>
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {info && <div className="alert alert--ok">{info}</div>}

      <div className="panel">
        <p className="text-small muted">
          Tick the variant spellings of one author, set the correct name, and merge —
          every catalogue record using a ticked name is updated to the chosen name.
        </p>
        <div className="toolbar">
          <div className="field toolbar__search">
            <label>Find author</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type to filter names…" />
          </div>
          <div className="field">
            <label>Merge into (correct name)</label>
            <input value={target} onChange={(e) => setTarget(e.target.value)} list="author-merge-options" placeholder="Canonical name" />
            <datalist id="author-merge-options">
              {selectedNames.map((n) => <option key={n} value={n} />)}
            </datalist>
          </div>
          <button className="btn" disabled={busy || !target.trim() || selectedNames.length === 0} onClick={doMerge}>
            Merge {selectedNames.length || ''} selected
          </button>
        </div>

        <DataTable
          rows={filtered}
          pageSize={10}
          getRowKey={(a) => a.name}
          initialSort={{ key: 'name', dir: 'asc' }}
          emptyMessage="No authors match."
          columns={[
            { key: 'select', label: '', render: (a) => (
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={!!selected[a.name]}
                onChange={(e) => toggle(a.name, e.target.checked)}
              />
            ) },
            { key: 'name', label: 'Author', sortable: true },
            { key: 'count', label: 'Records', align: 'right', sortable: true },
          ]}
        />
      </div>
    </>
  );
}
