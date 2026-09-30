import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Navigation from './components/Navigation';
import AppUpdateModal from './components/Shared/AppUpdateModal';
import UpdateNotificationPopup from './components/Shared/UpdateNotificationPopup';
import ErrorBoundary from './components/Shared/ErrorBoundary';
import { ToastProvider } from './components/Shared/Toast';
import NetworkStatusBanner from './components/Shared/NetworkStatusBanner';
import { LoadingProvider } from './context/LoadingContext';
import GlobalActionLoader from './components/Shared/GlobalActionLoader';

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
import ComingSoonPlaceholder from './components/Shared/ComingSoonPlaceholder';
import DocumentationHub from './components/Shared/DocumentationHub';

function MainApp() {
  const { isAuthenticated, authView, role, activeTab, currentStaff } = useApp();
  const isVerificationStaff = Boolean(
    currentStaff?.role?.toLowerCase().includes('verification') ||
    currentStaff?.department === 'verification' ||
    currentStaff?.id === 'STF-003'
  );
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

  // 1. Unauthenticated Gateway - transitions directly to login page
  if (!isAuthenticated) {
    return authView === 'admin_login' ? (
      <AdminLogin />
    ) : authView === 'staff_login' ? (
      <StaffLogin />
    ) : (
      <DealerLogin />
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
      <main className={`md:pl-64 pt-16 pb-6 md:pb-8 transition-all w-full min-w-0 max-w-full ${activeTab === 'preview_quote' ? 'overflow-visible' : 'overflow-x-clip'}`}>
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
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LoadingProvider>
        <AppProvider>
          <ToastProvider>
            <MainApp />
            <GlobalActionLoader />
            <AppUpdateModal />
          </ToastProvider>
        </AppProvider>
      </LoadingProvider>
    </ErrorBoundary>
  );
}
