import { config } from 'dotenv';
// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

import { getDb } from './index';
import { user, account, organization, member } from './schema';
import { randomUUID } from 'crypto';
import { hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';

/**
 * Hash password using bcryptjs (Better-Auth's default algorithm)
 */
async function hashPassword(password: string): Promise<string> {
  // Better-Auth uses bcryptjs with a cost factor of 10
  return hash(password, 10);
}

/**
 * Seed script to create a test user for development
 * 
 * Run with: npx tsx src/db/seed.ts
 * 
 * Test credentials:
 *   Email: test@focal.dev
 *   Password: password123
 */

async function seed() {
  console.log('🌱 Seeding database...\n');

  const db = getDb();

  // Test user details
  const testUserId = randomUUID();
  const testOrgId = randomUUID();
  const testAccountId = randomUUID();
  const testMemberId = randomUUID();

  // Hash password using scrypt (Better-Auth's default)
  const passwordHash = await hashPassword('password123');

  try {
    // Check if test user already exists and delete them to recreate with correct password
    const existingUser = await db.query.user.findFirst({
      where: (users, { eq }) => eq(users.email, 'test@focal.dev'),
    });

    if (existingUser) {
      console.log('🗑️  Removing existing test user to recreate with correct password hash...');
      await db.delete(account).where(eq(account.userId, existingUser.id));
      await db.delete(member).where(eq(member.userId, existingUser.id));
      await db.delete(user).where(eq(user.id, existingUser.id));
    }

    // Create test user
    await db.insert(user).values({
      id: testUserId,
      name: 'Test User',
      email: 'test@focal.dev',
      emailVerified: true,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('✅ Created test user');

    // Create credential account for email/password login
    await db.insert(account).values({
      id: testAccountId,
      accountId: testUserId,
      providerId: 'credential',
      userId: testUserId,
      accessToken: null,
      refreshToken: null,
      idToken: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      scope: null,
      password: passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('✅ Created credential account');

    // Check if organization already exists
    let orgId: string = testOrgId;
    const existingOrg = await db.query.organization.findFirst({
      where: (orgs, { eq }) => eq(orgs.slug, 'focal-demo'),
    });

    if (existingOrg) {
      console.log('✅ Using existing organization');
      orgId = existingOrg.id;
    } else {
      // Create test organization
      await db.insert(organization).values({
        id: testOrgId,
        name: 'Focal Demo',
        slug: 'focal-demo',
        logo: null,
        metadata: null,
        createdAt: new Date(),
      });
      console.log('✅ Created test organization');
    }

    // Add user as organization owner
    await db.insert(member).values({
      id: testMemberId,
      organizationId: orgId,
      userId: testUserId,
      role: 'owner',
      createdAt: new Date(),
    });

    console.log('✅ Added user to organization as owner');

    console.log('\n🎉 Seeding complete!\n');
    console.log('   Test Credentials:');
    console.log('   ─────────────────');
    console.log('   Email:    test@focal.dev');
    console.log('   Password: password123\n');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
