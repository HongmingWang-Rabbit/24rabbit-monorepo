// Set up test environment variables before any modules are imported
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/test_db';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.ENCRYPTION_KEY = '0'.repeat(64); // 32 bytes hex
process.env.GEMINI_API_KEY = 'test-api-key';
process.env.R2_ACCESS_KEY_ID = 'test-access-key';
process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.R2_BUCKET_NAME = 'test-bucket';
process.env.R2_ENDPOINT = 'http://localhost:9000';
process.env.R2_PUBLIC_URL = 'http://localhost:9000/test-bucket';
