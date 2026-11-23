import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ResidentialPackagePricing } from '../DealerPortal/PDFTemplate';
import QuotationPreview from '../DealerPortal/QuotationPreview';

const amountFields = {
  adani_price: 'Adani price',
  waaree_price: 'Waaree price',
  central_subsidy: 'Central subsidy',
  general_subsidy: 'Gujarat subsidy · General / OBC',
  sc_st_subsidy: 'Gujarat subsidy · SC / ST'
};
const customerFields = { customer_name: 'Customer name', phone: 'Mobile', address: 'Address', city: 'City' };
const emptyCustomer = { customer_name: '', phone: '', address: '', city: '', category: '' };
const fieldStyle = 'mt-1 min-h-11 w-full min-w-0 rounded-lg border border-surface-container-high bg-surface-container-lowest px-3 py-2 text-sm text-on-surface shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';
const buttonStyle = 'min-h-11 cursor-pointer rounded-lg bg-primary px-4 text-sm font-bold text-on-primary hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50';
const cardStyle = 'min-w-0 rounded-xl border border-surface-container-high bg-surface-container-lowest p-4 shadow-sm sm:p-5 md:p-6';

function CardHeading({ icon, title, description }) {
  return (
    <div className="mb-4 flex items-center gap-2.5 border-b border-surface-container-high/60 pb-4">
      <span aria-hidden="true" className="material-symbols-outlined flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container text-[20px] text-secondary">{icon}</span>
      <div className="min-w-0">
        <h2 className="text-base font-bold leading-tight text-on-secondary-fixed">{title}</h2>
        {description && <p className="text-xs text-secondary">{description}</p>}
      </div>
    </div>
  );
}

async function request(action, data) {
  const token = sessionStorage.getItem('sunvine_session_token');
  const auth = token ? { Authorization: 'Bearer ' + token } : {};
  const response = await fetch(data ? '/api/quotations' : '/api/quotations?action=' + action, data ? {
    method: 'POST',
    credentials: 'include',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...data })
  } : { credentials: 'include', cache: 'no-store', headers: auth });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Package request failed.');
  return result;
}

