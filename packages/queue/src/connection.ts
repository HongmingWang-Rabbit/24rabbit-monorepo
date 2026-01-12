import IORedis from 'ioredis';

let connection: IORedis | null = null;

export function getQueueConnection(): IORedis {
  if (!connection) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is required');
    }

    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    connection.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    connection.on('connect', () => {
      // Connection status logged for debugging
    });
  }

  return connection;
}

export async function closeQueueConnection(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = null;
  }
}
