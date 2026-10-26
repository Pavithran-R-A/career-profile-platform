import { ProfileRepository, ProfileAppError, type ProfileWithRelations } from './repository';
import { validateUsername } from '../validators/username';

export { ProfileAppError };

/**
 * Maps ANY error from the profile flows to a customer-safe message. Raw
 * Postgres/Supabase error text never reaches the UI.
 */
export function safeProfileErrorMessage(err: unknown): string {
  if (err instanceof ProfileAppError) return err.message;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('fetch') || msg.includes('network')) {
      return 'Could not reach the server. Check your connection and try again.';
    }
    if (msg.includes('username is already taken')) return 'Username is already taken';
  }
  return 'Something went wrong. Please try again.';
}

export class ProfileService {
  private repository = new ProfileRepository();

  async getProfile(userId: string): Promise<ProfileWithRelations | null> {
    return this.repository.getProfileByUserId(userId);
  }

  /**
   * Atomic create: ONE insert carries user_id, username, display_name,
   * headline, about, location (RPC). If a partial profile from an earlier
   * failed attempt exists, it is resumed/updated instead of duplicated.
   * Returns the profile id, or null when the username is taken.
   */
  async createProfileWithBasics(input: {
    userId: string;
    username: string;
    displayName: string;
    headline: string;
    about: string;
    location: string;
  }): Promise<string | null> {
    const validation = validateUsername(input.username);
    if (!validation.valid) {
      throw new ProfileAppError('backend', validation.error || 'Invalid username');
    }

    return this.repository.createProfileWithBasics({
      ...input,
      username: validation.username,
    });
  }

  async updateProfile(profileId: string, updates: Record<string, unknown>): Promise<void> {
    await this.repository.updateProfile(profileId, updates);
  }

  async checkUsernameAvailability(
    username: string
  ): Promise<{ available: boolean; error: string | null }> {
    const validation = validateUsername(username);
    if (!validation.valid) {
      return { available: false, error: validation.error };
    }

    const isAvailable = await this.repository.checkUsernameAvailability(validation.username);
    return {
      available: isAvailable,
      error: isAvailable ? null : 'Username is already taken',
    };
  }
}
