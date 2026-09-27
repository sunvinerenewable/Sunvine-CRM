import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import SplashScreen from './components/SplashScreen';
import Navigation from './components/Navigation';
import AppUpdateModal from './components/Shared/AppUpdateModal';
import UpdateNotificationPopup from './components/Shared/UpdateNotificationPopup';
import ErrorBoundary from './components/Shared/ErrorBoundary';
import { ToastProvider } from './components/Shared/Toast';
import NetworkStatusBanner from './components/Shared/NetworkStatusBanner';

// Authentication Views
import DealerLogin from './components/Auth/DealerLogin';
import AdminLogin from './components/Auth/AdminLogin';
import StaffLogin from './components/Auth/StaffLogin';

// Dealer Portal Views
import DealerDashboard from './components/DealerPortal/DealerDashboard';
import CreateQuotation from './components/DealerPortal/CreateQuotation';
import QuotationPreview from './components/DealerPortal/QuotationPreview';
import MyQuotations from './components/DealerPortal/MyQuotations';
import DealerProfile from './components/DealerPortal/DealerProfile';
import DealerSettings from './components/DealerPortal/DealerSettings';

// Staff Portal Views
import StaffDashboard from './components/StaffPortal/StaffDashboard';
import StaffFiles from './components/StaffPortal/StaffFiles';
import VerificationDesk from './components/StaffPortal/VerificationDesk';
import StaffNewLead from './components/StaffPortal/StaffNewLead';
import StaffRadarMap from './components/StaffPortal/StaffRadarMap';

// Admin Portal Views
import AdminDashboard from './components/AdminPortal/AdminDashboard';
import DealerManagement from './components/AdminPortal/DealerManagement';
import PricingMaster from './components/AdminPortal/PricingMaster';
import HardwareMaster from './components/AdminPortal/HardwareMaster';
import AllQuotations from './components/AdminPortal/AllQuotations';
import AdminSettings from './components/AdminPortal/AdminSettings';
import StaffManagement from './components/AdminPortal/StaffManagement';
import BusinessPerformance from './components/AdminPortal/BusinessPerformance';
import ReportsAnalytics from './components/AdminPortal/ReportsAnalytics';
import AuditLogViewer from './components/AdminPortal/AuditLogViewer';

// Shared Expanded Views
import LeadGenerationComingSoon from './components/Shared/LeadGenerationComingSoon';
import DocumentationHub from './components/Shared/DocumentationHub';

function MainApp() {
  const { isAuthenticated, authView, role, activeTab } = useApp();
  const [splashFinished, setSplashFinished] = useState(() => {
    return sessionStorage.getItem('sunvine_splash_shown') === 'true';
  });

  const handleSplashFinish = () => {
    sessionStorage.setItem('sunvine_splash_shown', 'true');
    setSplashFinished(true);
  };

  // 0. Public Proposal Viewer (Accessible by customer via WhatsApp link)
  const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const isPublicProposalView = urlParams.get('view') === 'quote';
  const publicQuoteId = urlParams.get('id');

  if (isPublicProposalView) {
    return (
      <div className="min-h-screen bg-[#F6F8F7] text-[#0F1B2E] font-sans antialiased py-0">
        <main className="max-w-5xl mx-auto">
          <QuotationPreview isPublicView={true} publicQuoteId={publicQuoteId} />
        </main>
      </div>
    );
  }

  // 1. Unauthenticated Gateway
  if (!isAuthenticated) {
    return (
      <>
        {authView === 'admin_login' ? (
          <AdminLogin />
        ) : authView === 'staff_login' ? (
          <StaffLogin />
        ) : (
          <DealerLogin />
        )}
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
        case 'admin_performance':
          return <BusinessPerformance />;
        case 'create_quote':
        case 'admin_create_quote':
          return <CreateQuotation />;
        case 'dealers_mgmt':
          return <DealerManagement />;
        case 'staff_mgmt':
          return <StaffManagement />;
        case 'admin_verification':
          return <VerificationDesk />;
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
        case 'staff_dashboard':
          return <StaffDashboard />;
        case 'staff_files':
          return <StaffFiles />;
        case 'staff_verification':
          return <VerificationDesk />;
        case 'staff_performance':
          return <BusinessPerformance />;
        case 'staff_new_lead':
          return <StaffNewLead />;
        case 'staff_map':
          return <StaffRadarMap />;
        case 'lead_generation':
          return <LeadGenerationComingSoon />;
        case 'docs':
          return <DocumentationHub />;
        default:
          return <StaffDashboard />;
      }
    }

    // Default: Dealer Portal Views
    switch (activeTab) {
      case 'dashboard':
        return <DealerDashboard />;
      case 'create_quote':
        return <CreateQuotation />;
      case 'my_quotes':
        return <MyQuotations />;
      case 'dealer_performance':
        return <BusinessPerformance />;
      case 'lead_generation':
        return <LeadGenerationComingSoon />;
      case 'docs':
        return <DocumentationHub />;
      case 'profile':
      case 'dealer_settings':
        return <DealerSettings />;
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
        {activeTab === 'preview_quote' ? (
          <div className="w-full min-w-0">
            {renderView()}
          </div>
        ) : (
          <div className="p-3 sm:p-4 lg:p-6 xl:p-8 w-full max-w-[1600px] mx-auto min-w-0">
            {renderView()}
          </div>
        )}
      </main>

      {/* Real-time Network Offline / Restored Status Banner */}
      <NetworkStatusBanner />

      {/* 1-Second Splash on first arrival */}
      {!splashFinished && <SplashScreen onFinish={handleSplashFinish} />}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <ToastProvider>
          <MainApp />
          <AppUpdateModal />
        </ToastProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}
