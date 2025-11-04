import { config } from "./config";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public response?: Response,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const defaultOptions: RequestInit = {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      credentials: "include", // For session auth
    };

    const finalOptions = { ...defaultOptions, ...options };
    const response = await fetch(url, finalOptions);

    // Handle 401 Unauthorized - redirect to login silently
    if (response.status === 401) {
      if (typeof window !== "undefined") {
        window.location.href = "/login";
        return {} as T; // Return empty object
      }
      throw new ApiError(response.status, "Unauthorized", response);
    }

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      try {
        const errorBody = await response.json();
        if (errorBody.message) {
          errorMessage = errorBody.message;
        } else if (errorBody.error) {
          errorMessage = errorBody.error;
        }
      } catch {
        // If response is not JSON, use the default message
      }

      throw new ApiError(response.status, errorMessage, response);
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  async getDashboardData<T>(): Promise<T> {
    return this.get<T>("/dashboard");
  }

  // User visibility methods
  async getHiddenUsers<T>(): Promise<T> {
    return this.get<T>("/users/hidden/list");
  }

  async hideUser<T>(userId: string): Promise<T> {
    return this.post<T>(`/users/${userId}/hide`);
  }

  async showUser<T>(userId: string): Promise<T> {
    return this.post<T>(`/users/${userId}/show`);
  }

  async toggleUserVisibility<T>(userId: string): Promise<T> {
    return this.post<T>(`/users/${userId}/toggle-visibility`);
  }

  async updateUserIPPolicy<T>(userId: string, updates: any): Promise<T> {
    return this.post<T>(`/users/${userId}/ip-policy`, updates);
  }

  // Notification methods
  async getAllNotifications<T>(): Promise<T> {
    return this.get<T>("/notifications");
  }

  async getNotificationsForUser<T>(userId: string): Promise<T> {
    return this.get<T>(`/notifications/user/${userId}`);
  }

  async getUnreadCount<T>(userId: string): Promise<T> {
    return this.get<T>(`/notifications/user/${userId}/unread-count`);
  }

  async markNotificationAsRead<T>(notificationId: number): Promise<T> {
    return this.patch<T>(`/notifications/${notificationId}/read/force`);
  }

  async markNotificationAsReadAuto<T>(notificationId: number): Promise<T> {
    return this.patch<T>(`/notifications/${notificationId}/read`);
  }

  async markAllNotificationsAsRead<T>(): Promise<T> {
    return this.patch<T>(`/notifications/mark-all-read`);
  }

  async deleteNotification<T>(notificationId: number): Promise<T> {
    return this.delete<T>(`/notifications/${notificationId}`);
  }

  async clearAllNotifications<T>(): Promise<T> {
    return this.delete<T>(`/notifications/clear-all`);
  }

  // Settings/Config methods
  async updateConfig<T>(settings: any): Promise<T> {
    return this.request<T>(`/config`, {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  }

  async testPlexConnection<T>(): Promise<T> {
    return this.post<T>(`/config/test-plex-connection`);
  }

  async testSmtpConnection<T>(): Promise<T> {
    return this.post<T>(`/config/test-smtp-connection`);
  }

  async testAppriseConnection<T>(): Promise<T> {
    return this.post<T>(`/config/test-apprise-connection`);
  }

  async getPlexStatus<T>(): Promise<T> {
    return this.get<T>(`/config/status/plex`);
  }

  // Admin/Script endpoints
  async resetStreamCounts<T>(password: string): Promise<T> {
    return this.post<T>(`/config/scripts/reset-stream-counts`, { password });
  }

  async clearSessionHistory<T>(password: string): Promise<T> {
    return this.post<T>(`/config/scripts/clear-session-history`, { password });
  }

  async deleteAllDevices<T>(password: string): Promise<T> {
    return this.post<T>(`/config/scripts/delete-all-devices`, { password });
  }

  async resetDatabase<T>(password: string): Promise<T> {
    return this.post<T>(`/config/scripts/reset-database`, { password });
  }

  // Database export/import endpoints
  async exportDatabase<T>(): Promise<T> {
    return this.get<T>(`/config/database/export`);
  }

  async importDatabase<T>(file: FormData): Promise<T> {
    return this.request<T>(`/config/database/import`, {
      method: "POST",
      body: file,
      headers: {},
    });
  }

  // Health endpoint
  async getHealth<T>(): Promise<T> {
    return this.get<T>(`/health`);
  }

  // Auth/Profile methods
  async updateProfile<T>(data: any): Promise<T> {
    return this.patch<T>(`/auth/profile`, data);
  }

  async updatePassword<T>(data: any): Promise<T> {
    return this.patch<T>(`/auth/password`, data);
  }
}

export const apiClient = new ApiClient(config.api.baseUrl);
