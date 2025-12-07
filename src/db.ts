import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create a connection pool
const pool = new Pool({
  connectionString: connectionString,
  max: 20, // Maximum number of connections
});

// Create Prisma Client with PostgreSQL adapter
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export default prisma;