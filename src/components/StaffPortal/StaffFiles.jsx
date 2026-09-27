import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../Shared/Toast';

export default function StaffFiles() {
  const { currentStaff, customerFiles, updateFileStatus, updateCustomerFile } = useApp();
  const { addToast } = useToast();

  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFileForDocs, setSelectedFileForDocs] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);

  // Filter strictly for THIS logged-in staff member
  const myFiles = (customerFiles || []).filter(
    (f) => f.staffId === currentStaff?.id || f.staffName === currentStaff?.name
  );

  const filteredFiles = myFiles.filter((f) => {
    const term = searchTerm.toLowerCase().trim();
    const matchSearch =
      !term ||
      f.customerName.toLowerCase().includes(term) ||
      (f.consumerNo || '').toLowerCase().includes(term) ||
      f.phone.includes(term) ||
      f.id.toLowerCase().includes(term);

    const matchStatus = statusFilter === 'all' || f.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleUploadDoc = (fileId, docKey, filename = 'document.pdf') => {
    const file = myFiles.find(f => f.id === fileId);
    if (!file) return;

    const updatedDocs = {
      ...file.documents,
      [docKey]: {
        uploaded: true,
        filename: filename || `${docKey}_uploaded.pdf`,
        date: new Date().toISOString().split('T')[0]
      }
    };

    updateCustomerFile(fileId, { documents: updatedDocs });

    if (selectedFileForDocs && selectedFileForDocs.id === fileId) {
      setSelectedFileForDocs(prev => ({ ...prev, documents: updatedDocs }));
    }

    addToast(`Document uploaded: ${docKey} (Optional)`, 'success');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-container-high pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[24px]">folder_shared</span>
            <span>My Customer Files &amp; Subsidies</span>
          </h1>
          <p className="text-xs text-secondary mt-1">
            Track customer stages from lead sourcing to DBT subsidy clearance. Document upload is completely optional!
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-xs text-secondary">
          <span className="font-semibold text-primary">{filteredFiles.length}</span> of {myFiles.length} Total Files
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface p-3 sm:p-4 rounded-xl border border-surface-container-high shadow-xs">
        {/* Stage Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { key: 'all', label: 'All Files' },
            { key: 'Sourced', label: 'Sourced' },
            { key: 'Verification', label: 'Verification' },
            { key: 'DISCOM Registered', label: 'DISCOM Reg.' },
            { key: 'Subsidized', label: 'Subsidized' }
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setStatusFilter(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === t.key
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'bg-surface-container-low text-secondary hover:text-on-surface'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <span className="material-symbols-outlined absolute left-2.5 top-2 text-[16px] text-secondary">search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search name, phone, consumer no..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-surface-container-high bg-surface-container-lowest focus:border-primary outline-none"
          />
        </div>
      </div>

      {/* Files Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredFiles.map((file) => {
          const docsCount = Object.values(file.documents || {}).filter((d) => d.uploaded).length;
          const statusColors = {
            'Sourced': 'bg-amber-100 text-amber-800 border-amber-200',
            'Verification': 'bg-blue-100 text-blue-800 border-blue-200',
            'DISCOM Registered': 'bg-purple-100 text-purple-800 border-purple-200',
            'Subsidized': 'bg-emerald-100 text-emerald-800 border-emerald-200'
          };

          return (
            <div
              key={file.id}
              className="bg-surface rounded-xl p-5 border border-surface-container-high shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-mono font-bold text-secondary">{file.id}</span>
                    <h3 className="text-base font-bold text-on-surface hover:text-primary transition-colors">
                      {file.customerName}
                    </h3>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${statusColors[file.status]}`}>
                    {file.status}
                  </span>
                </div>

                {/* Key Specs */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-surface-container-low p-2 rounded-lg">
                    <span className="text-[10px] text-secondary block">Connection / DISCOM</span>
                    <span className="font-bold text-on-surface">{file.discom}</span>
                    <span className="text-[11px] text-secondary block truncate">{file.consumerNo || 'No Consumer No'}</span>
                  </div>
                  <div className="bg-surface-container-low p-2 rounded-lg">
                    <span className="text-[10px] text-secondary block">System Capacity</span>
                    <span className="font-bold text-emerald-600">{file.solarSystemKw} kW Solar</span>
                    <span className="text-[11px] text-secondary block">{file.sanctionedLoadKw} kW Load</span>
                  </div>
                </div>

                {/* Contact & Location */}
                <div className="mt-3 space-y-1.5 text-xs text-secondary">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-primary">call</span>
                    <a href={`tel:${file.phone}`} className="hover:underline text-on-surface font-semibold">
                      {file.phone}
                    </a>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="material-symbols-outlined text-[15px] text-secondary">location_on</span>
                    <span className="truncate">{file.address}</span>
                  </div>
                  {file.notes && (
                    <div className="p-2 rounded bg-amber-50/70 border border-amber-200/50 text-amber-900 text-[11px] mt-2">
                      <strong>Note:</strong> {file.notes}
                    </div>
                  )}
                </div>

                {/* Document Status - Explicitly marked Optional */}
                <div className="mt-4 pt-3 border-t border-surface-container-high">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-secondary font-medium">Documents (Optional)</span>
                    <span className="text-emerald-700 font-bold text-[11px]">{docsCount} / 5 Attached</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1 text-center">
                    {[
                      { key: 'aadhaar', label: 'Aadhaar' },
                      { key: 'lightBill', label: 'Bill' },
                      { key: 'meterPhoto', label: 'Meter' },
                      { key: 'sitePhoto', label: 'Site' },
                      { key: 'bankPassbook', label: 'Bank' }
                    ].map((doc) => {
                      const isUp = file.documents?.[doc.key]?.uploaded;
                      return (
                        <div
                          key={doc.key}
                          title={`${doc.label}: ${isUp ? 'Uploaded' : 'Optional / Not uploaded'}`}
                          className={`py-1 rounded text-[10px] font-semibold border ${
                            isUp
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                              : 'bg-surface-container-low border-surface-container-high text-secondary/60'
                          }`}
                        >
                          {doc.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-surface-container-high flex items-center justify-between gap-2">
                <button
                  onClick={() => setSelectedFileForDocs(file)}
                  className="flex-1 py-1.5 px-2 bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px] text-primary">upload_file</span>
                  <span>Docs (Optional)</span>
                </button>

                <select
                  value={file.status}
                  onChange={(e) => {
                    updateFileStatus(file.id, e.target.value);
                    addToast(`Updated ${file.customerName} status to "${e.target.value}"`, 'success');
                  }}
                  className="px-2 py-1.5 rounded-lg border border-surface-container-high bg-surface-container-lowest text-xs font-bold text-on-surface focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="Sourced">Sourced</option>
                  <option value="Verification">Verification</option>
                  <option value="DISCOM Registered">DISCOM Reg.</option>
                  <option value="Subsidized">Subsidized</option>
                </select>

                <a
                  href={`https://wa.me/${file.phone.replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(file.customerName)},%20I%20am%20${encodeURIComponent(currentStaff?.name || 'Sunvine Solar Officer')}%20from%20Sunvine%20Renewable%20regarding%20your%20${file.solarSystemKw}kW%20rooftop%20solar%20file.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 rounded-lg transition-colors"
                  title="WhatsApp"
                >
                  <span className="material-symbols-outlined text-[17px]">chat</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {filteredFiles.length === 0 && (
        <div className="bg-surface rounded-xl p-12 text-center border border-surface-container-high text-secondary">
          <span className="material-symbols-outlined text-4xl text-secondary/40 mb-2">folder_off</span>
          <p className="text-sm">No customer files match your search criteria.</p>
        </div>
      )}

      {/* OPTIONAL DOCUMENT VAULT MODAL */}
      {selectedFileForDocs && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-container-high rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-surface-container-high pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-primary">{selectedFileForDocs.id}</span>
                <h3 className="text-lg font-bold text-on-surface">
                  {selectedFileForDocs.customerName} - Document Vault
                </h3>
                <p className="text-xs text-secondary">
                  Note: Uploading documents is <strong>completely optional</strong>. You can proceed without any documents.
                </p>
              </div>
              <button
                onClick={() => setSelectedFileForDocs(null)}
                className="text-secondary hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: 'aadhaar', label: 'Aadhaar Card' },
                { key: 'lightBill', label: 'Electricity / Light Bill' },
                { key: 'meterPhoto', label: 'Electricity Meter Photo' },
                { key: 'sitePhoto', label: 'Rooftop / Site Photo' },
                { key: 'bankPassbook', label: 'Bank Passbook / Cheque' }
              ].map((doc) => {
                const isUp = selectedFileForDocs.documents?.[doc.key]?.uploaded;
                const dData = selectedFileForDocs.documents?.[doc.key];

                return (
                  <div
                    key={doc.key}
                    className={`p-3 rounded-xl border flex flex-col justify-between ${
                      isUp ? 'bg-emerald-50/50 border-emerald-300' : 'bg-surface-container-low border-surface-container-high'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-on-surface">{doc.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                          isUp ? 'bg-emerald-200 text-emerald-800' : 'bg-surface-container text-secondary'
                        }`}>
                          {isUp ? 'Uploaded' : 'Optional'}
                        </span>
                      </div>
                      {isUp && (
                        <p className="text-[11px] text-secondary mt-1 truncate">{dData?.filename}</p>
                      )}
                    </div>

                    <div className="mt-3 pt-2 border-t border-surface-container-high/60 flex items-center justify-between">
                      {isUp ? (
                        <button
                          onClick={() => setPreviewDoc({ title: doc.label, ...dData })}
                          className="text-xs text-primary font-semibold hover:underline"
                        >
                          View Preview
                        </button>
                      ) : (
                        <label className="text-xs text-primary font-semibold hover:underline cursor-pointer flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">upload</span>
                          <span>Upload (Optional)</span>
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUploadDoc(selectedFileForDocs.id, doc.key, f.name);
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-3 border-t border-surface-container-high">
              <button
                onClick={() => setSelectedFileForDocs(null)}
                className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-lg cursor-pointer"
              >
                Close Vault
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT PREVIEW MODAL */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-2">
              <h4 className="font-bold text-sm text-on-surface">{previewDoc.title}</h4>
              <button onClick={() => setPreviewDoc(null)} className="text-secondary hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 bg-surface-container-low rounded-xl text-center space-y-2">
              <span className="material-symbols-outlined text-4xl text-emerald-600">verified</span>
              <p className="text-xs font-bold text-on-surface">{previewDoc.filename}</p>
              <p className="text-[11px] text-secondary">Verified Document on Sunvine Secure Vault</p>
            </div>
            <button
              onClick={() => setPreviewDoc(null)}
              className="w-full py-2 bg-primary text-on-primary rounded-lg text-xs font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
