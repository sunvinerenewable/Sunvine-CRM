import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  calculateStaffPerformance,
  calculateDealerPerformance
} from '../../utils/performanceAnalytics';

export default function ReportsAnalytics() {
  const { customerFiles, quotations, staffList, dealers } = useApp();

  const [reportType, setReportType] = useState('files'); // 'files', 'quotations', 'staff', 'dealers', 'finance'
  const [selectedStaff, setSelectedStaff] = useState('ALL');
  const [selectedDealer, setSelectedDealer] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedFinance, setSelectedFinance] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL'); // 'ALL', '30D', '90D', 'THIS_MONTH'

  // Filtered Customer Files
  const filteredFiles = useMemo(() => {
    return (customerFiles || []).filter(file => {
      if (selectedStaff !== 'ALL' && file.staffId !== selectedStaff) return false;
      if (selectedDealer !== 'ALL' && file.dealerId !== selectedDealer) return false;
      if (selectedStatus !== 'ALL' && file.status !== selectedStatus) return false;
      if (selectedFinance !== 'ALL' && file.financeType !== selectedFinance) return false;
      return true;
    });
  }, [customerFiles, selectedStaff, selectedDealer, selectedStatus, selectedFinance]);

  // Filtered Quotations
  const filteredQuotations = useMemo(() => {
    return (quotations || []).filter(quote => {
      if (selectedDealer !== 'ALL' && quote.dealerId !== selectedDealer) return false;
      if (selectedStatus !== 'ALL' && quote.status !== selectedStatus) return false;
      return true;
    });
  }, [quotations, selectedDealer, selectedStatus]);

  // Staff Performance Data
  const staffData = useMemo(() => {
    const res = calculateStaffPerformance(staffList, customerFiles, quotations, dealers);
    return Array.isArray(res) ? res : [];
  }, [staffList, customerFiles, quotations, dealers]);

  // Dealer Performance Data
  const dealerData = useMemo(() => {
    const res = calculateDealerPerformance(dealers, customerFiles, quotations);
    return Array.isArray(res) ? res : [];
  }, [dealers, customerFiles, quotations]);

  // CSV Generation Function
  const exportToCsv = () => {
    let headers = [];
    let rows = [];
    let filename = `sunvine_report_${reportType}_${new Date().toISOString().split('T')[0]}.csv`;

    if (reportType === 'files') {
      headers = [
        'File ID',
        'Customer Name',
        'Mobile',
        'City',
        'DISCOM',
        'Consumer Number',
        'System kW',
        'Source Type',
        'Assigned Staff',
        'Dealer Partner',
        'Finance Type',
        'Loan Bank',
        'Contract Value INR',
        'Current Stage',
        'Status',
        'Created Date'
      ];
      rows = filteredFiles.map(f => [
        `"${f.id}"`,
        `"${f.customerName || ''}"`,
        `"${f.phone || ''}"`,
        `"${f.city || 'Gujarat'}"`,
        `"${f.discomCircle || 'UGVCL'}"`,
        `"${f.consumerNumber || ''}"`,
        f.solarSystemKw || 4.4,
        `"${f.sourceType || 'DEALER'}"`,
        `"${f.staffName || ''}"`,
        `"${f.dealerName || ''}"`,
        `"${f.financeType || 'CASH'}"`,
        `"${f.loanBank || 'N/A'}"`,
        f.amount || 240000,
        `"${f.currentStage || ''}"`,
        `"${f.status || ''}"`,
        `"${f.date || ''}"`
      ]);
    } else if (reportType === 'quotations') {
      headers = [
        'Quotation ID',
        'Customer Name',
        'System kW',
        'Dealer Name',
        'Base Price INR',
        'Subsidy INR',
        'Net Payable INR',
        'Status',
        'Generated Date'
      ];
      rows = filteredQuotations.map(q => [
        `"${q.id}"`,
        `"${q.customerName || ''}"`,
        q.systemCapacityKW || 3.3,
        `"${q.dealerFirmName || ''}"`,
        q.totalSystemPrice || 180000,
        q.estimatedSubsidy || 78000,
        q.netPayableAmount || 102000,
        `"${q.status || 'Active'}"`,
        `"${q.date || ''}"`
      ]);
    } else if (reportType === 'staff') {
      headers = [
        'Staff ID',
        'Staff Name',
        'Role',
        'Zone',
        'Phone',
        'Dealers Managed',
        'Direct Files',
        'Dealer Files',
        'Total Files',
        'Pipeline kW',
        'Cash Files',
        'Loan Files',
        'Conversion Rate %'
      ];
      rows = staffData.map(s => [
        `"${s.id}"`,
        `"${s.name}"`,
        `"${s.role}"`,
        `"${s.zone}"`,
        `"${s.phone}"`,
        s.dealersCount,
        s.directFilesCount,
        s.dealerFilesCount,
        s.totalFiles,
        s.pipelineKw,
        s.cashFilesCount,
        s.loanFilesCount,
        `${s.conversionRate}%`
      ]);
    } else if (reportType === 'dealers') {
      headers = [
        'Dealer ID',
        'Firm Name',
        'Contact Person',
        'City',
        'Tier',
        'Assigned Staff',
        'Total Quotes',
        'Customer Files',
        'Capacity kW',
        'Cash Files',
        'Loan Files',
        'Conversion Rate %'
      ];
      rows = dealerData.map(d => [
        `"${d.id}"`,
        `"${d.firmName}"`,
        `"${d.contactPerson}"`,
        `"${d.city}"`,
        `"${d.tier}"`,
        `"${d.assignedStaffName || ''}"`,
        d.quotationsCount,
        d.customerFilesCount,
        d.totalCapacityKw,
        d.cashCount,
        d.loanCount,
        `${d.conversionRate}%`
      ]);
    } else if (reportType === 'finance') {
      headers = [
        'File ID',
        'Customer Name',
        'Finance Mode',
        'Partner Bank',
        'Contract Value INR',
        'Subsidy Eligible INR',
        'Status',
        'Dealer Firm',
        'Sales Staff'
      ];
      rows = filteredFiles.map(f => [
        `"${f.id}"`,
        `"${f.customerName}"`,
        `"${f.financeType || 'CASH'}"`,
        `"${f.loanBank || 'Direct Cash'}"`,
        f.amount || 240000,
        78000,
        `"${f.status}"`,
        `"${f.dealerName || 'Direct Staff'}"`,
        `"${f.staffName}"`
      ]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col w-full gap-6 max-w-7xl mx-auto text-on-surface">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-secondary uppercase tracking-wider">
            <span>Enterprise Reporting Module</span>
            <span>&bull;</span>
            <span className="text-primary font-bold">Standard RFC-4180 CSV</span>
          </div>
          <h1 className="font-['Space_Grotesk'] text-2xl sm:text-3xl font-bold tracking-tight text-on-surface mt-1">
            Data Export &amp; Custom Reports
          </h1>
          <p className="text-xs sm:text-sm text-secondary mt-1">
            Filter and export customer files, quotations, staff output, and cash vs loan portfolios into Excel/CSV.
          </p>
        </div>

        <button
          type="button"
          onClick={exportToCsv}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary-container text-on-primary font-bold text-xs sm:text-sm hover:bg-primary transition-all shadow-sm cursor-pointer min-h-[44px] shrink-0"
        >
          <span className="material-symbols-outlined text-[20px]">download</span>
          <span>Download Filtered CSV</span>
        </button>
      </div>

      {/* Filter Matrix Card */}
      <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-surface-container-high">
          <span className="material-symbols-outlined text-primary text-[20px]">tune</span>
          <h3 className="font-['Space_Grotesk'] font-bold text-sm text-on-surface">
            Report Scope &amp; Multi-Criteria Filters
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* Report Type */}
          <div>
            <label className="block text-secondary font-medium mb-1">Report Dataset</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="files">Customer Files Pipeline</option>
              <option value="quotations">Solar Quotations</option>
              <option value="staff">Sales Staff Matrix</option>
              <option value="dealers">Dealer Network</option>
              <option value="finance">Cash vs Loan Portfolio</option>
            </select>
          </div>

          {/* Staff Filter */}
          <div>
            <label className="block text-secondary font-medium mb-1">Sales Staff</label>
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="ALL">All Staff Members ({staffList?.length || 0})</option>
              {(staffList || []).map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
              ))}
            </select>
          </div>

          {/* Dealer Filter */}
          <div>
            <label className="block text-secondary font-medium mb-1">Dealer Partner</label>
            <select
              value={selectedDealer}
              onChange={(e) => setSelectedDealer(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="ALL">All Dealer Partners ({dealers?.length || 0})</option>
              {(dealers || []).slice(0, 30).map(d => (
                <option key={d.id} value={d.id}>{d.firmName} ({d.city})</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-secondary font-medium mb-1">File Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="In Progress">In Progress</option>
              <option value="Sourced">Sourced</option>
              <option value="Verification">Verification</option>
              <option value="DISCOM Registered">DISCOM Registered</option>
              <option value="Subsidized">Subsidized</option>
              <option value="Completed">Completed</option>
              <option value="Stuck">Stuck</option>
            </select>
          </div>

          {/* Finance Filter */}
          <div>
            <label className="block text-secondary font-medium mb-1">Finance Mode</label>
            <select
              value={selectedFinance}
              onChange={(e) => setSelectedFinance(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="ALL">All Payment Types</option>
              <option value="CASH">Direct Cash / Cheque</option>
              <option value="LOAN">Bank Solar Loan</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Preview */}
      <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">table_chart</span>
            <h3 className="font-['Space_Grotesk'] font-bold text-sm text-on-surface">
              Live Data Preview ({
                reportType === 'files' || reportType === 'finance' ? filteredFiles.length :
                reportType === 'quotations' ? filteredQuotations.length :
                reportType === 'staff' ? staffData.length : dealerData.length
              } Records)
            </h3>
          </div>
          <span className="text-xs text-secondary font-mono">
            Preview limited to 25 items &bull; Export contains full dataset
          </span>
        </div>

        <div className="overflow-x-auto">
          {reportType === 'files' || reportType === 'finance' ? (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-surface-container-high text-secondary">
                  <th className="py-2.5 px-3">File ID</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">City &bull; Circle</th>
                  <th className="py-2.5 px-3">Capacity</th>
                  <th className="py-2.5 px-3">Attribution</th>
                  <th className="py-2.5 px-3">Finance</th>
                  <th className="py-2.5 px-3">Stage</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high/60">
                {filteredFiles.slice(0, 25).map(f => (
                  <tr key={f.id} className="hover:bg-surface-container-low/40">
                    <td className="py-3 px-3 font-mono font-bold text-on-surface">{f.id}</td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-on-surface">{f.customerName}</div>
                      <div className="text-[11px] text-secondary font-mono">{f.phone}</div>
                    </td>
                    <td className="py-3 px-3 text-secondary">{f.city || 'Gujarat'} &bull; {f.discomCircle || 'UGVCL'}</td>
                    <td className="py-3 px-3 font-mono font-bold">{f.solarSystemKw || 4.4} kW</td>
                    <td className="py-3 px-3">
                      <div className="text-on-surface font-medium">{f.staffName || 'Staff'}</div>
                      <div className="text-[10px] text-secondary">{f.dealerName || 'Direct'}</div>
                    </td>
                    <td className="py-3 px-3 font-mono">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        f.financeType === 'LOAN' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {f.financeType || 'CASH'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-secondary truncate max-w-[150px]">{f.currentStage || 'DISCOM'}</td>
                    <td className="py-3 px-3 text-right">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-container-low">
                        {f.status || 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : reportType === 'quotations' ? (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-surface-container-high text-secondary">
                  <th className="py-2.5 px-3">Quote ID</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Capacity</th>
                  <th className="py-2.5 px-3">Dealer</th>
                  <th className="py-2.5 px-3 text-right">Total INR</th>
                  <th className="py-2.5 px-3 text-right">Subsidy INR</th>
                  <th className="py-2.5 px-3 text-right">Net Payable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high/60">
                {filteredQuotations.slice(0, 25).map(q => (
                  <tr key={q.id} className="hover:bg-surface-container-low/40">
                    <td className="py-3 px-3 font-mono font-bold text-on-surface">{q.id}</td>
                    <td className="py-3 px-3 font-bold text-on-surface">{q.customerName}</td>
                    <td className="py-3 px-3 font-mono">{q.systemCapacityKW || 3.3} kW</td>
                    <td className="py-3 px-3 text-secondary">{q.dealerFirmName || 'Sunvine'}</td>
                    <td className="py-3 px-3 text-right font-mono font-semibold">₹ {Number(q.totalSystemPrice || 180000).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-600 font-semibold">₹ {Number(q.estimatedSubsidy || 78000).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-primary">₹ {Number(q.netPayableAmount || 102000).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : reportType === 'staff' ? (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-surface-container-high text-secondary">
                  <th className="py-2.5 px-3">Staff Name</th>
                  <th className="py-2.5 px-3">Zone</th>
                  <th className="py-2.5 px-3 text-center">Dealers</th>
                  <th className="py-2.5 px-3 text-center">Direct Files</th>
                  <th className="py-2.5 px-3 text-center">Dealer Files</th>
                  <th className="py-2.5 px-3 text-center">Total Files</th>
                  <th className="py-2.5 px-3 text-right">Conversion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high/60">
                {staffData.map(s => (
                  <tr key={s.id} className="hover:bg-surface-container-low/40">
                    <td className="py-3 px-3 font-bold text-on-surface">{s.name}</td>
                    <td className="py-3 px-3 text-secondary">{s.zone}</td>
                    <td className="py-3 px-3 text-center font-mono font-bold">{s.dealersCount}</td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-primary">{s.directFilesCount}</td>
                    <td className="py-3 px-3 text-center font-mono font-bold">{s.dealerFilesCount}</td>
                    <td className="py-3 px-3 text-center font-mono font-bold">{s.totalFiles}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-primary">{s.conversionRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-surface-container-high text-secondary">
                  <th className="py-2.5 px-3">Firm Name</th>
                  <th className="py-2.5 px-3">City</th>
                  <th className="py-2.5 px-3">Tier</th>
                  <th className="py-2.5 px-3 text-center">Quotes</th>
                  <th className="py-2.5 px-3 text-center">Files</th>
                  <th className="py-2.5 px-3 text-center">Capacity</th>
                  <th className="py-2.5 px-3 text-right">Conversion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high/60">
                {dealerData.slice(0, 25).map(d => (
                  <tr key={d.id} className="hover:bg-surface-container-low/40">
                    <td className="py-3 px-3 font-bold text-on-surface">{d.firmName}</td>
                    <td className="py-3 px-3 text-secondary">{d.city}</td>
                    <td className="py-3 px-3 font-mono font-semibold">{d.tier}</td>
                    <td className="py-3 px-3 text-center font-mono font-bold">{d.quotationsCount}</td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-primary">{d.customerFilesCount}</td>
                    <td className="py-3 px-3 text-center font-mono font-bold">{(Number(d?.totalCapacityKw) || 0).toFixed(1)} kW</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-primary">{d.conversionRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
