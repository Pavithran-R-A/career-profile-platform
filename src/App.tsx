import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AuthProvider } from './lib/auth/context';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import VerifyEmail from './pages/auth/VerifyEmail';
import AuthCallback from './pages/auth/AuthCallback';
import Dashboard from './pages/Dashboard';
import ProfileEditor from './pages/ProfileEditor';
import ResumeImport from './pages/ResumeImport';
import AppearanceEditor from './pages/AppearanceEditor';
import Onboarding from './pages/Onboarding';
import NotFound from './pages/NotFound';
import Pricing from './pages/Pricing';
import Billing from './pages/Billing';
import Domains from './pages/Domains';
import ATSResumeBuilder from './pages/ATSResumeBuilder';
import JobTailoring from './pages/JobTailoring';
import DashboardPreview from './pages/DashboardPreview';
import PublicProfile from './pages/PublicProfile';
import GitHubDashboard from './pages/GitHubDashboard';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/profile" element={<ProfileEditor />} />
        <Route path="/dashboard/appearance" element={<AppearanceEditor />} />
        <Route path="/dashboard/resume" element={<ResumeImport />} />
        <Route path="/dashboard/resume/ats" element={<ATSResumeBuilder />} />
        <Route path="/dashboard/resume/tailor" element={<JobTailoring />} />
        <Route path="/dashboard/preview" element={<DashboardPreview />} />
        <Route path="/dashboard/github" element={<GitHubDashboard />} />
        <Route path="/dashboard/billing" element={<Billing />} />
        <Route path="/dashboard/domains" element={<Domains />} />
        <Route path="/dashboard/ats" element={<Navigate to="/dashboard/resume/ats" replace />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/u/:username" element={<PublicProfile />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
