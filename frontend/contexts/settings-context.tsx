"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { config } from '@/lib/config';
import { AppSetting } from '@/types';

interface SettingsContextType {
  settings: AppSetting[];
  loading: boolean;
  error: string | null;
  refreshSettings: () => Promise<void>;
  getSetting: (key: string) => string | null;
  getBooleanSetting: (key: string) => boolean | null;
  getNumberSetting: (key: string) => number | null;
  getGlobalDefaultBlock: () => boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${config.api.baseUrl}/config`);
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      } else {
        setError('Failed to fetch configuration');
      }
    } catch (err) {
      setError('Error fetching configuration');
      console.error('Error fetching config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const refreshSettings = async () => {
    await fetchSettings();
  };

  const getSetting = (key: string): string | null => {
    const setting = settings.find(s => s.key === key);
    return setting ? setting.value : null;
  };

  const getBooleanSetting = (key: string): boolean | null => {
    const value = getSetting(key);
    if (value === null) return null;
    return value === 'true';
  };

  const getNumberSetting = (key: string): number | null => {
    const value = getSetting(key);
    if (value === null) return null;
    const numValue = parseFloat(value);
    return isNaN(numValue) ? null : numValue;
  };

  const getGlobalDefaultBlock = (): boolean => {
    const value = getBooleanSetting('PLEX_GUARD_DEFAULT_BLOCK');
    return value ?? true; // Default to true (block) if not set
  };

  const contextValue: SettingsContextType = {
    settings,
    loading,
    error,
    refreshSettings,
    getSetting,
    getBooleanSetting,
    getNumberSetting,
    getGlobalDefaultBlock,
  };

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};