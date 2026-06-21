const mongoose = require('mongoose');

require('dotenv').config();

const MDB = process.env.MDB;

mongoose.connect(MDB, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log("Connected to MongoDB. Fetching doctors...\n");
    const db = mongoose.connection.db;
    const doctors = await db.collection('doctors').find({}, { projection: { firstName: 1, lastName: 1, email: 1, specialization: 1, approvalStatus: 1 } }).toArray();
    
    if (doctors.length === 0) {
      console.log("No doctors found in the database.");
    } else {
      doctors.forEach((doc, index) => {
        console.log(`${index + 1}. Dr. ${doc.firstName} ${doc.lastName}`);
        console.log(`   Email: ${doc.email}`);
        console.log(`   Specialization: ${doc.specialization ? doc.specialization.join(', ') : 'N/A'}`);
        console.log(`   Approval Status: ${doc.approvalStatus || 'N/A'}`);
        console.log('-----------------------------------');
      });
    }
    process.exit(0);
  })
  .catch(err => {
    console.error("Error connecting to MongoDB:", err);
    process.exit(1);
  });
