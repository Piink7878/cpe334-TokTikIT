import { PrismaClient, Role, Priority, Status } from '@prisma/client';
import bcrypt from 'bcryptjs';

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
    }
    console.log('Upserted Categories');

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
    }
    console.log('Upserted RelatedSystems');

    // 3. Seed Users
    // --- DEV ACCOUNT CREDENTIALS ---
    // All users share the same initial password: Password123!
    const passwordHash = await bcrypt.hash('Password123!', 10);

    const usersToSeed = [
      // Requesters (4 Active, 1 Inactive)
      { email: 'req1@toktikit.local', fullName: 'Requester One', role: Role.REQUESTER, isActive: true, mustChangePassword: true },
      { email: 'req2@toktikit.local', fullName: 'Requester Two', role: Role.REQUESTER, isActive: true, mustChangePassword: false },
      { email: 'req3@toktikit.local', fullName: 'Requester Three', role: Role.REQUESTER, isActive: true, mustChangePassword: false },
      { email: 'req4@toktikit.local', fullName: 'Requester Four', role: Role.REQUESTER, isActive: true, mustChangePassword: true },
      { email: 'req5_inactive@toktikit.local', fullName: 'Requester Inactive', role: Role.REQUESTER, isActive: false, mustChangePassword: false },

      // IT Staff (3 Active, 1 Inactive)
      { email: 'staff1@toktikit.local', fullName: 'IT Staff One', role: Role.IT_STAFF, isActive: true, mustChangePassword: true },
      { email: 'staff2@toktikit.local', fullName: 'IT Staff Two', role: Role.IT_STAFF, isActive: true, mustChangePassword: false },
      { email: 'staff3@toktikit.local', fullName: 'IT Staff Three', role: Role.IT_STAFF, isActive: true, mustChangePassword: false },
      { email: 'staff4_inactive@toktikit.local', fullName: 'IT Staff Inactive', role: Role.IT_STAFF, isActive: false, mustChangePassword: false },

      // Administrator (1 Active)
      { email: 'admin@toktikit.local', fullName: 'Admin User', role: Role.ADMIN, isActive: true, mustChangePassword: true },
    ];

    for (const u of usersToSeed) {
      await prisma.user.upsert({
        where: { email: u.email },
        update: {
          fullName: u.fullName,
          role: u.role,
          isActive: u.isActive,
          // We intentionally do not update the passwordHash to avoid resetting passwords for existing accounts on every seed
        },
        create: {
          email: u.email,
          fullName: u.fullName,
          role: u.role,
          isActive: u.isActive,
          passwordHash,
          mustChangePassword: u.mustChangePassword,
        },
      });
    }
    console.log('Upserted Users');

    // Fetch dependencies for tickets
    const catSoftware = await prisma.category.findUnique({ where: { name: 'Software' } });
    const catHardware = await prisma.category.findUnique({ where: { name: 'Hardware' } });
    const catNetwork = await prisma.category.findUnique({ where: { name: 'Network' } });
    const catAccount = await prisma.category.findUnique({ where: { name: 'Account and Access' } });

    const sysEmail = await prisma.relatedSystem.findUnique({ where: { name: 'Email' } });
    const sysWifi = await prisma.relatedSystem.findUnique({ where: { name: 'Campus Wi-Fi' } });
    const sysVpn = await prisma.relatedSystem.findUnique({ where: { name: 'VPN' } });

    const req1 = await prisma.user.findUnique({ where: { email: 'req1@toktikit.local' } });
    const req2 = await prisma.user.findUnique({ where: { email: 'req2@toktikit.local' } });
    const req3 = await prisma.user.findUnique({ where: { email: 'req3@toktikit.local' } });
    const staff1 = await prisma.user.findUnique({ where: { email: 'staff1@toktikit.local' } });
    const staff2 = await prisma.user.findUnique({ where: { email: 'staff2@toktikit.local' } });

    if (!catSoftware || !catHardware || !catNetwork || !catAccount || !sysEmail || !sysWifi || !sysVpn || !req1 || !req2 || !req3 || !staff1 || !staff2) {
      throw new Error('Required prerequisite records for tickets missing!');
    }

    // 4. Seed Tickets
    const ticketsToSeed = [
      {
        ticketNumber: 'TKT-1001',
        requesterId: req1.id,
        ownerId: staff1.id,
        categoryId: catSoftware.id,
        relatedSystemId: sysEmail.id,
        requestedPriority: Priority.HIGH,
        itPriority: Priority.HIGH,
        currentStatus: Status.IN_PROGRESS,
        summary: 'Cannot access Email',
        description: 'Getting a 500 error when logging into the email portal.',
      },
      {
        ticketNumber: 'TKT-1002',
        requesterId: req2.id,
        ownerId: null, // Unassigned
        categoryId: catHardware.id,
        relatedSystemId: sysWifi.id,
        requestedPriority: Priority.MEDIUM,
        itPriority: Priority.MEDIUM,
        currentStatus: Status.NEW,
        summary: 'Wi-Fi drops frequently',
        description: 'The Wi-Fi connection on my laptop keeps disconnecting every 5 minutes.',
      },
      {
        ticketNumber: 'TKT-1003',
        requesterId: req3.id,
        ownerId: staff2.id,
        categoryId: catAccount.id,
        relatedSystemId: sysVpn.id,
        requestedPriority: Priority.LOW,
        itPriority: Priority.LOW,
        currentStatus: Status.WAITING_FOR_REQUESTER,
        summary: 'Need VPN access renewed',
        description: 'My VPN access expires tomorrow. Can you please renew it?',
      },
      {
        ticketNumber: 'TKT-1004',
        requesterId: req1.id,
        ownerId: staff1.id,
        categoryId: catNetwork.id,
        relatedSystemId: sysWifi.id,
        requestedPriority: Priority.CRITICAL,
        itPriority: Priority.CRITICAL,
        currentStatus: Status.RESOLVED,
        summary: 'Lab 3 Router is down',
        description: 'The main router in Lab 3 is completely unresponsive.',
      }
    ];

    for (const t of ticketsToSeed) {
      await prisma.ticket.upsert({
        where: { ticketNumber: t.ticketNumber },
        update: {
          ownerId: t.ownerId,
          currentStatus: t.currentStatus,
          itPriority: t.itPriority,
        },
        create: t,
      });
    }
    console.log('Upserted Tickets');

    // 5. Seed Comments and Notes
    const tkt1 = await prisma.ticket.findUnique({ where: { ticketNumber: 'TKT-1001' } });
    if (tkt1) {
      const existingComments = await prisma.publicComment.count({ where: { ticketId: tkt1.id } });
      if (existingComments === 0) {
        await prisma.publicComment.create({
          data: {
            ticketId: tkt1.id,
            authorId: staff1.id,
            body: 'We are looking into the email server issues. Thank you for your patience.',
          },
        });
        await prisma.internalNote.create({
          data: {
            ticketId: tkt1.id,
            authorId: staff1.id,
            body: 'Found some error logs indicating the database connection pool is full. Rebooting nodes.',
          },
        });
        console.log('Inserted Comments and Notes for TKT-1001');
      }
    }
    
    const tkt3 = await prisma.ticket.findUnique({ where: { ticketNumber: 'TKT-1003' } });
    if (tkt3) {
      const existingComments = await prisma.publicComment.count({ where: { ticketId: tkt3.id } });
      if (existingComments === 0) {
        await prisma.publicComment.create({
          data: {
            ticketId: tkt3.id,
            authorId: staff2.id,
            body: 'Please provide the duration for the extension. Are we extending this for another semester or permanently?',
          },
        });
        console.log('Inserted Comments for TKT-1003');
      }
    }

    console.log('Seeding finished successfully.');
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
