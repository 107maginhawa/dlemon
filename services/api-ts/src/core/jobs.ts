/**
 * Minimal Job Scheduler Interface
 * Provides a thin abstraction layer over pg-boss for background job processing
 * Uses existing Drizzle database connection to avoid additional connection pools
 */

import PgBoss from 'pg-boss';
import type { Logger } from '@/types/logger';
import type { DatabaseInstance } from './database';

// ============================================================================
// Public Interface (Provider-agnostic)
// ============================================================================

/**
 * Configuration for cron jobs
 */
export interface CronJobConfig {
  schedule: string;
  timezone?: string;
  retryLimit?: number;
}

/**
 * Configuration for interval jobs
 */
export interface IntervalJobConfig {
  intervalMinutes: number;
  retryLimit?: number;
}

/**
 * Minimal job scheduler interface
 * Exposes only the essential features needed for the application
 */
export interface JobScheduler {
  // Job registration
  registerCron(name: string, pattern: string, handler: JobHandler): void;
  registerInterval(name: string, intervalMs: number, handler: JobHandler): void;
  registerDelayed(name: string, delayMs: number, handler: JobHandler): void;

  // Lifecycle management
  start(): Promise<void>;
  shutdown(): Promise<void>;

  // Job operations
  // `data` accepts any structured payload object (typed event-payload
  // interfaces included); it is JSON-serialized onto the queue and surfaces
  // as JobContext.data (Record<string, unknown>) for handlers to narrow.
  trigger(name: string, data?: object): Promise<string>;
  cancel(jobId: string): Promise<void>;

  // Monitoring
  getHealth(): Promise<JobHealth>;
  getQueueSize(name: string): Promise<number>;
}

/**
 * Context passed to job handlers
 * Provides access to database and logging
 */
export interface JobContext {
  db: DatabaseInstance;
  logger: Logger;
  jobId: string;
  jobName: string;
  data?: Record<string, unknown>;
}

/**
 * Job handler function type
 */
export type JobHandler = (context: JobContext) => Promise<void>;

/**
 * Job health status
 */
export interface JobHealth {
  healthy: boolean;
  queueSize?: number;
  failedCount?: number;
  completedCount?: number;
}

// ============================================================================
// pg-boss Tuning Helper
// ============================================================================

/**
 * Resolve pg-boss constructor tuning values based on the runtime environment.
 *
 * Test runs (NODE_ENV=test) need fast cleanup/expiry so the contract and
 * integration suites don't wait minutes per scenario. Production must use
 * sane long-horizon values — the slot generator schedules work on a 30-day
 * horizon and would otherwise be force-expired at 5 minutes.
 */
export function resolvePgBossTuning(nodeEnv: string | undefined) {
  const isTest = nodeEnv === 'test';
  return isTest
    ? {
        deleteAfterDays: 1,
        archiveCompletedAfterSeconds: 300, // 5 min — fast test loop
        retryLimit: 2,
        retryDelay: 5,
        expireInMinutes: 5,
        maintenanceIntervalSeconds: 10,
      }
    : {
        deleteAfterDays: 30,
        archiveCompletedAfterSeconds: 12 * 60 * 60, // 12 h
        retryLimit: 3,
        retryDelay: 30,
        expireInMinutes: 15,
        maintenanceIntervalSeconds: 120,
      };
}

// ============================================================================
// pg-boss Implementation
// ============================================================================

/**
 * pg-boss implementation of JobScheduler interface
 * Wraps pg-boss functionality behind our minimal interface
 */
class PgBossScheduler implements JobScheduler {
  private boss: PgBoss;
  private db: DatabaseInstance;
  private logger: Logger;
  private handlers = new Map<string, JobHandler>();
  private cronJobs = new Map<string, CronJobConfig>(); // name -> config
  private intervalJobs = new Map<string, IntervalJobConfig>(); // name -> config
  private createdQueues = new Set<string>(); // Track created queues to prevent deadlocks
  private jobIdToQueueName = new Map<string, string>(); // Track job ID to queue name mapping
  private fastIntervalTimers = new Map<string, NodeJS.Timeout>(); // Sub-minute intervals via setInterval
  private isStarted = false;
  
