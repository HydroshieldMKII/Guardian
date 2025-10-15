import { config } from '@/lib/config';
import { UserPreference } from '@/types';

export const useUserPreferences = () => {
  const updateUserPreference = async (userId: string, defaultBlock: boolean | null): Promise<boolean> => {
    try {
      const response = await fetch(
        `${config.api.baseUrl}/users/${encodeURIComponent(userId)}/preference`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ defaultBlock }),
        }
      );
      return response.ok;
    } catch (error) {
      console.error("Error updating user preference:", error);
      return false;
    }
  };

  const updateUserIPPolicy = async (
    userId: string, 
    updates: Partial<Pick<UserPreference, 'networkPolicy' | 'ipAccessPolicy' | 'allowedIPs'>>
  ): Promise<boolean> => {
    try {
      const response = await fetch(
        `${config.api.baseUrl}/users/${encodeURIComponent(userId)}/ip-policy`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        }
      );
      return response.ok;
    } catch (error) {
      console.error("Error updating user IP policy:", error);
      return false;
    }
  };

  return {
    updateUserPreference,
    updateUserIPPolicy,
  };
};