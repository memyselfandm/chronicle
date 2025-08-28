/**
 * Backend Factory
 * Creates and manages backend instances based on configuration
 */

import { 
  ChronicleBackend,
  BackendFactory,
  BackendMetadata,
  BackendConfig,
  ValidationError
} from './index';
import { LocalBackend } from './LocalBackend';
import { SupabaseBackend } from './SupabaseBackend';
import { config, configUtils } from '../config';
import { logger } from '../utils';

/**
 * Cached backend instance
 */
let cachedBackend: ChronicleBackend | null = null;

/**
 * Create a Chronicle backend based on configuration
 */
export async function createBackend(customConfig?: BackendConfig): Promise<BackendFactory> {
  const backendConfig = config.backend;
  const backendType = backendConfig.mode;

  logger.info('Creating Chronicle backend', {
    component: 'BackendFactory',
    action: 'createBackend',
    data: { type: backendType }
  });

  let backend: ChronicleBackend;
  let metadata: BackendMetadata;

  const finalConfig: BackendConfig = {
    retryAttempts: 5,
    retryDelay: 2000,
    timeout: 10000,
    healthCheckInterval: 60000,
    ...customConfig,
  };

  try {
    switch (backendType) {
      case 'local': {
        if (!backendConfig.local?.serverUrl) {
          throw new ValidationError('Local backend configuration missing server URL');
        }

        backend = new LocalBackend(backendConfig.local.serverUrl, finalConfig);
        metadata = await backend.getMetadata();
        break;
      }

      case 'supabase': {
        if (!backendConfig.supabase?.url || !backendConfig.supabase?.anonKey) {
          throw new ValidationError('Supabase backend configuration missing URL or anonymous key');
        }

        backend = new SupabaseBackend(finalConfig);
        metadata = await backend.getMetadata();
        break;
      }

      default:
        throw new ValidationError(`Unsupported backend type: ${backendType}`);
    }

    // Test connection
    logger.info('Testing backend connection', {
      component: 'BackendFactory',
      action: 'createBackend',
      data: { type: backendType }
    });

    await backend.connect();

    logger.info('Successfully created and connected backend', {
      component: 'BackendFactory',
      action: 'createBackend',
      data: { 
        type: backendType,
        version: metadata.version,
        capabilities: metadata.capabilities
      }
    });

    return {
      backend,
      metadata
    };

  } catch (error) {
    logger.error('Failed to create backend', {
      component: 'BackendFactory',
      action: 'createBackend',
      data: { type: backendType }
    }, error as Error);

    throw error;
  }
}

/**
 * Get or create a cached backend instance
 */
export async function getBackend(forceRefresh = false): Promise<ChronicleBackend> {
  if (!cachedBackend || forceRefresh) {
    const { backend } = await createBackend();
    cachedBackend = backend;
  }

  return cachedBackend;
}

/**
 * Clear cached backend instance
 */
export async function clearBackendCache(): Promise<void> {
  if (cachedBackend) {
    logger.info('Clearing backend cache and disconnecting', {
      component: 'BackendFactory',
      action: 'clearBackendCache'
    });

    try {
      await cachedBackend.disconnect();
    } catch (error) {
      logger.error('Error disconnecting cached backend', {
        component: 'BackendFactory',
        action: 'clearBackendCache'
      }, error as Error);
    }

    cachedBackend = null;
  }
}

/**
 * Validate backend configuration
 */
export function validateBackendConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const backendConfig = config.backend;

  if (!backendConfig.mode) {
    errors.push('Backend mode not specified');
    return { isValid: false, errors };
  }

  switch (backendConfig.mode) {
    case 'local': {
      if (!backendConfig.local?.serverUrl) {
        errors.push('Local backend missing server URL');
      } else {
        // Validate URL format
        try {
          new URL(backendConfig.local.serverUrl);
        } catch {
          errors.push('Local backend server URL is invalid');
        }
      }
      break;
    }

    case 'supabase': {
      if (!backendConfig.supabase?.url) {
        errors.push('Supabase backend missing URL');
      }
      if (!backendConfig.supabase?.anonKey) {
        errors.push('Supabase backend missing anonymous key');
      }
      
      // Validate URL format
      if (backendConfig.supabase?.url) {
        try {
          new URL(backendConfig.supabase.url);
        } catch {
          errors.push('Supabase URL is invalid');
        }
      }
      break;
    }

    default:
      errors.push(`Unsupported backend mode: ${backendConfig.mode}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Switch backend mode (for development/testing)
 */
export async function switchBackendMode(newMode: 'local' | 'supabase'): Promise<ChronicleBackend> {
  logger.info('Switching backend mode', {
    component: 'BackendFactory',
    action: 'switchBackendMode',
    data: { from: config.backend.mode, to: newMode }
  });

  // Clear existing backend
  await clearBackendCache();

  // Update configuration (temporarily)
  // Note: This doesn't persist - it's just for runtime switching
  const originalMode = config.backend.mode;
  (config.backend as any).mode = newMode;

  try {
    const backend = await getBackend(true);
    
    logger.info('Successfully switched backend mode', {
      component: 'BackendFactory',
      action: 'switchBackendMode',
      data: { to: newMode }
    });

    return backend;
  } catch (error) {
    // Restore original mode on failure
    (config.backend as any).mode = originalMode;
    
    logger.error('Failed to switch backend mode, reverting', {
      component: 'BackendFactory',
      action: 'switchBackendMode',
      data: { attempted: newMode, reverted: originalMode }
    }, error as Error);

    throw error;
  }
}

/**
 * Get backend configuration information
 */
export function getBackendInfo() {
  const backendConfig = config.backend;
  const validation = validateBackendConfig();

  return {
    mode: backendConfig.mode,
    isLocalMode: configUtils.isLocalMode(),
    isSupabaseMode: configUtils.isSupabaseMode(),
    config: {
      local: backendConfig.local,
      supabase: backendConfig.supabase ? {
        url: backendConfig.supabase.url,
        hasAnonKey: !!backendConfig.supabase.anonKey,
        hasServiceRoleKey: !!backendConfig.supabase.serviceRoleKey
      } : undefined
    },
    validation
  };
}

/**
 * Initialize backend on app startup
 */
export async function initializeBackend(): Promise<ChronicleBackend> {
  logger.info('Initializing Chronicle backend on startup', {
    component: 'BackendFactory',
    action: 'initializeBackend'
  });

  const validation = validateBackendConfig();
  if (!validation.isValid) {
    logger.error('Backend configuration validation failed', {
      component: 'BackendFactory',
      action: 'initializeBackend',
      data: { errors: validation.errors }
    });

    throw new ValidationError(
      `Backend configuration is invalid: ${validation.errors.join(', ')}`
    );
  }

  const backend = await getBackend();

  logger.info('Backend initialization complete', {
    component: 'BackendFactory',
    action: 'initializeBackend',
    data: { mode: config.backend.mode }
  });

  return backend;
}

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    clearBackendCache().catch(error => {
      console.error('Error cleaning up backend on page unload:', error);
    });
  });
}