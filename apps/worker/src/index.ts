import { getQueueConnection } from '@24rabbit/queue';

async function main() {
  console.log('🐰 24Rabbit Worker starting...');

  const connection = getQueueConnection();

  // TODO: Initialize BullMQ workers for:
  // - publish: Handle content publishing jobs
  // - schedule: Handle scheduled content generation
  // - analytics: Handle analytics collection

  console.log('✅ Worker initialized and ready to process jobs');

  // Keep the process running
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    await connection.quit();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Worker failed to start:', error);
  process.exit(1);
});
