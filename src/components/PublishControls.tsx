import { useState } from 'react';
import {
  publishProfile,
  unpublishProfile,
  type ProfilePreferences,
} from '../lib/profiles/preferences';

interface PublishControlsProps {
  profileId: string;
  preferences: ProfilePreferences | null;
  onPublishChange: (preferences: ProfilePreferences) => void;
}

export default function PublishControls({
  profileId,
  preferences,
  onPublishChange,
}: PublishControlsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPublished = preferences?.is_public ?? false;

  const handleToggle = async () => {
    setLoading(true);
    setError(null);

    try {
      const updated = isPublished
        ? await unpublishProfile(profileId)
        : await publishProfile(profileId);

      onPublishChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-900">Publish profile</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {isPublished
              ? 'Your profile is live and publicly accessible.'
              : 'Your profile is in draft mode and not visible to others.'}
          </p>
          {isPublished && preferences?.published_at && (
            <p className="text-xs text-gray-400 mt-1">
              Published {new Date(preferences.published_at).toLocaleDateString()}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => void handleToggle()}
          disabled={loading}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            isPublished
              ? 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              : 'bg-gray-900 text-white hover:bg-gray-800'
          } disabled:opacity-50 disabled:cursor-not-allowed`}>
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
              {isPublished ? 'Unpublishing...' : 'Publishing...'}
            </span>
          ) : isPublished ? (
            'Unpublish'
          ) : (
            'Publish'
          )}
        </button>
      </div>

      {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

      {isPublished && preferences?.custom_domain && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            Custom domain:{' '}
            <span className="font-medium text-gray-700">{preferences.custom_domain}</span>
          </p>
        </div>
      )}
    </div>
  );
}
