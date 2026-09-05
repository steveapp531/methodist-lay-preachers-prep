import fs from 'node:fs';
import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

let memoryServer = null;

/**
 * Resolve a connection string.
 *
 * Priority:
 *   1. MONGODB_URI (local mongod, Docker, or MongoDB Atlas)
 *   2. An embedded MongoDB with an on-disk data directory, so that a fresh
 *      clone runs with `npm install && npm run dev` and keeps its data.
 */
async function resolveUri() {
  if (env.MONGODB_URI && !env.USE_MEMORY_DB) return env.MONGODB_URI;
  if (env.MONGODB_URI && env.USE_MEMORY_DB) {
    logger.warn('USE_MEMORY_DB is set; ignoring MONGODB_URI and using the embedded database.');
  }

  if (env.isProd) {
    throw new Error('MONGODB_URI is required in production. The embedded database is for development only.');
  }

  let MongoMemoryServer;
  try {
    ({ MongoMemoryServer } = await import('mongodb-memory-server'));
  } catch {
    throw new Error(
      'No MONGODB_URI was provided and the embedded database is unavailable.\n' +
        'Either set MONGODB_URI in your .env file (MongoDB Atlas or a local mongod),\n' +
        'or install the optional dependency with: npm install mongodb-memory-server -w backend',
    );
  }

  fs.mkdirSync(env.MEMORY_DB_PATH, { recursive: true });
  logger.info(`Starting embedded MongoDB (data directory: ${env.MEMORY_DB_PATH})`);
  memoryServer = await MongoMemoryServer.create({
    instance: { dbName: 'mlpp', dbPath: env.MEMORY_DB_PATH, storageEngine: 'wiredTiger' },
  });
  return memoryServer.getUri('mlpp');
}

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  mongoose.set('strictQuery', true);
  const uri = await resolveUri();

  mongoose.connection.on('error', (err) => logger.error('MongoDB connection error', err));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000,
    maxPoolSize: 20,
    autoIndex: !env.isProd,
  });

  const { host, name } = mongoose.connection;
  logger.info(`MongoDB connected → ${host}/${name}`);
  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.connection.close();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

export { mongoose };
