import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AuthProvider } from './lib/auth/context';
import Layout from './components/Layout';
import Home from './pages/Home';

// Authenticated app internals and secondary routes are route-level lazy:
// the landing page must not eagerly load Supabase-heavy editor code, the
// template editor, GitHub, billing or domain tools. The PDF stack is pulled
// in by the ATS builder chunk (already isolated).
const Login = lazy(() => import('./pages/auth/Login'));
const Signup = lazy(() => import('./pages/auth/Signup'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/auth/VerifyEmail'));
const AuthCallback = lazy(() => import('./pages/auth/AuthCallback'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProfileEditor = lazy(() => import('./pages/ProfileEditor'));
const ResumeImport = lazy(() => import('./pages/ResumeImport'));
const AppearanceEditor = lazy(() => import('./pages/AppearanceEditor'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Billing = lazy(() => import('./pages/Billing'));
const Domains = lazy(() => import('./pages/Domains'));
const JobTailoring = lazy(() => import('./pages/JobTailoring'));
const DashboardPreview = lazy(() => import('./pages/DashboardPreview'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));
const GitHubDashboard = lazy(() => import('./pages/GitHubDashboard'));
const ATSResumeBuilder = lazy(() => import('./pages/ATSResumeBuilder'));
const AccountDelete = lazy(() => import('./pages/AccountDelete'));

function RouteFallback() {
  return (
    <div className="page-shell" role="status" aria-label="Loading">
      <div className="space-y-4">
        <div className="skeleton h-8 w-56" />
        <div className="skeleton h-64 w-full" />
      </div>
    </div>
  );
}

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
        <Route
          path="/dashboard/resume/ats"
          element={
            <Suspense fallback={<RouteFallback />}>
              <ATSResumeBuilder />
            </Suspense>
          }
        />
        <Route path="/dashboard/resume/tailor" element={<JobTailoring />} />
        <Route path="/dashboard/preview" element={<DashboardPreview />} />
        <Route path="/dashboard/github" element={<GitHubDashboard />} />
        <Route path="/dashboard/billing" element={<Billing />} />
        <Route path="/dashboard/account/delete" element={<AccountDelete />} />
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
