/**
 * Configuration management for Monobase API
 * Parses environment variables into a typed configuration object
 */

import type { AuthConfig } from '@/types/auth';
import { DEFAULT_ICE_SERVERS, parseIceServerUrls, type IceServer } from '@/utils/webrtc';
import type { DatabaseConfig } from './database';
import type { StorageConfig } from './storage';
import type { EmailConfig } from './email';
import type { NotificationConfig } from './notifs';
import type { BillingConfig } from './billing';

export interface Config {
  // Server configuration
  server: {
    host: string;
    port: number;
    publicUrl?: string;
    internalServiceToken: string;
    internalServiceExpandEnabled: boolean;
    emrTenantEnabled: boolean;
  };
  
  // Database configuration
  database: DatabaseConfig;
  
  // CORS configuration
  cors: {
    origins: string[];
    credentials: boolean;
    allowLocalNetwork: boolean;
    allowTunneling: boolean;
    strict: boolean;
  };
  
  // Logging configuration
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    pretty: boolean;
  };
  
  // Authentication configuration
  auth: AuthConfig;
  
  // Rate limiting configuration
  rateLimit: {
    enabled: boolean;
    max: number;
  };
  
  // Storage configuration
  storage: StorageConfig;
  
  // Email configuration
  email: EmailConfig;

  // Notification configuration
  notifs: NotificationConfig;

  // Billing configuration
  billing: BillingConfig;

  // WebRTC configuration
  webrtc: {
    iceServers: IceServer[];
  };

  // Feature flags
  features: {
    // P1-10: kill-switch for AI / auto cephalometric landmark detection.
    // OFF by default — the detect endpoint hard-returns 403 FEATURE_DISABLED
    // so the feature can be turned off without a deploy if accuracy /
    // regulatory issues surface. Enable with DENTAL_IMAGING_AUTO_LANDMARK=true.
    dentalImagingAutoLandmark: boolean;
  };
}

/**
 * Parse configuration from environment variables
 * Provides sensible defaults for development
 */
