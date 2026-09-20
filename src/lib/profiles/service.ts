import { ProfileRepository, type ProfileWithRelations } from './repository';
import { validateUsername } from '../validators/username';

export class ProfileService {
  private repository = new ProfileRepository();

  async getProfile(userId: string): Promise<ProfileWithRelations | null> {
    return this.repository.getProfileByUserId(userId);
  }

  async createProfile(userId: string, username: string): Promise<ProfileWithRelations> {
    const validation = validateUsername(username);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid username');
    }

    const isAvailable = await this.repository.checkUsernameAvailability(validation.username);
    if (!isAvailable) {
      throw new Error('Username is already taken');
    }

    return this.repository.createProfile(userId, validation.username);
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