  constructor(db: DatabaseInstance, logger: Logger) {
    this.db = db;
    this.logger = logger;
    
    // Extract the underlying pg.Pool from Drizzle
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle NodePgDatabase does not expose $client in its type; runtime access only
    const pool = (db as any).$client;
    if (!pool) {
      throw new Error('Unable to access pg.Pool from Drizzle instance');
    }
    
    // Create an adapter that pg-boss expects
    const pgBossDb = {
      executeSql: async (text: string, values?: unknown[]) => {
        return await pool.query(text, values);
      }
    };

    // Select pg-boss tuning values for the current runtime environment.
    // Test runs keep fast values so the contract/integration suites stay quick;
    // everything else uses production-safe long-horizon defaults.
    const bossTuning = resolvePgBossTuning(process.env['NODE_ENV']);

    // Initialize pg-boss with the adapter
    this.boss = new PgBoss({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pg-boss db adapter type is not publicly exported
      db: pgBossDb as any,
      schema: 'pgboss', // Isolate pg-boss tables in their own schema
      retryBackoff: true, // exponential backoff
      ...bossTuning,
    });
  }
  
  
  /**
   * Register a cron job
   */
  registerCron(name: string, pattern: string, handler: JobHandler): void {
    this.handlers.set(name, handler);
    this.cronJobs.set(name, {
      schedule: pattern,
      timezone: 'UTC',
      retryLimit: 3
    });

    // If scheduler is already started, setup this job immediately
    if (this.isStarted && !this.createdQueues.has(name)) {
      this.setupSingleJob(name, handler);
    }

    this.logger.debug(`Registered cron job: ${name} with pattern: ${pattern}`);
  }
  
  /**
   * Register an interval job.
   *
   * pg-boss schedules cron-style at minute granularity, so sub-minute
   * intervals fall back to a plain setInterval driving the handler
   * directly. This is correct for single-instance deploys and
   * essential for the contract test suite (auth-email round-trips
   * would otherwise wait up to 60s per scenario).
   */
  registerInterval(name: string, intervalMs: number, handler: JobHandler): void {
    this.handlers.set(name, handler);

    if (intervalMs < 60000) {
      // Sub-minute: drive via setInterval
      this.intervalJobs.set(name, { intervalMinutes: 0, retryLimit: 3 });
      const startTimer = () => {
        if (this.fastIntervalTimers.has(name)) return;
        const timer = setInterval(() => {
          handler({
            db: this.db,
            logger: this.logger,
            jobName: name,
            jobId: `${name}-${Date.now()}`,
            data: undefined,
          }).catch((error) => {
            this.logger.error({ error, jobName: name }, 'Fast-interval job handler threw');
          });
        }, intervalMs);
        // Don't keep the event loop alive solely for this timer.
        if (typeof timer.unref === 'function') timer.unref();
        this.fastIntervalTimers.set(name, timer);
      };
      if (this.isStarted) {
        startTimer();
      } else {
        // Will be started when start() runs
        this.intervalJobs.set(name, { intervalMinutes: 0, retryLimit: 3 });
        // Defer registration until start() — see start() below.
        this.fastIntervalTimers.set(name, setTimeout(() => {}, 0));
        clearTimeout(this.fastIntervalTimers.get(name)!);
        this.fastIntervalTimers.delete(name);
        // Stash the start function for later via a closure on the map entry.
        // Simpler: just kick off immediately; the handler must guard against
        // being called before start() if it cares.
        startTimer();
      }
      this.logger.debug(`Registered fast-interval job: ${name} every ${intervalMs}ms (setInterval)`);
      return;
    }

    const intervalMinutes = Math.max(1, Math.floor(intervalMs / (1000 * 60)));
    this.intervalJobs.set(name, {
      intervalMinutes,
      retryLimit: 3
    });

    // If scheduler is already started, setup this job immediately
    if (this.isStarted && !this.createdQueues.has(name)) {
      this.setupSingleJob(name, handler);
    }

    this.logger.debug(`Registered interval job: ${name} every ${intervalMs}ms (${intervalMinutes} minutes)`);
  }
  
