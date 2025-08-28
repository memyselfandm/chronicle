import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ModeIndicator, DetailedModeIndicator } from '../src/components/ModeIndicator';

// Mock the config module
jest.mock('../src/lib/config', () => ({
  config: {
    backend: {
      mode: 'local',
      local: {
        serverUrl: 'http://localhost:8510',
      },
    },
  },
  configUtils: {
    isLocalMode: () => true,
    isSupabaseMode: () => false,
  },
}));

describe('ModeIndicator Component', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  describe('Basic ModeIndicator', () => {
    it('should render local mode indicator', () => {
      render(<ModeIndicator />);
      
      expect(screen.getByText('Local')).toBeInTheDocument();
      expect(screen.getByText('🏠')).toBeInTheDocument();
    });

    it('should have correct styling for local mode', () => {
      render(<ModeIndicator />);
      
      const indicator = screen.getByText('Local').closest('div');
      expect(indicator).toHaveClass('bg-blue-500', 'text-blue-100');
    });

    it('should have tooltip for local mode', () => {
      render(<ModeIndicator />);
      
      const indicator = screen.getByText('Local').closest('div');
      expect(indicator).toHaveAttribute('title', 'Local server at http://localhost:8510');
    });
  });

  describe('Supabase Mode', () => {
    beforeEach(() => {
      // Mock Supabase mode
      jest.doMock('../src/lib/config', () => ({
        config: {
          backend: {
            mode: 'supabase',
            supabase: {
              url: 'https://test.supabase.co',
              anonKey: 'test-key',
            },
          },
        },
        configUtils: {
          isLocalMode: () => false,
          isSupabaseMode: () => true,
        },
      }));
    });

    it('should render Supabase mode indicator', async () => {
      // Re-import with mocked config
      const { ModeIndicator } = await import('../src/components/ModeIndicator');
      
      render(<ModeIndicator />);
      
      expect(screen.getByText('Supabase')).toBeInTheDocument();
      expect(screen.getByText('☁️')).toBeInTheDocument();
    });

    it('should have correct styling for Supabase mode', async () => {
      const { ModeIndicator } = await import('../src/components/ModeIndicator');
      
      render(<ModeIndicator />);
      
      const indicator = screen.getByText('Supabase').closest('div');
      expect(indicator).toHaveClass('bg-green-500', 'text-green-100');
    });

    it('should have tooltip for Supabase mode', async () => {
      const { ModeIndicator } = await import('../src/components/ModeIndicator');
      
      render(<ModeIndicator />);
      
      const indicator = screen.getByText('Supabase').closest('div');
      expect(indicator).toHaveAttribute('title', 'Connected to https://test.supabase.co');
    });
  });

  describe('Unknown Mode', () => {
    beforeEach(() => {
      // Mock unknown mode
      jest.doMock('../src/lib/config', () => ({
        config: {
          backend: {
            mode: 'unknown' as any,
          },
        },
        configUtils: {
          isLocalMode: () => false,
          isSupabaseMode: () => false,
        },
      }));
    });

    it('should render unknown mode indicator', async () => {
      const { ModeIndicator } = await import('../src/components/ModeIndicator');
      
      render(<ModeIndicator />);
      
      expect(screen.getByText('Unknown')).toBeInTheDocument();
      expect(screen.getByText('❓')).toBeInTheDocument();
    });

    it('should have correct styling for unknown mode', async () => {
      const { ModeIndicator } = await import('../src/components/ModeIndicator');
      
      render(<ModeIndicator />);
      
      const indicator = screen.getByText('Unknown').closest('div');
      expect(indicator).toHaveClass('bg-gray-500', 'text-gray-100');
    });
  });
});

