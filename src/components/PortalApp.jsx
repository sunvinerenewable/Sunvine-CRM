import React, { useState, Suspense, lazy } from 'react';
import { AppProvider, useApp } from '../context/AppContext';
import Navigation from './Navigation';
import ViewSkeleton from './Shared/ViewSkeleton';

import SplashScreen from './SplashScreen';
import AppUpdateModal from './Shared/AppUpdateModal';
import UpdateNotificationPopup from './Shared/UpdateNotificationPopup';
import NetworkStatusBanner from './Shared/NetworkStatusBanner';

import lazyWithRetry from '../utils/lazyWithRetry';

// Top-Level Lazy-Loaded Authentication Views
const DealerLogin = lazyWithRetry(() => import('./Auth/DealerLogin'));
const AdminLogin = lazyWithRetry(() => import('./Auth/AdminLogin'));
const StaffLogin = lazyWithRetry(() => import('./Auth/StaffLogin'));

// Top-Level Lazy-Loaded Dealer Portal Views
const DealerDashboard = lazyWithRetry(() => import('./DealerPortal/DealerDashboard'));
const CreateQuotation = lazyWithRetry(() => import('./DealerPortal/CreateQuotation'));
const QuotationPreview = lazyWithRetry(() => import('./DealerPortal/QuotationPreview'));
const MyQuotations = lazyWithRetry(() => import('./DealerPortal/MyQuotations'));
const MyApplications = lazyWithRetry(() => import('./DealerPortal/MyApplications'));
const DealerSettings = lazyWithRetry(() => import('./DealerPortal/DealerSettings'));

// Top-Level Lazy-Loaded Staff Portal Views
const StaffDashboard = lazyWithRetry(() => import('./StaffPortal/StaffDashboard'));
const StaffFiles = lazyWithRetry(() => import('./StaffPortal/StaffFiles'));
const VerificationDesk = lazyWithRetry(() => import('./StaffPortal/VerificationDesk'));

// Top-Level Lazy-Loaded Admin Portal Views
const AdminDashboard = lazyWithRetry(() => import('./AdminPortal/AdminDashboard'));
const DealerManagement = lazyWithRetry(() => import('./AdminPortal/DealerManagement'));
const DealerAccountsManagement = lazyWithRetry(() => import('./AdminPortal/DealerAccountsManagement'));
const PricingMaster = lazyWithRetry(() => import('./AdminPortal/PricingMaster'));
const HardwareMaster = lazyWithRetry(() => import('./AdminPortal/HardwareMaster'));
const AllQuotations = lazyWithRetry(() => import('./AdminPortal/AllQuotations'));
const AdminSettings = lazyWithRetry(() => import('./AdminPortal/AdminSettings'));
const StaffManagement = lazyWithRetry(() => import('./AdminPortal/StaffManagement'));
const StaffAccountsManagement = lazyWithRetry(() => import('./AdminPortal/StaffAccountsManagement'));
const BusinessPerformance = lazyWithRetry(() => import('./AdminPortal/BusinessPerformance'));
const ReportsAnalytics = lazyWithRetry(() => import('./AdminPortal/ReportsAnalytics'));
const AuditLogViewer = lazyWithRetry(() => import('./AdminPortal/AuditLogViewer'));
const DealerPaymentLedger = lazyWithRetry(() => import('./AdminPortal/DealerPaymentLedger'));

// Shared Views
const LeadGenerationComingSoon = lazyWithRetry(() => import('./Shared/LeadGenerationComingSoon'));
const DocumentationHub = lazyWithRetry(() => import('./Shared/DocumentationHub'));
const ComingSoonPlaceholder = lazyWithRetry(() => import('./Shared/ComingSoonPlaceholder'));

