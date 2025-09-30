import { config } from '@/lib/config';

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

  return {
    updateUserPreference,
  };
};