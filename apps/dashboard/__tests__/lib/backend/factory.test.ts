/**
 * Tests for the backend factory functionality
 */

import { createBackend, getBackend, clearBackendCache, validateBackendConfig, getBackendInfo } from '../../../src/lib/backend/factory';
import { ChronicleBackend, ValidationError } from '../../../src/lib/backend';
import { LocalBackend } from '../../../src/lib/backend/LocalBackend';
import { SupabaseBackend } from '../../../src/lib/backend/SupabaseBackend';

// Mock the config module
jest.mock('../../../src/lib/config', () => ({
  config: {
    backend: {
      mode: 'local',
      local: {
        serverUrl: 'http://localhost:8510',
      },
      supabase: {
        url: 'https://test.supabase.co',
        anonKey: 'test-anon-key',
      },
    },
  },
  configUtils: {
    isLocalMode: () => true,
    isSupabaseMode: () => false,
  },
}));

// Mock the backend classes
jest.mock('../../../src/lib/backend/LocalBackend');
jest.mock('../../../src/lib/backend/SupabaseBackend');

// Mock the logger
jest.mock('../../../src/lib/utils', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('Backend Factory', () => {
  const mockLocalBackend = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    getConnectionStatus: jest.fn().mockReturnValue('connected'),
    getMetadata: jest.fn().mockResolvedValue({
      type: 'local',
      version: '1.0.0',
      capabilities: {
        realtime: true,
        websockets: true,
        analytics: true,
        export: true,
      },
      connectionInfo: {
        url: 'http://localhost:8510',
      },
    }),
    onConnectionStatusChange: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    getEvents: jest.fn().mockResolvedValue([]),
    getSessions: jest.fn().mockResolvedValue([]),
    getSessionSummaries: jest.fn().mockResolvedValue([]),
    subscribeToEvents: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    subscribeToSessions: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    healthCheck: jest.fn().mockResolvedValue(true),
  } as unknown as ChronicleBackend;

  const mockSupabaseBackend = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    getConnectionStatus: jest.fn().mockReturnValue('connected'),
    getMetadata: jest.fn().mockResolvedValue({
      type: 'supabase',
      version: 'cloud',
      capabilities: {
        realtime: true,
        websockets: true,
        analytics: true,
        export: true,
      },
      connectionInfo: {
        url: 'https://test.supabase.co',
      },
    }),
    onConnectionStatusChange: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    getEvents: jest.fn().mockResolvedValue([]),
    getSessions: jest.fn().mockResolvedValue([]),
    getSessionSummaries: jest.fn().mockResolvedValue([]),
    subscribeToEvents: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    subscribeToSessions: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    healthCheck: jest.fn().mockResolvedValue(true),
  } as unknown as ChronicleBackend;

  beforeEach(() => {
    jest.clearAllMocks();
    (LocalBackend as jest.Mock).mockImplementation(() => mockLocalBackend);
    (SupabaseBackend as jest.Mock).mockImplementation(() => mockSupabaseBackend);
  });

  afterEach(async () => {
    await clearBackendCache();
  });

  describe('createBackend', () => {
    it('should create a local backend when mode is local', async () => {
      const { backend, metadata } = await createBackend();

      expect(LocalBackend).toHaveBeenCalledWith(
        'http://localhost:8510',
        expect.objectContaining({
          retryAttempts: 5,
          retryDelay: 2000,
          timeout: 10000,
          healthCheckInterval: 60000,
        })
      );
      expect(backend).toBe(mockLocalBackend);
      expect(metadata.type).toBe('local');
      expect(mockLocalBackend.connect).toHaveBeenCalled();
    });

    it('should create a supabase backend when mode is supabase', async () => {
      // Mock config for supabase mode
      const mockConfig = require('../../../src/lib/config');
      mockConfig.config.backend.mode = 'supabase';
      mockConfig.configUtils.isLocalMode = () => false;
      mockConfig.configUtils.isSupabaseMode = () => true;

      const { backend, metadata } = await createBackend();

      expect(SupabaseBackend).toHaveBeenCalledWith(
        expect.objectContaining({
          retryAttempts: 5,
          retryDelay: 2000,
          timeout: 10000,
          healthCheckInterval: 60000,
        })
      );
      expect(backend).toBe(mockSupabaseBackend);
      expect(metadata.type).toBe('supabase');
      expect(mockSupabaseBackend.connect).toHaveBeenCalled();
    });

    it('should apply custom config when provided', async () => {
      const customConfig = {
        retryAttempts: 3,
        retryDelay: 1000,
        timeout: 5000,
      };

      await createBackend(customConfig);

      expect(LocalBackend).toHaveBeenCalledWith(
        'http://localhost:8510',
        expect.objectContaining({
          retryAttempts: 3,
          retryDelay: 1000,
          timeout: 5000,
          healthCheckInterval: 60000, // Default should still apply
        })
      );
    });

    it('should throw ValidationError for unsupported backend type', async () => {
      const mockConfig = require('../../../src/lib/config');
      mockConfig.config.backend.mode = 'invalid';

      await expect(createBackend()).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when local config is missing', async () => {
      const mockConfig = require('../../../src/lib/config');
      mockConfig.config.backend.local = undefined;

      await expect(createBackend()).rejects.toThrow(ValidationError);
    });
  });

  describe('getBackend', () => {
    it('should return cached backend on subsequent calls', async () => {
      const backend1 = await getBackend();
      const backend2 = await getBackend();

      expect(backend1).toBe(backend2);
      expect(LocalBackend).toHaveBeenCalledTimes(1);
    });

    it('should create new backend when forceRefresh is true', async () => {
      const backend1 = await getBackend();
      const backend2 = await getBackend(true);

      expect(LocalBackend).toHaveBeenCalledTimes(2);
      expect(mockLocalBackend.disconnect).toHaveBeenCalled();
    });
  });

  describe('clearBackendCache', () => {
    it('should disconnect cached backend and clear cache', async () => {
      await getBackend(); // Create cached backend
      await clearBackendCache();

      expect(mockLocalBackend.disconnect).toHaveBeenCalled();
      
      // Next call should create new backend
      await getBackend();
      expect(LocalBackend).toHaveBeenCalledTimes(2);
    });

    it('should handle errors during disconnect gracefully', async () => {
      mockLocalBackend.disconnect = jest.fn().mockRejectedValue(new Error('Disconnect failed'));
      
      await getBackend();
      
      // Should not throw
      await expect(clearBackendCache()).resolves.toBeUndefined();
    });
  });

  describe('validateBackendConfig', () => {
    it('should validate local backend config successfully', () => {
      const result = validateBackendConfig();

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return errors for invalid local config', () => {
      const mockConfig = require('../../../src/lib/config');
      mockConfig.config.backend.local = { serverUrl: 'invalid-url' };

      const result = validateBackendConfig();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Local backend server URL is invalid');
    });

    it('should validate supabase backend config', () => {
      const mockConfig = require('../../../src/lib/config');
      mockConfig.config.backend.mode = 'supabase';
      mockConfig.config.backend.supabase = {
        url: 'https://test.supabase.co',
        anonKey: 'test-key',
      };

      const result = validateBackendConfig();

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return errors for invalid supabase config', () => {
      const mockConfig = require('../../../src/lib/config');
      mockConfig.config.backend.mode = 'supabase';
      mockConfig.config.backend.supabase = {
        url: '',
        anonKey: '',
      };

      const result = validateBackendConfig();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Supabase backend missing URL');
      expect(result.errors).toContain('Supabase backend missing anonymous key');
    });

    it('should return errors for missing backend mode', () => {
      const mockConfig = require('../../../src/lib/config');
      mockConfig.config.backend.mode = '';

      const result = validateBackendConfig();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Backend mode not specified');
    });
  });

  describe('getBackendInfo', () => {
    it('should return comprehensive backend information', () => {
      const info = getBackendInfo();

      expect(info).toEqual({
        mode: 'local',
        isLocalMode: true,
        isSupabaseMode: false,
        config: {
          local: {
            serverUrl: 'http://localhost:8510',
          },
          supabase: {
            url: 'https://test.supabase.co',
            hasAnonKey: true,
            hasServiceRoleKey: false,
          },
        },
        validation: {
          isValid: true,
          errors: [],
        },
      });
    });
  });
});