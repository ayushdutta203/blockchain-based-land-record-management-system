import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';


const API = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api');
const demoAccounts = [
  { label: 'Authority', email: 'authority@landledger.demo', tone: 'gold', role: 'authority' },
  { label: 'Owner', email: 'ananya.owner@landledger.demo', tone: 'mint', role: 'owner' },
  { label: 'Buyer', email: 'rohan.buyer@landledger.demo', tone: 'blue', role: 'buyer' },
  { label: 'Seller', email: 'meera.seller@landledger.demo', tone: 'rose', role: 'seller' }
];

async function request(path, { token, body, headers = {}, ...options } = {}) {
  const isForm = body instanceof FormData;
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(!isForm && body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || 'Request could not be completed.');
  return data;
}

const shortHash = (hash = '') => hash ? `${hash.slice(0, 10)}...${hash.slice(-6)}` : '—';
const titleCase = (value = '') => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const dateText = (date) => date ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date)) : '—';

function Badge({ value }) { return <span className={`badge ${String(value).toLowerCase()}`}>{titleCase(value)}</span>; }
function Empty({ title, text }) { return <div className="empty"><div className="empty-icon">⌁</div><strong>{title}</strong><span>{text}</span></div>; }
function Toast({ message, kind, onClose }) { if (!message) return null; return <div className={`toast ${kind || ''}`}><span>{kind === 'error' ? '!' : '✓'}</span><p>{message}</p><button onClick={onClose}>×</button></div>; }

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { onLogin(await request('/auth/login', { method: 'POST', body: { email, password } })); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function demoLogin(role) {
    setBusy(true); setError('');
    try { onLogin(await request('/auth/demo-login', { method: 'POST', body: { role } })); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <main className="login-shell">
    <section className="login-aside">
      <div className="brand"><div className="brand-mark">▦</div><span>LandLedger</span></div>
      <div className="login-hero"><p className="eyebrow">ACADEMIC BLOCKCHAIN PROTOTYPE</p><h1>Clear records.<br/><i>Accountable</i> transfers.</h1><p>One secure demonstration workspace for property registration, document integrity, authority review, and ownership history.</p></div>
      <div className="chain-preview"><span>GENESIS</span><b>→</b><span>PROPERTY</span><b>→</b><span>TRANSFER</span><b>→</b><span>VERIFIED</span></div>
      <small>Designed for BTech project demonstration. Not a government registry.</small>
    </section>
    <section className="login-card-wrap"><form className="login-card" onSubmit={submit}>
      <p className="eyebrow">WELCOME BACK</p><h2>Sign in to your portal</h2><p className="muted">Use a demo role below or enter account credentials.</p>
      <label>Email<input type="email" name="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label>Password<input type="password" name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
      {error && <div className="form-error">{error}</div>}
      <button className="primary full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'} <span>→</span></button>
      <div className="demo-divider"><span>demo access</span></div>
      <div className="role-grid">{demoAccounts.map((account) => <button type="button" className={`role-chip ${account.tone}`} key={account.label} onClick={() => demoLogin(account.role)}><b>{account.label}</b><small>{account.email.split('@')[0]}</small></button>)}</div>
    </form></section>
  </main>;
}

function Stat({ label, value, help, icon, tone = '' }) { return <div className={`stat ${tone}`}><div className="stat-icon">{icon}</div><div><span>{label}</span><strong>{value ?? '—'}</strong><small>{help}</small></div></div>; }

function PropertyTable({ properties, onSelect, allowRegister }) {
  return <section className="panel property-panel"><div className="panel-head"><div><p className="eyebrow">PROPERTY REGISTER</p><h2>Properties in view</h2></div>{allowRegister && <button className="primary" onClick={allowRegister}>+ Register property</button>}</div>
    {properties.length ? <div className="table-wrap"><table><thead><tr><th>Parcel & property</th><th>Verified owner</th><th>Land type</th><th>Review state</th><th></th></tr></thead><tbody>{properties.map((property) => <tr key={property.id} onClick={() => onSelect(property)}><td><b>{property.title}</b><small>{property.parcelNumber} · {property.address}</small></td><td>{property.ownerName}</td><td>{property.landType}<small>{property.areaSqm} sq m</small></td><td><Badge value={property.status}/></td><td><button className="row-action">View →</button></td></tr>)}</tbody></table></div> : <Empty title="No properties found" text="Register a property to begin the verification workflow." />}
  </section>;
}

function Dashboard({ user, properties, transfers, analytics, onSelect, onRegister }) {
  const owned = properties.filter((item) => item.ownerId === user.id);
  const pendingTransfers = transfers.filter((item) => ['PROPOSED', 'ACCEPTED'].includes(item.status));
  const authority = ['authority', 'admin'].includes(user.role);
  return <><section className="page-heading"><div><p className="eyebrow">{authority ? 'AUTHORITY COMMAND CENTER' : `${titleCase(user.role)} WORKSPACE`}</p><h1>Good day, {user.name.split(' ')[0]}.</h1><p>Here is the live picture of the prototype land registry.</p></div><div className="ledger-pill"><span className={analytics?.integrity?.valid ? 'ledger-dot healthy' : 'ledger-dot'}></span><div><b>Mock ledger</b><small>{analytics?.integrity?.valid ? `${analytics.integrity.checkedBlocks} blocks verified` : 'Local demo mode'}</small></div></div></section>
    <section className="stats-grid">
      <Stat label={authority ? 'Registered properties' : 'Properties you own'} value={authority ? analytics?.summary?.totalProperties : owned.length} help={authority ? `${analytics?.summary?.approvedProperties || 0} authority-approved` : `${owned.filter((x) => x.status === 'APPROVED').length} verified`} icon="⌂" tone="mint"/>
      <Stat label={authority ? 'Awaiting review' : 'Transfer activity'} value={authority ? analytics?.summary?.pendingApprovals : pendingTransfers.length} help={authority ? 'Require an authority decision' : 'Open proposals in your inbox'} icon="◌" tone="gold"/>
      <Stat label={authority ? 'Integrity flags' : 'Available history'} value={authority ? analytics?.conflicts?.totalFlags : owned.reduce((n, p) => n + (p.documents?.length || 0), 0)} help={authority ? 'Duplicates or claims to inspect' : 'Documents secured off-chain'} icon="◇" tone="rose"/>
      <Stat label="Ledger entries" value={analytics?.summary?.ledgerBlocks || '—'} help="Tamper-evident event chain" icon="↗" tone="blue"/>
    </section>
    <section className="dashboard-grid"><PropertyTable properties={properties.slice(0, 6)} onSelect={onSelect} allowRegister={['owner', 'seller', 'authority', 'admin'].includes(user.role) ? onRegister : null}/><Activity events={analytics?.recentActivity || []}/></section>
  </>;
}

function Activity({ events }) { return <aside className="panel activity"><div className="panel-head"><div><p className="eyebrow">LEDGER ACTIVITY</p><h2>Recent events</h2></div></div>{events.length ? <ol>{events.map((event) => <li key={`${event.id}-${event.blockHash}`}><span className="timeline-dot"></span><div><b>{titleCase(event.action)}</b><p>{event.entityType} #{event.entityId}</p><small>{dateText(event.timestamp)}</small></div></li>)}</ol> : <Empty title="No ledger entries" text="Actions will appear here."/>}</aside>; }

function PropertyDetail({ property, token, onClose, refresh, toast, user }) {
  const [history, setHistory] = useState([]); const [loading, setLoading] = useState(true); const [reviewing, setReviewing] = useState(false); const [reason, setReason] = useState(''); const [uploading, setUploading] = useState(false);
  const authority = ['authority', 'admin'].includes(user.role);
  useEffect(() => { let active = true; request(`/properties/${property.id}/history`, { token }).then((data) => active && setHistory(data.history)).catch((error) => toast(error.message, 'error')).finally(() => active && setLoading(false)); return () => { active = false; }; }, [property.id, token]);
  async function review(decision) { setReviewing(true); try { const data = await request(`/properties/${property.id}/review`, { token, method: 'POST', body: { decision, reason } }); toast(data.message); refresh(); onClose(); } catch (error) { toast(error.message, 'error'); } finally { setReviewing(false); } }
  async function upload(event) { const file = event.target.files?.[0]; if (!file) return; setUploading(true); const form = new FormData(); form.append('document', file); try { const data = await request(`/properties/${property.id}/documents`, { token, method: 'POST', body: form }); toast(`Document secured with SHA-256 ${shortHash(data.document.sha256)}.`); refresh(); } catch (error) { toast(error.message, 'error'); } finally { setUploading(false); event.target.value = ''; } }
  return <div className="drawer-backdrop" onMouseDown={onClose}><aside className="drawer" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-top"><div><p className="eyebrow">PARCEL {property.parcelNumber}</p><h2>{property.title}</h2></div><button className="icon-button" onClick={onClose}>×</button></div><div className="drawer-section key-grid"><div><span>Owner</span><b>{property.ownerName}</b></div><div><span>Review status</span><Badge value={property.status}/></div><div><span>Land classification</span><b>{property.landType}</b></div><div><span>Area</span><b>{property.areaSqm} sq m</b></div></div><div className="drawer-section"><span className="label">Registered location</span><p>{property.address}</p></div>
    <div className="drawer-section"><div className="split-title"><div><span className="label">Off-chain documents</span><p>SHA-256 fingerprints are written to the ledger.</p></div>{(property.ownerId === user.id || authority) && <label className="upload-button">{uploading ? 'Hashing…' : '+ Add document'}<input type="file" onChange={upload} /></label>}</div>{property.documents?.length ? <div className="documents">{property.documents.map((document) => <div className="document" key={document.id}><span className="doc-icon">▤</span><div><b>{document.fileName}</b><small>SHA-256 {shortHash(document.sha256)}</small></div><a href={`${API}/documents/${document.id}/download`} onClick={(event) => { event.preventDefault(); toast('Downloads require the signed API session; use the API route with your token for this prototype.', 'error'); }}>View</a></div>)}</div> : <p className="muted">No document has been uploaded yet.</p>}</div>
    {authority && property.status === 'PENDING' && <div className="review-box"><span className="label">Authority decision</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Optional review note or rejection reason"/><div><button className="secondary danger" disabled={reviewing} onClick={() => review('REJECTED')}>Reject</button><button className="primary" disabled={reviewing} onClick={() => review('APPROVED')}>{reviewing ? 'Saving…' : 'Approve property'}</button></div></div>}
    <div className="drawer-section history"><span className="label">Tamper-evident history</span>{loading ? <p className="muted">Loading history…</p> : history.length ? <ol>{history.map((event) => <li key={`${event.id}-${event.blockHash}`}><span></span><div><b>{titleCase(event.action)}</b><small>{dateText(event.timestamp)} · block {shortHash(event.blockHash)}</small></div></li>)}</ol> : <p className="muted">No events recorded.</p>}</div>
  </aside></div>;
}

function RegisterModal({ token, close, refresh, toast }) {
  const [busy, setBusy] = useState(false); const [form, setForm] = useState({ parcelNumber: '', title: '', address: '', areaSqm: '', landType: 'Residential' }); const [file, setFile] = useState(null);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  async function submit(event) { event.preventDefault(); setBusy(true); const data = new FormData(); Object.entries(form).forEach(([key, value]) => data.append(key, value)); if (file) data.append('document', file); try { const result = await request('/properties', { token, method: 'POST', body: data }); toast(result.message); refresh(); close(); } catch (error) { toast(error.message, 'error'); } finally { setBusy(false); } }
  return <div className="modal-backdrop"><form className="modal" onSubmit={submit}><div className="modal-head"><div><p className="eyebrow">NEW SUBMISSION</p><h2>Register a property</h2></div><button type="button" className="icon-button" onClick={close}>×</button></div><p className="muted">This creates a pending record. It becomes transferable only after authority approval.</p><div className="form-grid"><label>Parcel number<input value={form.parcelNumber} onChange={set('parcelNumber')} placeholder="e.g. KA-BLR-3021" required/></label><label>Land type<select value={form.landType} onChange={set('landType')}><option>Residential</option><option>Commercial</option><option>Agricultural</option><option>Industrial</option></select></label><label className="span-2">Property title<input value={form.title} onChange={set('title')} placeholder="e.g. Sunrise Residential Plot" required/></label><label className="span-2">Registered location<textarea value={form.address} onChange={set('address')} placeholder="Survey number, locality, city" required/></label><label>Area in sq m<input type="number" min="1" value={form.areaSqm} onChange={set('areaSqm')} required/></label><label>Title document <input type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" onChange={(event) => setFile(event.target.files?.[0] || null)}/></label></div><div className="modal-actions"><button type="button" className="secondary" onClick={close}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Securing record…' : 'Submit for review'} →</button></div></form></div>;
}

function Transfers({ token, user, transfers, properties, refresh, toast }) {
  const [showForm, setShowForm] = useState(false); const [propertyId, setPropertyId] = useState(''); const [buyerEmail, setBuyerEmail] = useState(''); const [notes, setNotes] = useState(''); const [busy, setBusy] = useState(false);
  const canCreate = ['owner', 'seller'].includes(user.role); const owned = properties.filter((property) => property.ownerId === user.id && property.status === 'APPROVED');
  async function action(id, action, body = {}) { try { const result = await request(`/transfers/${id}/${action}`, { token, method: 'POST', body }); toast(result.message || `Transfer ${action}ed.`); refresh(); } catch (error) { toast(error.message, 'error'); } }
  async function submit(event) { event.preventDefault(); setBusy(true); try { const result = await request('/transfers', { token, method: 'POST', body: { propertyId, buyerEmail, notes } }); toast(result.message); setShowForm(false); setPropertyId(''); setBuyerEmail(''); setNotes(''); refresh(); } catch (error) { toast(error.message, 'error'); } finally { setBusy(false); } }
  return <><section className="page-heading compact"><div><p className="eyebrow">OWNERSHIP WORKFLOW</p><h1>Property transfers</h1><p>Transfers require seller proposal, buyer acceptance, and authority validation.</p></div>{canCreate && <button className="primary" onClick={() => setShowForm(true)}>+ Propose transfer</button>}</section><section className="panel transfers-panel">{transfers.length ? <div className="transfer-list">{transfers.map((transfer) => <article className="transfer-card" key={transfer.id}><div className="transfer-main"><div className="transfer-badge">⇄</div><div><div className="transfer-title"><h3>{transfer.property?.title || `Property #${transfer.propertyId}`}</h3><Badge value={transfer.status}/></div><p>{transfer.property?.parcelNumber} · {transfer.property?.address}</p><small>From <b>{transfer.seller?.name || 'Seller'}</b> to <b>{transfer.buyer?.name || 'Buyer'}</b> · initiated {dateText(transfer.createdAt)}</small>{transfer.notes && <blockquote>{transfer.notes}</blockquote>}</div></div><div className="transfer-actions">{transfer.status === 'PROPOSED' && transfer.buyerId === user.id && <button className="primary" onClick={() => action(transfer.id, 'accept')}>Accept</button>}{transfer.status === 'ACCEPTED' && ['authority','admin'].includes(user.role) && <button className="primary" onClick={() => action(transfer.id, 'finalize')}>Validate & finalize</button>}{['PROPOSED','ACCEPTED'].includes(transfer.status) && (transfer.buyerId === user.id || ['authority','admin'].includes(user.role)) && <button className="secondary danger" onClick={() => action(transfer.id, 'reject', { reason: 'Rejected through portal.' })}>Reject</button>}</div></article>)}</div> : <Empty title="No transfers in view" text={canCreate ? 'Choose an approved property to start a controlled transfer.' : 'New transfer proposals addressed to you will appear here.'}/>}</section>
  {showForm && <div className="modal-backdrop"><form className="modal transfer-form" onSubmit={submit}><div className="modal-head"><div><p className="eyebrow">NEW WORKFLOW</p><h2>Propose transfer</h2></div><button type="button" className="icon-button" onClick={() => setShowForm(false)}>×</button></div><label>Verified property<select value={propertyId} onChange={(event) => setPropertyId(event.target.value)} required><option value="">Select a property</option>{owned.map((property) => <option key={property.id} value={property.id}>{property.parcelNumber} — {property.title}</option>)}</select></label><label>Registered buyer email<input type="email" value={buyerEmail} onChange={(event) => setBuyerEmail(event.target.value)} placeholder="rohan.buyer@landledger.demo" required/></label><label>Transfer note<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional reference or note for the authority"/></label><p className="info-note">The buyer must accept the proposal before an authority can validate the current owner and finalize the record.</p><div className="modal-actions"><button type="button" className="secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Sending…' : 'Send to buyer'} →</button></div></form></div>}</>;
}

function Authority({ token, properties, analytics, refresh, toast, onSelect }) {
  const pending = properties.filter((property) => property.status === 'PENDING'); const [integrity, setIntegrity] = useState(analytics?.integrity);
  async function verify() { try { const data = await request('/ledger/verify', { token }); setIntegrity(data); toast(data.valid ? `Ledger verified: ${data.checkedBlocks} blocks are intact.` : 'Ledger verification found an issue.', data.valid ? '' : 'error'); } catch (error) { toast(error.message, 'error'); } }
  return <><section className="page-heading compact"><div><p className="eyebrow">AUTHORIZED AUTHORITY PORTAL</p><h1>Review & integrity control</h1><p>Approve valid claims, investigate signals, and maintain the prototype record chain.</p></div><button className="secondary" onClick={verify}>⌁ Verify ledger</button></section><section className="authority-top"><div className="panel integrity-card"><span className={integrity?.valid ? 'big-check healthy' : 'big-check'}>{integrity?.valid ? '✓' : '!'}</span><div><p className="eyebrow">TAMPER CHECK</p><h2>{integrity?.valid ? 'Ledger integrity intact' : 'Verification required'}</h2><p>{integrity?.valid ? `${integrity.checkedBlocks} linked blocks recomputed successfully.` : 'Run a verification to inspect the mock ledger chain.'}</p></div></div><div className="panel flag-card"><span className="flag-count">{analytics?.conflicts?.totalFlags ?? '—'}</span><div><p className="eyebrow">REVIEW SIGNALS</p><h2>Conflict monitor</h2><p>Duplicate parcels, active ownership conflicts, and repeated document fingerprints.</p></div></div></section><section className="authority-grid"><section className="panel"><div className="panel-head"><div><p className="eyebrow">PENDING CLAIMS</p><h2>Awaiting your decision</h2></div><span className="count-chip">{pending.length}</span></div>{pending.length ? <div className="review-list">{pending.map((property) => <button key={property.id} onClick={() => onSelect(property)}><span>⌂</span><div><b>{property.title}</b><small>{property.parcelNumber} · submitted by {property.ownerName}</small></div><Badge value="PENDING"/><i>→</i></button>)}</div> : <Empty title="All caught up" text="There are no pending property claims."/>}</section><section className="panel conflict-panel"><div className="panel-head"><div><p className="eyebrow">ANALYTICS FLAGS</p><h2>Potential conflicts</h2></div></div><ConflictGroup title="Duplicate parcel references" flags={analytics?.conflicts?.duplicateParcels} render={(item) => `${item.parcelNumber} · ${item.propertyIds.length} records`}/><ConflictGroup title="Multiple active owners" flags={analytics?.conflicts?.conflictingOwnership} render={(item) => `${item.parcelNumber} · ${item.ownerNames.join(', ')}`}/><ConflictGroup title="Repeated document hashes" flags={analytics?.conflicts?.duplicateDocuments} render={(item) => `${shortHash(item.sha256)} · ${item.propertyIds.length} properties`}/></section></section></>;
}

function ConflictGroup({ title, flags = [], render }) { return <div className="conflict-group"><span>{title}</span>{flags.length ? flags.map((item, index) => <div className="conflict-item" key={`${title}-${index}`}><i>!</i><p>{render(item)}</p></div>) : <p className="clear-item">No flags detected.</p>}</div>; }

function App() {
  const [session, setSession] = useState(() => { try { return JSON.parse(localStorage.getItem('landledger-session') || 'null'); } catch { return null; } });
  const [page, setPage] = useState('overview'); const [properties, setProperties] = useState([]); const [transfers, setTransfers] = useState([]); const [analytics, setAnalytics] = useState(null); const [selected, setSelected] = useState(null); const [registering, setRegistering] = useState(false); const [notice, setNotice] = useState(null); const [loading, setLoading] = useState(false);
  const user = session?.user; const authority = ['authority', 'admin'].includes(user?.role);
  const toast = (message, kind = '') => { setNotice({ message, kind }); window.setTimeout(() => setNotice(null), 5000); };
  const refresh = async () => { if (!session?.token) return; setLoading(true); try { const [props, txns, stats] = await Promise.all([request('/properties', { token: session.token }), request('/transfers', { token: session.token }), authority ? request('/analytics/overview', { token: session.token }) : Promise.resolve(null)]); setProperties(props.properties); setTransfers(txns.transfers); setAnalytics(stats); } catch (error) { if (/session|Sign in|token/i.test(error.message)) logout(); else toast(error.message, 'error'); } finally { setLoading(false); } };
  useEffect(() => { refresh(); }, [session?.token]);
  function login(data) { localStorage.setItem('landledger-session', JSON.stringify(data)); setSession(data); }
  function logout() { localStorage.removeItem('landledger-session'); setSession(null); setProperties([]); setTransfers([]); setAnalytics(null); }
  const nav = useMemo(() => [{ id: 'overview', label: 'Overview', icon: '⌂' }, { id: 'properties', label: 'Properties', icon: '▦' }, { id: 'transfers', label: 'Transfers', icon: '⇄' }, ...(authority ? [{ id: 'authority', label: 'Authority portal', icon: '◇' }] : [])], [authority]);
  if (!session) return <Login onLogin={login}/>;
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark">▦</div><span>LandLedger</span></div><div className="sidebar-label">WORKSPACE</div><nav>{nav.map((item) => <button className={page === item.id ? 'active' : ''} key={item.id} onClick={() => setPage(item.id)}><i>{item.icon}</i>{item.label}</button>)}</nav><div className="sidebar-spacer"></div><div className="prototype-note"><span>◒</span><p><b>Prototype mode</b>Mock ledger active<br/>No live registry link</p></div><button className="profile" onClick={logout}><span>{user.name.slice(0, 1)}</span><div><b>{user.name}</b><small>{titleCase(user.role)}</small></div><i>↗</i></button></aside><main className="main"><header className="topbar"><div className="mobile-brand">▦ LandLedger</div><div className="prototype-banner">Academic demonstration only - no government integration</div><button className="notification" onClick={() => toast('Notifications are represented by the activity ledger in this prototype.')}>◌<em>{authority ? properties.filter((p) => p.status === 'PENDING').length : transfers.filter((t) => t.status === 'PROPOSED' && t.buyerId === user.id).length}</em></button></header><div className="content">{loading && <div className="loading-line"></div>}{page === 'overview' && <Dashboard user={user} properties={properties} transfers={transfers} analytics={analytics} onSelect={setSelected} onRegister={() => setRegistering(true)}/>} {page === 'properties' && <><section className="page-heading compact"><div><p className="eyebrow">PROPERTY MANAGEMENT</p><h1>Land records</h1><p>Property details, ownership state, document hashes, and event history.</p></div>{['owner','seller','authority','admin'].includes(user.role) && <button className="primary" onClick={() => setRegistering(true)}>+ Register property</button>}</section><PropertyTable properties={properties} onSelect={setSelected}/></>} {page === 'transfers' && <Transfers token={session.token} user={user} transfers={transfers} properties={properties} refresh={refresh} toast={toast}/>} {page === 'authority' && authority && <Authority token={session.token} properties={properties} analytics={analytics} refresh={refresh} toast={toast} onSelect={setSelected}/>}</div></main>{selected && <PropertyDetail property={selected} token={session.token} user={user} onClose={() => setSelected(null)} refresh={refresh} toast={toast}/>} {registering && <RegisterModal token={session.token} close={() => setRegistering(false)} refresh={refresh} toast={toast}/>}<Toast {...notice} onClose={() => setNotice(null)}/></div>;
}

createRoot(document.getElementById('root')).render(<App/>);