export function parseConfig(): Config {
  // Helper function to parse comma-separated lists
  const parseList = (value: string | undefined, defaultList: string[]): string[] => {
    if (!value) return defaultList;
    return value.split(',').map(s => s.trim()).filter(Boolean);
  };

  // Helper function to parse boolean values
  const parseBool = (value: string | undefined, defaultValue: boolean): boolean => {
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true';
  };

  // Helper function to parse integer values
  const parseIntValue = (value: string | undefined, defaultValue: number): number => {
    if (!value) return defaultValue;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? defaultValue : parsed;
  };

  // Helper function to parse log level
  const parseLogLevel = (value: string | undefined): Config['logging']['level'] => {
    const validLevels: Config['logging']['level'][] = ['debug', 'info', 'warn', 'error'];
    const level = value?.toLowerCase();
    return validLevels.includes(level as any) ? level as Config['logging']['level'] : 'info';
  };

  // Parse server configuration
  const serverPort = parseIntValue(process.env['SERVER_PORT'] || process.env['PORT'], 7213);
  const serverHost = process.env['SERVER_HOST'] || '0.0.0.0';
  const publicUrl = process.env['SERVER_PUBLIC_URL'] || process.env['PUBLIC_URL'];

  const config: Config = {
    // Server configuration
    server: {
      host: serverHost,
      port: serverPort,
      publicUrl,
      internalServiceToken: process.env['INTERNAL_SERVICE_TOKEN'] || crypto.randomUUID(),
      internalServiceExpandEnabled: parseBool(process.env['INTERNAL_SERVICE_EXPAND_ENABLED'], false),
      emrTenantEnabled: parseBool(process.env['EMR_TENANT_ENABLED'], true),
    },
    
    // Database configuration (dialect auto-detected from URL)
    database: {
      url: process.env['DATABASE_URL'] || 'postgres://postgres:password@localhost:5432/monobase',
      poolMin: parseIntValue(process.env['DB_POOL_MIN'], 2),
      poolMax: parseIntValue(process.env['DB_POOL_MAX'], 20),
      idleTimeoutMs: parseIntValue(process.env['DB_IDLE_TIMEOUT'], 30000),
      ssl: parseBool(process.env['DB_SSL'], false),
      logging: parseBool(process.env['DB_LOGGING'], false),
      // V-DG-001: PHI at-rest encryption attestation. The control is storage-
      // layer (transparent disk/volume / managed-Postgres storage) encryption,
      // NOT column-level. Operators attest it is in force via
      // DB_AT_REST_ENCRYPTION=enabled|verified; anything else parses to
      // 'unverified' and the production guard below refuses to start.
      atRestEncryption: ((): 'enabled' | 'verified' | 'unverified' => {
        const v = process.env['DB_AT_REST_ENCRYPTION']?.toLowerCase();
        return v === 'enabled' || v === 'verified' ? v : 'unverified';
      })(),
    },
    
    // CORS configuration — prod defaults are restrictive; dev defaults are permissive.
    cors: {
      origins: parseList(process.env['CORS_ORIGINS'], process.env['NODE_ENV'] === 'production' ? [] : ['*']),
      credentials: parseBool(process.env['CORS_CREDENTIALS'], true),
      allowLocalNetwork: parseBool(process.env['CORS_ALLOW_LOCAL_NETWORK'], process.env['NODE_ENV'] !== 'production'),
      allowTunneling: parseBool(process.env['CORS_ALLOW_TUNNELING'], process.env['NODE_ENV'] !== 'production'),
      strict: parseBool(process.env['CORS_STRICT'], process.env['NODE_ENV'] === 'production'),
    },
    
    // Logging configuration
    logging: {
      level: parseLogLevel(process.env['LOG_LEVEL']),
      pretty: parseBool(process.env['LOG_PRETTY'], true),
    },
    
    // Authentication configuration
    auth: {
      baseUrl: process.env['AUTH_BASE_URL'] || publicUrl || `http://${serverHost}:${serverPort}`,
      secret: process.env['AUTH_SECRET'] || 'development-secret-change-in-production-' + Math.random(),
      sessionExpiresIn: parseIntValue(process.env['AUTH_SESSION_EXPIRES_IN'], 60 * 60 * 24 * 7), // 7 days
      rateLimitEnabled: parseBool(process.env['AUTH_RATE_LIMIT_ENABLED'], true),
      rateLimitWindow: parseIntValue(process.env['AUTH_RATE_LIMIT_WINDOW'], 60), // 1 minute
      rateLimitMax: parseIntValue(process.env['AUTH_RATE_LIMIT_MAX'], 10), // 10 attempts
      adminEmails: parseList(process.env['AUTH_ADMIN_EMAILS'], []),
      // T-002: require a verified email before sign-in. Safe-by-default in production;
      // off in dev/test so immediate sign-in (seeds, local, CI) keeps working.
      // Override anywhere with AUTH_REQUIRE_EMAIL_VERIFICATION.
      requireEmailVerification: parseBool(
        process.env['AUTH_REQUIRE_EMAIL_VERIFICATION'],
        process.env['NODE_ENV'] === 'production',
      ),
      socialProviders: {
        google: process.env['GOOGLE_CLIENT_ID'] && process.env['GOOGLE_CLIENT_SECRET'] ? {
          clientId: process.env['GOOGLE_CLIENT_ID'],
          clientSecret: process.env['GOOGLE_CLIENT_SECRET'],
        } : undefined,
      },
    },
    
    // Rate limiting configuration
    rateLimit: {
      enabled: parseBool(process.env['RATE_LIMIT_ENABLED'], true),
      max: parseIntValue(process.env['RATE_LIMIT_MAX'], 100),
    },
    
    // Storage configuration
    storage: {
      provider: (process.env['STORAGE_PROVIDER'] as 'minio' | 's3') || 'minio',
      endpoint: process.env['STORAGE_ENDPOINT'] || 'http://localhost:9000', // Default to localhost for development
      publicEndpoint: process.env['STORAGE_PUBLIC_ENDPOINT'] || 'http://localhost:9000', // External URL for presigned URLs
      bucket: process.env['STORAGE_BUCKET'] || 'monobase-files',
      region: process.env['STORAGE_REGION'] || 'us-east-1',
      credentials: {
        accessKeyId: process.env['STORAGE_ACCESS_KEY_ID'] || 'minioadmin',
        secretAccessKey: process.env['STORAGE_SECRET_ACCESS_KEY'] || 'minioadmin',
      },
      uploadUrlExpiry: parseIntValue(process.env['STORAGE_UPLOAD_URL_EXPIRY'] || '300', 300), // 5 minutes
      downloadUrlExpiry: parseIntValue(process.env['STORAGE_DOWNLOAD_URL_EXPIRY'] || '900', 900), // 15 minutes
    },
    
    // Email configuration
    email: {
      provider: (process.env['EMAIL_PROVIDER'] as 'smtp' | 'postmark' | 'onesignal') || 'smtp',
      from: {
        name: process.env['EMAIL_FROM_NAME'] || 'Monobase',
        email: process.env['EMAIL_FROM_EMAIL'] || 'noreply@monobase.com'
      },
      smtp: {
        host: process.env['SMTP_HOST'] || '127.0.0.1',
        port: parseIntValue(process.env['SMTP_PORT'] || '1025', 1025),
        secure: parseBool(process.env['SMTP_SECURE'], false),
        auth: {
          user: process.env['SMTP_USER'] || '',
          pass: process.env['SMTP_PASS'] || ''
        }
      },
      postmark: process.env['POSTMARK_API_KEY'] ? {
        apiKey: process.env['POSTMARK_API_KEY'],
        messageStream: process.env['POSTMARK_MESSAGE_STREAM'] || 'outbound'
      } : undefined,
      onesignal: process.env['ONESIGNAL_APP_ID'] && process.env['ONESIGNAL_API_KEY'] ? {
        appId: process.env['ONESIGNAL_APP_ID'],
        apiKey: process.env['ONESIGNAL_API_KEY']
      } : undefined
    },

    // Notification configuration
    notifs: {
      provider: 'onesignal',
      onesignal: process.env['ONESIGNAL_APP_ID'] && process.env['ONESIGNAL_API_KEY'] ? {
        appId: process.env['ONESIGNAL_APP_ID'],
        apiKey: process.env['ONESIGNAL_API_KEY']
      } : undefined
    },

    // Billing configuration
    billing: {
      provider: 'stripe',
      stripe: {
        secretKey: process.env['STRIPE_SECRET_KEY'],
        webhookSecret: process.env['STRIPE_WEBHOOK_SECRET'],
        url: process.env['STRIPE_URL'], // For testing with mock Stripe service
      },
      taxRatePct: (() => {
        const v = process.env['TAX_RATE_PCT'];
        if (!v) return 0;
        const parsed = parseFloat(v);
        return isNaN(parsed) ? 0 : parsed;
      })(),
      platformFeePct: (() => {
        const v = process.env['PLATFORM_FEE_PCT'];
        if (!v) return 0;
        const parsed = parseFloat(v);
        return isNaN(parsed) ? 0 : parsed;
      })(),
    },

    // WebRTC configuration
    webrtc: {
      iceServers: process.env['WEBRTC_ICE_SERVERS']
        ? parseIceServerUrls(process.env['WEBRTC_ICE_SERVERS'])
        : DEFAULT_ICE_SERVERS
    },

    // Feature flags
    features: {
      // P1-10 AI landmarking kill-switch — OFF by default.
      dentalImagingAutoLandmark: parseBool(process.env['DENTAL_IMAGING_AUTO_LANDMARK'], false),
    },
  };

  if (process.env['NODE_ENV'] === 'production') {
    const weak: string[] = [];
    if (!process.env['AUTH_SECRET'] || process.env['AUTH_SECRET'].length < 32) {
      weak.push('AUTH_SECRET (must be set and ≥32 chars)');
    }
    if (!process.env['INTERNAL_SERVICE_TOKEN'] || process.env['INTERNAL_SERVICE_TOKEN'].length < 32) {
      weak.push('INTERNAL_SERVICE_TOKEN (must be set and ≥32 chars)');
    }
    // Reject insecure infra credential defaults — minioadmin/postgres-password must
    // not reach production. Operators must set real credentials via environment.
    if (!process.env['DATABASE_URL'] || process.env['DATABASE_URL'].includes('postgres:password@localhost')) {
      weak.push('DATABASE_URL (must not use the default localhost/password URL)');
    }
    if (!process.env['STORAGE_ACCESS_KEY_ID'] || process.env['STORAGE_ACCESS_KEY_ID'] === 'minioadmin') {
      weak.push('STORAGE_ACCESS_KEY_ID (must not use the default "minioadmin")');
    }
    if (!process.env['STORAGE_SECRET_ACCESS_KEY'] || process.env['STORAGE_SECRET_ACCESS_KEY'] === 'minioadmin') {
      weak.push('STORAGE_SECRET_ACCESS_KEY (must not use the default "minioadmin")');
    }
    // V-DG-001: PHI at-rest encryption control must be attested in production.
    // The control is storage-layer (transparent disk/volume) encryption; the
    // operator attests it is provisioned/verified via DB_AT_REST_ENCRYPTION.
    // Refusing to start when unattested makes the §1 "Yes (at rest)" claim a
    // deterministic, non-regressable startup invariant (DATA_GOVERNANCE §2/§7).
    if (config.database.atRestEncryption !== 'enabled' && config.database.atRestEncryption !== 'verified') {
      weak.push(
        'DB_AT_REST_ENCRYPTION (must be "enabled" or "verified" — attest the ' +
          'database volume / managed storage is encrypted at rest)',
      );
    }
    if (weak.length > 0) {
      throw new Error(
        `[config] Production start refused — missing or weak secrets/credentials:\n  ${weak.join('\n  ')}\n` +
        `Secrets: openssl rand -base64 32 | Storage/DB: set real credentials via env`
      );
    }
  } else {
    if (!process.env['AUTH_SECRET']) {
      console.warn('[config] AUTH_SECRET not set — using insecure random fallback. Set it before going to production.');
    }
    if (!process.env['INTERNAL_SERVICE_TOKEN']) {
      console.warn('[config] INTERNAL_SERVICE_TOKEN not set — random per-boot fallback. Set it before going to production.');
    }
  }

  return config;
}
