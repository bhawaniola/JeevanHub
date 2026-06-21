require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MDB = process.env.MDB || 'mongodb://localhost:27017/ayurveda';

mongoose.connect(MDB, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const db = mongoose.connection.db;
    const admins = await db.collection('admins').find({}).toArray();
    
    if (admins.length === 0) {
      console.log("No admins found in the database. Creating one...");
      const adminEmail = process.env.ADMIN_EMAIL;
      if (!adminEmail) {
          console.error("❌ Error: ADMIN_EMAIL environment variable is required. Please set it in your .env file.");
          process.exit(1);
      }
      const adminPassword = process.env.ADMIN_PASSWORD;
      if (!adminPassword) {
          console.error("❌ Error: ADMIN_PASSWORD environment variable is required. Please set it in your .env file.");
          process.exit(1);
      }
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await db.collection('admins').insertOne({
          firstName: "Super",
          lastName: "Admin",
          email: adminEmail,
          password: hashedPassword,
          role: "admin",
          createdAt: new Date(),
          updatedAt: new Date()
      });
      console.log(`Created default admin: Email: ${adminEmail}, Password: ${adminPassword}`);
    } else {
      console.log(`Found ${admins.length} admin(s) in the database:`);
      admins.forEach(admin => {
        console.log(`Email: ${admin.email}`);
      });
      console.log("\nSince passwords are encrypted, I can't show you the plain-text password.");
      const adminPassword = process.env.ADMIN_PASSWORD;
      if (!adminPassword) {
          console.error("❌ Error: ADMIN_PASSWORD environment variable is required. Please set it in your .env file.");
          process.exit(1);
      }
      console.log(`To easily log in, I am resetting the first admin's password to: ${adminPassword}`);
      
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await db.collection('admins').updateOne(
          { _id: admins[0]._id },
          { $set: { password: hashedPassword } }
      );
      console.log(`\nPassword for ${admins[0].email} successfully reset to: ${adminPassword}`);
    }
    process.exit(0);
  })
  .catch(err => {
    console.error("Error connecting to MongoDB:", err);
    process.exit(1);
  });