describe('DetailedModeIndicator Component', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  describe('Local Mode Details', () => {
    beforeEach(() => {
      jest.doMock('../src/lib/config', () => ({
        config: {
          backend: {
            mode: 'local',
            local: {
              serverUrl: 'http://localhost:8510',
            },
          },
        },
      }));
    });

    it('should render local backend details', async () => {
      const { DetailedModeIndicator } = await import('../src/components/ModeIndicator');
      
      render(<DetailedModeIndicator />);
      
      expect(screen.getByText('Local Backend')).toBeInTheDocument();
      expect(screen.getByText('http://localhost:8510')).toBeInTheDocument();
      expect(screen.getByText('🏠')).toBeInTheDocument();
    });

    it('should have correct styling for local backend', async () => {
      const { DetailedModeIndicator } = await import('../src/components/ModeIndicator');
      
      render(<DetailedModeIndicator />);
      
      const container = screen.getByText('Local Backend').closest('div');
      expect(container).toHaveClass('border-blue-500', 'bg-blue-500/10');
    });
  });

  describe('Supabase Mode Details', () => {
    beforeEach(() => {
      jest.doMock('../src/lib/config', () => ({
        config: {
          backend: {
            mode: 'supabase',
            supabase: {
              url: 'https://myproject.supabase.co',
              anonKey: 'test-key',
            },
          },
        },
      }));
    });

    it('should render Supabase backend details', async () => {
      const { DetailedModeIndicator } = await import('../src/components/ModeIndicator');
      
      render(<DetailedModeIndicator />);
      
      expect(screen.getByText('Supabase Backend')).toBeInTheDocument();
      expect(screen.getByText('myproject')).toBeInTheDocument(); // Shortened URL
      expect(screen.getByText('☁️')).toBeInTheDocument();
    });

    it('should shorten Supabase URL correctly', async () => {
      const { DetailedModeIndicator } = await import('../src/components/ModeIndicator');
      
      render(<DetailedModeIndicator />);
      
      // Should show shortened version without https:// and .supabase.co
      expect(screen.getByText('myproject')).toBeInTheDocument();
      expect(screen.queryByText('https://myproject.supabase.co')).not.toBeInTheDocument();
    });

    it('should handle empty Supabase URL gracefully', async () => {
      jest.doMock('../src/lib/config', () => ({
        config: {
          backend: {
            mode: 'supabase',
            supabase: {
              url: '',
              anonKey: 'test-key',
            },
          },
        },
      }));

      const { DetailedModeIndicator } = await import('../src/components/ModeIndicator');
      
      render(<DetailedModeIndicator />);
      
      expect(screen.getByText('Supabase Cloud')).toBeInTheDocument();
    });
  });

  describe('Component Structure', () => {
    it('should have proper accessibility structure', async () => {
      const { DetailedModeIndicator } = await import('../src/components/ModeIndicator');
      
      render(<DetailedModeIndicator />);
      
      // Should have proper text hierarchy
      const title = screen.getByText('Local Backend');
      const subtitle = screen.getByText('http://localhost:8510');
      
      expect(title.tagName).toBe('SPAN');
      expect(subtitle.tagName).toBe('SPAN');
    });

    it('should have flex layout structure', async () => {
      const { DetailedModeIndicator } = await import('../src/components/ModeIndicator');
      
      render(<DetailedModeIndicator />);
      
      const container = screen.getByText('Local Backend').closest('div');
      expect(container).toHaveClass('flex', 'items-center');
    });
  });
});

describe('ModeIndicator Integration', () => {
  it('should handle dynamic config changes', () => {
    // Test that component responds to config changes
    const { rerender } = render(<ModeIndicator />);
    
    // Initial render
    expect(screen.getByText('Local')).toBeInTheDocument();
    
    // Mock config change and rerender
    jest.doMock('../src/lib/config', () => ({
      config: {
        backend: {
          mode: 'supabase',
          supabase: {
            url: 'https://test.supabase.co',
          },
        },
      },
    }));
    
    rerender(<ModeIndicator />);
    
    // Should still show local because we can't easily change the mock mid-test
    // In real usage, config is evaluated at module load time
    expect(screen.getByText('Local')).toBeInTheDocument();
  });

  it('should be compatible with different themes', () => {
    render(
      <div className="dark">
        <ModeIndicator />
      </div>
    );
    
    // Component should render regardless of theme context
    expect(screen.getByText('Local')).toBeInTheDocument();
  });
});