const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function createSuperAdmins() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    console.log('Connecting to MongoDB Atlas...');
    await client.connect();
    console.log('✅ Connected successfully');
    
    const db = client.db('hrms');
    const users = db.collection('users');
    
    const superAdmins = [
      {
        email: 'Dean.Cumming@vitrux.co.uk',
        firstName: 'Dean',
        lastName: 'Cumming',
        password: 'Vitrux2025!'
      },
      {
        email: 'syed.shahab.ahmed@vitrux.co.uk',
        firstName: 'Syed Shahab',
        lastName: 'Ahmed',
        password: 'Vitrux2025!'
      },
      {
        email: 'Tazeen.Syeda@vitrux.co.uk',
        firstName: 'Tazeen',
        lastName: 'Syeda',
        password: 'Vitrux2025!'
      }
    ];
    
    for (const admin of superAdmins) {
      const existingUser = await users.findOne({ email: admin.email });
      
      if (existingUser) {
        console.log(`\n✅ User ${admin.email} already exists, updating to superadmin...`);
        await users.updateOne(
          { email: admin.email },
          { 
            $set: { 
              role: 'admin',
              emailVerified: true, 
              adminApprovalStatus: 'approved',
              isActive: true,
              updatedAt: new Date()
            } 
          }
        );
        console.log(`✅ ${admin.email} updated to superadmin`);
      } else {
        console.log(`\n📝 Creating superadmin account for ${admin.email}...`);
        const hashedPassword = await bcrypt.hash(admin.password, 10);
        
        const adminUser = {
          email: admin.email,
          password: hashedPassword,
          firstName: admin.firstName,
          lastName: admin.lastName,
          role: 'admin',
          emailVerified: true,
          adminApprovalStatus: 'approved',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        const result = await users.insertOne(adminUser);
        console.log(`✅ Superadmin account created: ${admin.email}`);
        console.log(`🆔 User ID: ${result.insertedId}`);
      }
    }
    
    console.log('\n📊 Verifying all superadmin accounts:');
    for (const admin of superAdmins) {
      const user = await users.findOne({ email: admin.email });
      console.log(`\n${admin.email}:`);
      console.log('  - Role:', user.role);
      console.log('  - Email Verified:', user.emailVerified);
      console.log('  - Approval Status:', user.adminApprovalStatus);
      console.log('  - Active:', user.isActive);
    }
    
    console.log('\n✅ All superadmin accounts created/updated successfully!');
    console.log('🔑 Default password for all accounts: Vitrux2025!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

createSuperAdmins();
