import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../lib/auth/context';
import { ProfileService } from '../lib/profiles/service';
import type { ProfileWithRelations } from '../lib/profiles/repository';

export default function Dashboard() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileWithRelations | null>(null);
  const [loading, setLoading] = useState(true);

  const profileService = new ProfileService();

  useEffect(() => {
    if (auth.status === 'authenticated') {
      void profileService.getProfile(auth.user.id).then((p) => {
        setProfile(p);
        setLoading(false);
      });
    }
  }, [auth]);

  useEffect(() => {
    if (auth.status === 'unauthenticated' && !loading) {
      void navigate('/login');
    }
  }, [auth, loading, navigate]);

  useEffect(() => {
    if (!loading && auth.status === 'authenticated' && !profile) {
      void navigate('/onboarding');
    }
  }, [loading, auth, profile, navigate]);

  if (auth.status === 'loading' || loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (auth.status === 'unauthenticated' || !profile) {
    return null;
  }

  const completionItems = [
    { label: 'Profile basics', completed: !!profile.display_name },
    { label: 'Experience', completed: profile.experiences.length > 0 },
    { label: 'Education', completed: profile.education.length > 0 },
    { label: 'Skills', completed: profile.skills.length > 0 },
    { label: 'Links', completed: profile.links.length > 0 },
  ];

  const completedCount = completionItems.filter((item) => item.completed).length;
  const completionPercentage = Math.round((completedCount / completionItems.length) * 100);

  const handleSignOut = () => {
    void auth.signOut();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-2">
          Welcome, {profile.display_name || profile.username}
        </h1>
        <p className="text-gray-600">
          Your profile is <span className="font-medium">{completionPercentage}%</span> complete
        </p>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Profile completion</h2>
          <span className="text-sm text-gray-500">
            {completedCount}/{completionItems.length}
          </span>
        </div>
        <div className="space-y-2">
          {completionItems.map((item) => (
            <div key={item.label} className="flex items-center">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center mr-3 ${item.completed ? 'bg-green-500 text-white' : 'bg-gray-200'}`}>
                {item.completed && '✓'}
              </span>
              <span className={item.completed ? 'text-gray-900' : 'text-gray-500'}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium mb-4">Profile status</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Username</span>
              <span className="font-medium">{profile.username}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status</span>
              <span className="px-2 py-1 bg-gray-100 rounded text-sm capitalize">
                {profile.visibility}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last updated</span>
              <span className="text-sm">{new Date(profile.updated_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium mb-4">Quick actions</h3>
          <div className="space-y-3">
            <Link
              to="/dashboard/profile"
              className="block w-full text-center bg-gray-900 text-white py-2 px-4 rounded-md hover:bg-gray-800">
              Edit profile
            </Link>
            <button
              onClick={handleSignOut}
              className="block w-full text-center border border-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-50">
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>Public portfolio publishing coming in a future update.</p>
      </div>
    </div>
  );
}
