import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import {
  getPublicProfileByUsername,
  type PublicProfile as PublicProfileType,
} from '../lib/profiles/public';

export default function PublicProfile() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<PublicProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;

    setLoading(true);
    setError(null);

    getPublicProfileByUsername(username)
      .then((data) => {
        if (!data) {
          setError('Profile not found or not published');
          return;
        }
        setProfile(data);
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">Profile not found</h1>
          <p className="text-gray-600">{error}</p>
          <a href="/" className="mt-4 inline-block text-blue-600 hover:underline">
            Go home
          </a>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">Profile not found</h1>
          <p className="text-gray-600">This profile does not exist or is not published.</p>
          <a href="/" className="mt-4 inline-block text-blue-600 hover:underline">
            Go home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold">{profile.display_name || profile.username}</h1>
            {profile.headline && <p className="text-xl text-gray-600 mt-2">{profile.headline}</p>}
            {profile.location && <p className="text-sm text-gray-500 mt-1">{profile.location}</p>}
          </div>

          {profile.about && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-3">About</h2>
              <p className="text-gray-600 whitespace-pre-wrap">{profile.about}</p>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
            <p>Published profile</p>
          </div>
        </div>
      </div>
    </div>
  );
}
