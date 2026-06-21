require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('./models/Admin'); // Adjust path if necessary

const createFirstAdmin = async () => {
    try {
        // Connect to MongoDB using the URI in your .env file
        await mongoose.connect(process.env.MDB);
        console.log("Connected to MongoDB...");

        const email = process.env.ADMIN_EMAIL;
        if (!email) {
            console.error("❌ Error: ADMIN_EMAIL environment variable is required to create an admin. Please set it in your .env file.");
            process.exit(1);
        }
        
        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ email });
        if (existingAdmin) {
            console.log("Admin already exists! Updating permissions...");
            existingAdmin.canRegisterAdmin = true;
            await existingAdmin.save();
            console.log("✅ Admin permissions updated!");
            process.exit(0);
        }

        // Hash the password securely
        const adminPassword = process.env.ADMIN_PASSWORD;
        if (!adminPassword) {
            console.error("❌ Error: ADMIN_PASSWORD environment variable is required to create an admin. Please set it in your .env file.");
            process.exit(1);
        }
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        // Create the new admin
        const newAdmin = new Admin({
            firstName: "Super",
            lastName: "Admin",
            email: email,
            phone: "1234567890",
            password: hashedPassword,
            canRegisterAdmin: true,
        });

        await newAdmin.save();
        
        console.log("✅ First Admin created successfully!");
        console.log(`Email: ${email}`);
        console.log(`Password: ${adminPassword}`);
        
        mongoose.connection.close();
    } catch (error) {
        console.error("❌ Error creating admin:", error);
        process.exit(1);
    }
};

createFirstAdmin();
