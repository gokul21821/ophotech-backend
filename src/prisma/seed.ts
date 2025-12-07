import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcryptjs from 'bcryptjs';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({
  connectionString: connectionString,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    // Hash password
    const hashedPassword = await bcryptjs.hash('password123', 10);

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        username: 'admin',
        password: hashedPassword,
        role: 'admin',
      },
    });

    console.log('✅ Admin user created:', adminUser.email);

    // Create sample newsletter
    const newsletter = await prisma.newsletter.create({
      data: {
        title: 'Welcome Newsletter',
        description: 'This is our first newsletter. Welcome to our community!',
        date: new Date(),
        authorId: adminUser.id,
      },
    });

    console.log('✅ Sample newsletter created:', newsletter.title);

  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  } finally {
    await pool.end();
    await prisma.$disconnect();
  }
}

main();