  /**
   * Register a delayed job (one-time execution after delay)
   */
  registerDelayed(name: string, delayMs: number, handler: JobHandler): void {
    this.handlers.set(name, handler);
    
    // If scheduler is already started, setup this job immediately
    if (this.isStarted && !this.createdQueues.has(name)) {
      this.setupSingleJob(name, handler);
    }
    
    // Delayed jobs are handled differently - they're sent with a delay when triggered
    this.logger.debug(`Registered delayed job: ${name} with delay ${delayMs}ms`);
  }
  
  /**
   * Start the job scheduler
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn('Job scheduler already started');
      return;
    }
    
    try {
      // Start pg-boss (this handles restarts automatically)
      await this.boss.start();
      this.isStarted = true;
      this.logger.debug('pg-boss started successfully');
      
      // Create queues and register workers for all registered handlers
      await this.setupAllJobs();
      
      // Schedule cron jobs
      for (const [name, config] of this.cronJobs) {
        try {
          await this.boss.schedule(name, config.schedule, {}, {
            tz: config.timezone || 'UTC',
            retryLimit: config.retryLimit || 3
          });
          this.logger.info(`Scheduled cron job: ${name} with pattern: ${config.schedule}`);
        } catch (error) {
          this.logger.error({ error, jobName: name, config }, 'Failed to schedule cron job');
          // Don't fail startup for scheduling errors - job can still be triggered manually
        }
      }
      
      // Schedule interval jobs (cron-style, minute granularity)
      for (const [name, config] of this.intervalJobs) {
        // intervalMinutes === 0 marks a fast-interval job that runs via
        // setInterval — already started in registerInterval, skip pg-boss.
        if (config.intervalMinutes === 0) continue;

        try {
          const cronPattern = `*/${config.intervalMinutes} * * * *`;
          await this.boss.schedule(name, cronPattern, {}, {
            retryLimit: config.retryLimit || 3
          });
          this.logger.info(`Scheduled interval job: ${name} every ${config.intervalMinutes} minutes`);
        } catch (error) {
          this.logger.error({ error, jobName: name, config }, 'Failed to schedule interval job');
          // Don't fail startup for scheduling errors - job can still be triggered manually
        }
      }
      
      // Allow workers to fully initialize (increased for better reliability)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.logger.info(`Job scheduler started with ${this.handlers.size} jobs and workers ready`);
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to start job scheduler');
      throw error;
    }
  }
  
  /**
   * Setup a single job (queue + worker) - used for late registrations
   */
  private async setupSingleJob(name: string, handler: JobHandler): Promise<void> {
    try {
      this.logger.debug(`Setting up late-registered job: ${name}`);
      
      // Create queue if it doesn't exist
      if (!this.createdQueues.has(name)) {
        await this.boss.createQueue(name);
        this.createdQueues.add(name);
        this.logger.debug(`Created queue: ${name} (late registration)`);
        
        // Allow queue to initialize in pg-boss
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Verify queue was created successfully
      if (!this.createdQueues.has(name)) {
        throw new Error(`Queue ${name} was not created successfully`);
      }
      
      // Register worker
      await this.boss.work(name, { pollingIntervalSeconds: 0.5 }, async (jobs) => {
        const job = Array.isArray(jobs) ? jobs[0] : jobs;
        
        if (!job) {
          this.logger.warn({ job: name }, 'No job data received');
          return;
        }
        
        const context: JobContext = {
          db: this.db,
          logger: this.logger.child({ job: name, jobId: job.id }),
          jobId: job.id,
          jobName: name,
          data: job.data as Record<string, unknown>,
        };
        
        try {
          await handler(context);
          this.logger.debug({ job: name, jobId: job.id }, 'Job completed successfully');
        } catch (error) {
          this.logger.error({ job: name, jobId: job.id, error }, 'Job handler error');
          throw error;
        }
      });
      
      // Allow worker to fully initialize
      await new Promise(resolve => setTimeout(resolve, 300));
      
      this.logger.debug(`Successfully registered worker for job: ${name} (late registration)`);
    } catch (error) {
      this.logger.error({ error, jobName: name }, 'Failed to setup late-registered job');
      // Remove from tracking if setup failed
      this.createdQueues.delete(name);
      throw error;
    }
  }
  
  /**
   * Setup all registered jobs (queues + workers) - called during start and for late registrations
   */
  private async setupAllJobs(): Promise<void> {
    // Phase 1: Create ALL queues first before any worker registration
    for (const [name] of this.handlers) {
      if (!this.createdQueues.has(name)) {
        try {
          await this.boss.createQueue(name);
          this.createdQueues.add(name);
          this.logger.debug(`Created queue: ${name}`);
        } catch (error) {
          // Log error but don't fail startup - queue might already exist
          this.logger.debug({ error, jobName: name }, 'Queue creation failed, assuming it exists');
          this.createdQueues.add(name); // Assume it exists to avoid retry
        }
      }
    }
    
    // Allow queues to fully initialize in pg-boss
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Phase 2: Register workers only after all queues are created
    for (const [name, handler] of this.handlers) {
      if (!this.createdQueues.has(name)) {
        this.logger.warn(`Skipping worker registration for ${name} - queue creation failed`);
        continue; // Skip if queue creation failed
      }
      
      try {
        await this.boss.work(name, { pollingIntervalSeconds: 0.5 }, async (jobs) => {
          // pg-boss passes jobs as an array, even for single jobs
          const job = Array.isArray(jobs) ? jobs[0] : jobs;
          
          if (!job) {
            this.logger.warn({ job: name }, 'No job data received');
            return;
          }
          
          const context: JobContext = {
            db: this.db,
            logger: this.logger.child({ job: name, jobId: job.id }),
            jobId: job.id,
            jobName: name,
            data: job.data as Record<string, unknown>,
          };
          
          try {
            await handler(context);
            this.logger.debug({ job: name, jobId: job.id }, 'Job completed successfully');
          } catch (error) {
            this.logger.error({ job: name, jobId: job.id, error }, 'Job handler error');
            throw error; // Let pg-boss handle retry logic
          }
        });
        
        this.logger.debug(`Registered worker for: ${name}`);
      } catch (error) {
        this.logger.error({ error, jobName: name }, `Failed to register worker for: ${name}`);
      }
    }
    
    // Allow workers to fully initialize
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  /**
   * Shutdown the job scheduler gracefully
   */
  async shutdown(): Promise<void> {
    if (!this.isStarted) {
      this.logger.warn('Job scheduler not started');
      return;
    }
    
    try {
      this.logger.debug('Shutting down job scheduler...');

      // Clear sub-minute setInterval timers first.
      for (const [, timer] of this.fastIntervalTimers) {
        clearInterval(timer);
      }
      this.fastIntervalTimers.clear();

      await this.boss.stop({
        graceful: true,
        timeout: 30000, // 30 seconds timeout for graceful shutdown
      });

      // Clear tracking to allow proper restart
      this.createdQueues.clear();
      this.jobIdToQueueName.clear();
      this.isStarted = false;
      
      this.logger.debug('Job scheduler shut down successfully');
    } catch (error) {
      this.logger.error({ error }, 'Error shutting down job scheduler');
      // Clear state even if shutdown failed
      this.createdQueues.clear();
      this.jobIdToQueueName.clear();
      this.isStarted = false;
      throw error;
    }
  }
  
  /**
   * Verify that a queue and its worker are ready for job processing
   */
  private async verifyQueueReady(name: string): Promise<boolean> {
    try {
      // Check if queue exists in our tracking
      if (!this.createdQueues.has(name)) {
        this.logger.warn(`Queue ${name} not found in createdQueues tracking`);
        return false;
      }
      
      // Try to get queue size as a readiness check
      const queueSize = await this.boss.getQueueSize(name);
      return queueSize !== undefined;
    } catch (error) {
      this.logger.warn({ error, queueName: name }, 'Queue readiness check failed');
      return false;
    }
  }
  
  /**
   * Manually trigger a job
   */
  async trigger(name: string, data?: object): Promise<string> {
    if (!this.isStarted) {
      throw new Error('Job scheduler not started');
    }
    
    // If queue doesn't exist, create it now (late registration support)
    if (!this.createdQueues.has(name)) {
      this.logger.warn(`Queue ${name} not found, creating now (late registration)`);
      const handler = this.handlers.get(name);
      if (handler) {
        await this.setupSingleJob(name, handler);
        // Give additional time for worker registration
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        throw new Error(`No handler found for job ${name}`);
      }
    }
    
    // Verify queue readiness before attempting to send
    const isReady = await this.verifyQueueReady(name);
    if (!isReady) {
      this.logger.warn(`Queue ${name} not ready, attempting to refresh`);
      // Small delay and retry once
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    try {
      const jobId = await this.boss.send(name, data || {});
      
      if (!jobId) {
        throw new Error(`Failed to trigger job ${name}: send() returned null`);
      }
      
      // Track the job ID to queue name mapping for cancel support
      this.jobIdToQueueName.set(String(jobId), name);
      
      this.logger.debug(`Triggered job: ${name} with id: ${jobId}`);
      return String(jobId); // Ensure we return a string
    } catch (error) {
      this.logger.error({ error, jobName: name }, `Failed to trigger job: ${name}`);
      throw error;
    }
  }
  
  /**
   * Cancel a job
   */
  async cancel(jobId: string): Promise<void> {
    if (!this.isStarted) {
      throw new Error('Job scheduler not started');
    }
    
    if (!jobId) {
      throw new Error(`Invalid jobId provided to cancel: ${jobId}`);
    }
    
    // Get the queue name for this job ID
    const queueName = this.jobIdToQueueName.get(jobId);
    if (!queueName) {
      // If we don't have the mapping, we can't cancel the job
      // This might happen for jobs triggered before this mapping was added
      throw new Error(`Cannot find queue name for job ${jobId}. Job might have been triggered before tracking was enabled.`);
    }
    
    // pg-boss cancel requires queue name and job ID
    await this.boss.cancel(queueName, jobId);
    
    // Clean up the mapping
    this.jobIdToQueueName.delete(jobId);
    
    this.logger.debug(`Cancelled job: ${jobId} from queue: ${queueName}`);
  }
  
  /**
   * Get health status of the job system
   */
  async getHealth(): Promise<JobHealth> {
    if (!this.isStarted) {
      return { healthy: false };
    }
    
    try {
      // Get general health metrics
      // pg-boss doesn't have generic getQueueSize(), so we'll just return healthy: true
      // Individual queue sizes would require specific queue names
      return {
        healthy: true,
        queueSize: 0, // Would need specific queue name to get size
        failedCount: 0, // Would need to query failed jobs
        completedCount: 0, // Would need to query completed jobs
      };
    } catch (error) {
      this.logger.error({ error }, 'Error getting job health');
      return { healthy: false };
    }
  }
  
  /**
   * Get queue size for a specific queue
   */
  async getQueueSize(name: string): Promise<number> {
    if (!this.isStarted) {
      throw new Error('Job scheduler not started');
    }
    
    try {
      const size = await this.boss.getQueueSize(name);
      return size || 0;
    } catch (error) {
      this.logger.error({ error, queueName: name }, 'Error getting queue size');
      throw error;
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a job scheduler instance
 * Returns the minimal interface, hiding implementation details
 */
export function createJobScheduler(db: DatabaseInstance, logger: Logger): JobScheduler {
  // Currently uses pg-boss, but can be swapped for another implementation
  // without changing consumer code
  return new PgBossScheduler(db, logger);
}