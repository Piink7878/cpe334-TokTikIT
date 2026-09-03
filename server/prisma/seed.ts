import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Start seeding...');

    // 1. Seed Categories
    const categories = ['Account and Access', 'Hardware', 'Software', 'Network'];
    for (const name of categories) {
      await prisma.category.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      console.log(`Upserted Category: ${name}`);
    }

    // 2. Seed Related Systems
    const relatedSystems = [
      'Email',
      'Campus Wi-Fi',
      'VPN',
      'LEB2 App',
      'Grade Submission App',
      'Corporate Laptop',
    ];
    for (const name of relatedSystems) {
      await prisma.relatedSystem.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      console.log(`Upserted RelatedSystem: ${name}`);
    }

    // 3. Seed Development Requesters
    const requesters = [
      { name: 'Alice Active', email: 'alice@example.com', isActive: true },
      { name: 'Bob Active', email: 'bob@example.com', isActive: true },
      { name: 'Charlie Active', email: 'charlie@example.com', isActive: true },
      { name: 'Diana Active', email: 'diana@example.com', isActive: true },
      { name: 'Eve Inactive', email: 'eve@example.com', isActive: false },
    ];
    for (const requester of requesters) {
      await prisma.developmentRequester.upsert({
        where: { email: requester.email },
        update: {
          name: requester.name,
          isActive: requester.isActive,
        },
        create: {
          name: requester.name,
          email: requester.email,
          isActive: requester.isActive,
        },
      });
      console.log(`Upserted DevelopmentRequester: ${requester.name} (${requester.email})`);
    }

    console.log('Seeding finished.');
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