function PortalContent() {
  const { isAuthenticated, authView, role, activeTab, currentStaff } = useApp();
  const isVerificationStaff = Boolean(
    String(currentStaff?.department || '').toLowerCase() === 'verification' ||
    String(currentStaff?.role || '').toLowerCase().includes('verification')
  );
  const [splashFinished, setSplashFinished] = useState(() => {
    return sessionStorage.getItem('sunvine_splash_shown') === 'true';
  });

  const handleSplashFinish = () => {
    sessionStorage.setItem('sunvine_splash_shown', 'true');
    setSplashFinished(true);
  };

  // 1. Unauthenticated Gateway
  if (!isAuthenticated) {
    return (
      <>
        <Suspense fallback={<ViewSkeleton title="Loading Authentication..." />}>
          {authView === 'admin_login' ? (
            <AdminLogin />
          ) : authView === 'staff_login' ? (
            <StaffLogin />
          ) : (
            <DealerLogin />
          )}
        </Suspense>
        {!splashFinished && <SplashScreen onFinish={handleSplashFinish} />}
      </>
    );
  }

  // 2. Authenticated Portal Views
  const renderView = () => {
    // Shared 4-Page PDF proposal preview
    if (activeTab === 'preview_quote') {
      return <QuotationPreview />;
    }

    if (role === 'admin') {
      switch (activeTab) {
        case 'admin_dashboard':
          return <AdminDashboard />;
        case 'admin_ledger':
          return (
            <ComingSoonPlaceholder
              title="Dealer Financial Ledger & Accounting"
              subtitle="Feature Under Construction"
              icon="account_balance_wallet"
              description="Banking-grade dual-entry ledger (Debit Dr. / Credit Cr.), kit dispatch billing reconciliation, customer file balance tracking, and automated dealer payment statements are currently under development and will be unlocked in the upcoming version."
              backTab="admin_dashboard"
              highlights={[
                'Dual-Entry Banking Ledger (Dr. / Cr.)',
                'Kit Dispatch Billing Reconciliation',
                'Customer File Outstanding Dues',
                'Official WhatsApp Payment Statements'
              ]}
            />
          );
        case 'admin_performance':
          return <BusinessPerformance />;
        case 'create_quote':
        case 'admin_create_quote':
          return <CreateQuotation />;
        case 'dealers_mgmt':
          return <DealerAccountsManagement />;
        case 'staff_mgmt':
          return <StaffAccountsManagement />;
        case 'admin_reports':
          return <ReportsAnalytics />;
        case 'admin_audit':
          return <AuditLogViewer />;
        case 'lead_generation':
          return <LeadGenerationComingSoon />;
        case 'pricing_master':
          return <PricingMaster />;
        case 'hardware_master':
          return <HardwareMaster />;
        case 'all_quotes':
          return <AllQuotations />;
        case 'admin_docs':
          return <DocumentationHub />;
        case 'admin_settings':
          return <AdminSettings />;
        default:
          return <AdminDashboard />;
      }
    }

    if (role === 'staff') {
      switch (activeTab) {
        case 'verification_desk':
        case 'staff_verification':
          return <VerificationDesk />;
        case 'admin_ledger':
          return (
            <ComingSoonPlaceholder
              title="Dealer Financial Ledger & Accounting"
              subtitle="Feature Under Construction"
              icon="account_balance_wallet"
              description="Banking-grade dual-entry ledger (Debit Dr. / Credit Cr.), kit dispatch billing reconciliation, customer file balance tracking, and automated dealer payment statements are currently under development and will be unlocked in the upcoming version."
              backTab={isVerificationStaff ? 'verification_desk' : 'staff_dashboard'}
              highlights={[
                'Dual-Entry Banking Ledger (Dr. / Cr.)',
                'Kit Dispatch Billing Reconciliation',
                'Customer File Outstanding Dues',
                'Official WhatsApp Payment Statements'
              ]}
            />
          );
        case 'staff_dashboard':
          return <StaffDashboard />;
        case 'create_quote':
          return <CreateQuotation />;
        case 'staff_files':
          return <StaffFiles />;
        case 'staff_pricing':
          return <PricingMaster />;
        case 'staff_performance':
          return <BusinessPerformance />;
        case 'staff_new_lead':
          return (
            <ComingSoonPlaceholder
              title="New Customer Lead Engine"
              subtitle="Feature Under Construction"
              icon="person_add"
              description="We are building this module to streamline lead generation, instant customer file intake, and geo-allocated lead processing directly to field officers. This feature will be available in the next release."
              backTab="staff_dashboard"
            />
          );
        case 'staff_map':
          return (
            <ComingSoonPlaceholder
              title="Nearby Radar (AI) Discovery"
              subtitle="Feature Under Construction"
              icon="radar"
              description="AI-powered geographic rooftop solar density mapping, Gujarat DISCOM feeder proximity detection, and solar cluster prospect radar will be available in the next release."
              backTab="staff_dashboard"
            />
          );
        case 'lead_generation':
          return <LeadGenerationComingSoon />;
        case 'docs':
          return <DocumentationHub />;
        default:
          return isVerificationStaff ? <VerificationDesk /> : <StaffDashboard />;
      }
    }

    // Default: Dealer Portal Views
    switch (activeTab) {
      case 'dashboard':
        return <DealerDashboard />;
      case 'dealer_ledger':
        return (
          <ComingSoonPlaceholder
            title="My Financial Statement & Ledger"
            subtitle="Feature Under Construction"
            icon="account_balance_wallet"
            description="Dealer financial statements, kit dispatch billing reconciliation, received payments, and customer file accounting are currently under development and will be unlocked in the upcoming version."
            backTab="dashboard"
            highlights={[
              'Live Running Statement (Dr. & Cr.)',
              'Kit Dispatch Billing Breakdown',
              'Customer Project Payment Tracking',
              'Instant Remittance Receipts'
            ]}
          />
        );
      case 'create_quote':
        return <CreateQuotation />;
      case 'my_quotes':
        return <MyQuotations />;
      case 'my_applications':
        return <MyApplications />;
      case 'dealer_performance':
        return <BusinessPerformance />;
      case 'lead_generation':
        return <LeadGenerationComingSoon />;
      case 'docs':
        return <DocumentationHub />;
      case 'profile':
      case 'dealer_settings':
        return role === 'admin' ? <AdminSettings /> : <DealerDashboard />;
      default:
        return <DealerDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8F7] text-[#0F1B2E] font-sans antialiased">
      {/* Navigation Layout */}
      <Navigation />

      {/* Real-Time Update Notification Popup */}
      <UpdateNotificationPopup />

      {/* Main Content Area */}
      <main className={`md:pl-64 pt-16 pb-24 md:pb-8 transition-all w-full min-w-0 max-w-full ${activeTab === 'preview_quote' ? 'overflow-visible' : 'overflow-x-clip'}`}>
        <Suspense fallback={<ViewSkeleton />}>
          {activeTab === 'preview_quote' ? (
            <div className="w-full min-w-0">
              {renderView()}
            </div>
          ) : (
            <div className="p-3 sm:p-4 lg:p-6 xl:p-8 w-full max-w-[1600px] mx-auto min-w-0">
              {renderView()}
            </div>
          )}
        </Suspense>
      </main>

      {/* Real-time Network Offline / Restored Status Banner */}
      <NetworkStatusBanner />
    </div>
  );
}

export default function PortalApp() {
  return (
    <AppProvider>
      <PortalContent />
      <AppUpdateModal />
    </AppProvider>
  );
}