export default function ResidentialPackageQuotes() {
  const { customerFiles = [], setActiveTab } = useApp();
  const [settings, setSettings] = useState(null);
  const [quote, setQuote] = useState(null);
  const [discount, setDiscount] = useState('');
  const [customer, setCustomer] = useState(emptyCustomer);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [settingsDraft, setSettingsDraft] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const requestId = useRef(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    let active = true;
    setError('');
    request('package-list').then(result => {
      if (!active) return;
      setSettings(result.settings);
    }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [retry]);

  async function run(operation) {
    setBusy(true);
    setError('');
    setNotice('');
    try { await operation(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  function selectCustomer(id) {
    setSelectedCustomer(id);
    requestId.current = null;
    const file = customerFiles.find(item => item.id === id);
    setCustomer(current => ({
      ...(file ? {
        customer_name: file.customerName || '', phone: file.phone || '', address: file.address || '', city: file.city || ''
      } : emptyCustomer),
      category: current.category
    }));
  }

  function createQuote(event) {
    event.preventDefault();
    requestId.current ||= crypto.randomUUID();
    return run(async () => {
      const result = await request('package-create', { ...customer, id: requestId.current, discount: Number(discount) });
      setQuote(result.quote);
      setShowPreview(true);
      setNotice('Package quotation saved.');
      requestId.current = null;
    });
  }

  function saveSettings(event) {
    event.preventDefault();
    return run(async () => {
      const amounts = Object.fromEntries(Object.keys(amountFields).map(field => [field, Number(settingsDraft[field])]));
      const result = await request('package-settings', amounts);
      setSettings(result.settings);
      setSettingsDraft(result.settings);
      setNotice('Package settings saved.');
    });
  }

  if (showPreview && quote) {
    return <QuotationPreview onBack={() => setShowPreview(false)} quotation={{
            id: 'SV-PKG-' + quote.id.slice(0, 8).toUpperCase(),
            date: new Date(quote.created_at).toLocaleDateString('en-IN'),
            customerName: quote.customer_name, customerPhone: quote.phone,
            location: quote.address + ', ' + quote.city, city: quote.city,
            systemCapacityKW: 2.18, moduleCount: 4, moduleWattage: 545, inverterCapacity: '2.2 kW', selectedModuleMake: 'Adani / Waaree',
            projectType: 'Residential', inverterType: '2.2 kW single-phase grid-tied',
            residentialPackage: quote
          }} />;
  }

  return (
    <section className="w-full min-w-0 space-y-6 text-on-surface">
      <header className="space-y-1">
        <button type="button" onClick={() => setActiveTab('admin_dashboard')} className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-secondary hover:text-on-surface">
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to Overview
        </button>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl">2.18 kW Package Quote</h1>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-[#101a2b] p-4 text-white shadow-md">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="material-symbols-outlined flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#6CBF3D]/30 bg-[#6CBF3D]/15 text-[#6CBF3D]">solar_power</span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-[#6CBF3D]">Sunvine Admin Console</p>
            <p className="mt-1 text-xs text-slate-200">Residential package with fixed, GST-inclusive pricing.</p>
          </div>
        </div>
        <button type="button" className="min-h-11 cursor-pointer rounded-lg border border-slate-600 px-4 text-sm font-semibold hover:bg-white/10 disabled:opacity-50" disabled={!settings || busy} onClick={() => setSettingsDraft(settingsDraft ? null : settings)}>
          {settingsDraft ? 'Back to quotations' : 'Package Settings'}
        </button>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {!settings && (error
        ? <button className={buttonStyle} onClick={() => setRetry(value => value + 1)}>Retry</button>
        : <p role="status">Loading package data…</p>)}

      {settings && (settingsDraft ? (
        <section className={cardStyle}>
          <CardHeading icon="tune" title="Package Settings" />
          <form onSubmit={saveSettings} className="grid gap-4 sm:grid-cols-2">
            {Object.entries(amountFields).map(([field, label]) => (
              <label className="text-sm font-semibold" key={field}>{label}
                <input className={fieldStyle} type="number" min={field.endsWith('price') ? 1 : 0} max={100000000} step="1" required
                  value={settingsDraft[field]} onChange={event => setSettingsDraft({ ...settingsDraft, [field]: event.target.value })} />
              </label>
            ))}
            <div className="sm:col-span-2"><button className={buttonStyle} disabled={busy}>Save Settings</button></div>
          </form>
        </section>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-12">
          <form id="residential-package-form" onSubmit={createQuote} className="min-w-0 space-y-6 xl:col-span-7">
            <section className={cardStyle}>
              <CardHeading icon="person" title="Customer Details" description="Customer contact and installation address" />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold sm:col-span-2">Customer
                  <select className={fieldStyle} value={selectedCustomer} onChange={event => selectCustomer(event.target.value)}>
                    <option value="">New enquiry</option>
                    {customerFiles.filter(file => !file.isDeleted).map(file => (
                      <option key={file.id} value={file.id}>{file.customerName} · {file.phone}</option>
                    ))}
                  </select>
                </label>
                {Object.entries(customerFields).map(([field, label]) => (
                  <label key={field} className={field === 'customer_name' || field === 'address' ? 'text-sm font-semibold sm:col-span-2' : 'text-sm font-semibold'}>
                    {label} <span className="text-red-700">*</span>
                    <input className={fieldStyle} required type={field === 'phone' ? 'tel' : 'text'} value={customer[field]}
                      maxLength={{ customer_name: 255, phone: 20, address: 500, city: 100 }[field]}
                      onChange={event => {
                        requestId.current = null;
                        setCustomer({ ...customer, [field]: event.target.value });
                      }} />
                  </label>
                ))}
              </div>
            </section>
            <section className={cardStyle}>
              <CardHeading icon="solar_power" title="System Details" description="Fixed hardware configuration for this package" />
              <dl className="grid grid-cols-2 gap-4 rounded-lg bg-surface-container-low p-4 text-sm">
                <div><dt className="text-secondary">System capacity</dt><dd className="font-bold">2.18 kW</dd></div>
                <div><dt className="text-secondary">Panel brands</dt><dd className="font-bold">Adani / Waaree</dd></div>
                <div><dt className="text-secondary">Solar panels</dt><dd className="font-bold">4 × 545 Wp</dd></div>
                <div><dt className="text-secondary">Inverter</dt><dd className="font-bold">2.2 kW single-phase</dd></div>
              </dl>
            </section>
            <button className={buttonStyle} disabled={busy}>Save Package Quote</button>
          </form>

          <div className="min-w-0 space-y-6 xl:col-span-5">
            <section className={cardStyle}>
              <CardHeading icon="calculate" title="Pricing & Subsidy" description="Compare Adani and Waaree offers" />
              <label className="block text-sm font-semibold">Subsidy category <span className="text-red-700">*</span>
                <select form="residential-package-form" className={fieldStyle} required value={customer.category} onChange={event => {
                  requestId.current = null;
                  setCustomer({ ...customer, category: event.target.value });
                }}>
                  <option value="">Select category</option>
                  <option>General / OBC</option>
                  <option>SC / ST</option>
                </select>
              </label>
              <label className="mt-4 block text-sm font-semibold">Discount (₹)
                <input form="residential-package-form" className={fieldStyle} type="number" min="0" max={Math.min(settings.adani_price, settings.waaree_price) - settings.central_subsidy - (customer.category === 'SC / ST' ? settings.sc_st_subsidy : settings.general_subsidy)} step="1" placeholder="0"
                  value={discount} onChange={event => {
                    requestId.current = null;
                    setDiscount(event.target.value);
                  }} />
              </label>
              <div className="mt-4 rounded-xl border border-[#6CBF3D] bg-emerald-50 px-3 text-slate-900">
                {customer.category
                  ? <ResidentialPackagePricing quote={{ category: customer.category, snapshot: { ...settings, discount: Number(discount) } }} />
                  : <p className="py-4 text-sm">Select a category to see the subsidy and estimated net cost for both brands.</p>}
              </div>
            </section>


          </div>
        </div>
      ))}
    </section>
  );
}
