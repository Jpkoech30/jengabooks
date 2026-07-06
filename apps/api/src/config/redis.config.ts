// Redis configuration — no longer used as a standalone NestJS config registration.
// Redis connections are managed ad-hoc in redis.health.ts and ai.queue.ts.
export default () => ({
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
});
