const express = require("express");
const multer = require("multer");
const router = express.Router();
const XLSX = require("xlsx");
const Doctor = require("../models/Doctor"); 
const QRCode = require("qrcode"); 
const path = require("path"); 
const fs = require("fs");
const auth = require("../middleware/auth");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { getAllDoctors, 
    getAllDoctorsData, 
    updateDoctor,
    getDoctorById,
    bulkDeleteDoctors,
    verifyDoctor } = require("../controllers/doctorController");

// Public Routes
router.get("/", auth, getAllDoctors); 

// Multer setup for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const uploadDirectory = path.join(__dirname, "../uploads/doctos");

// Upload Excel file and process
router.post("/upload", auth, upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        console.log("File received:", req.file.originalname);

        // Process Excel file entirely in-memory
        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (!rows || rows.length === 0) {
            return res.status(400).json({ message: "Excel file is empty" });
        }

        const doctors = [];
        const skippedRows = [];
        const generatedCredentialsMap = new Map(); // row -> { email, tempPassword }

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            
            // If the Excel file contains a 'password' column and it's at least 8 chars long, use it.
            // Otherwise, automatically generate a secure 8-character hex password.
            let tempPassword = row.password ? String(row.password) : null;
            if (!tempPassword || tempPassword.length < 8) {
                tempPassword = crypto.randomBytes(4).toString('hex');
            }
            
            const passwordHash = await bcrypt.hash(tempPassword, 10);
            
            // Map excel row fields flexibly (handling both Doctor and old DoctorData formats)
            const doctorData = {
                firstName: row.firstName || row.firstname,
                lastName: row.lastName || row.lastname,
                email: row.email,
                phone: row.phone || row.whatsapp,
                specialization: row.specialization ? row.specialization.split(',').map(s => s.trim()) : [],
                experience: row.experience ? parseFloat(row.experience) : null,
                gender: row.gender,
                price: row.price || row.fee,
                password: passwordHash,
                forcePasswordReset: true,
                approvalStatus: 'Approved' // Bulk uploaded by admin, so pre-approved
            };

            // Basic validation
            if (!doctorData.firstName || !doctorData.lastName || !doctorData.email) {
                skippedRows.push({ row: i + 2, reason: "Missing required fields (firstName, lastName, or email)" });
                continue;
            }

            doctors.push({ data: doctorData, row: i + 2 });
            generatedCredentialsMap.set(i + 2, { email: doctorData.email, tempPassword });
        }

        if (doctors.length === 0) {
            return res.status(400).json({ message: "No valid doctor data to upload. Check formatting.", skippedRows });
        }

        // Manually check for existing emails to avoid relying on MongoDB errors
        const newEmails = doctors.map(d => d.data.email);
        const existingDoctors = await Doctor.find({ email: { $in: newEmails } }).select('email');
        const existingEmailsSet = new Set(existingDoctors.map(d => d.email));

        const doctorsToInsert = [];
        const insertedRowsMap = [];

        for (const docObj of doctors) {
            if (existingEmailsSet.has(docObj.data.email)) {
                skippedRows.push({ row: docObj.row, reason: `Duplicate email: ${docObj.data.email} already exists in database.` });
            } else {
                doctorsToInsert.push(docObj.data);
                insertedRowsMap.push(docObj.row);
            }
        }

        const successfulRowsSet = new Set(insertedRowsMap);
        let insertedCount = 0;
        
        if (doctorsToInsert.length > 0) {
            try {
                const result = await Doctor.insertMany(doctorsToInsert, { ordered: false });
                insertedCount = result.length;
            } catch (err) {
                // Fallback catch just in case there are other constraints we missed
                insertedCount = err.insertedDocs ? err.insertedDocs.length : 0;
                
                if (err.writeErrors) {
                    err.writeErrors.forEach(writeErr => {
                        const originalRow = insertedRowsMap[writeErr.index];
                        if (originalRow) {
                            successfulRowsSet.delete(originalRow); // Remove failed row from successes
                        }
                        
                        const message = writeErr.err && writeErr.err.errmsg ? writeErr.err.errmsg : String(writeErr);
                        
                        let reason = message;
                        if (message.includes('duplicate key')) {
                            const emailMatch = message.match(/"([^"]+)"/);
                            const email = emailMatch ? emailMatch[1] : '';
                            reason = `Duplicate email inside the file: ${email}`;
                        }

                        skippedRows.push({ 
                            row: originalRow || "Unknown", 
                            reason: reason
                        });
                    });
                }
            }
        }

        // Only export credentials for rows that were ACTUALLY inserted successfully
        const finalCredentials = [];
        successfulRowsSet.forEach(rowNum => {
            if (generatedCredentialsMap.has(rowNum)) {
                finalCredentials.push(generatedCredentialsMap.get(rowNum));
            }
        });

        res.status(200).json({ 
            message: `Uploaded ${insertedCount} doctors successfully.`, 
            skippedCount: skippedRows.length,
            skippedRows,
            generatedCredentials: finalCredentials
        });
    } catch (error) {
        console.error("Error processing file:", error);
        res.status(500).json({ message: "Server error while uploading doctors", error: error.message });
    }
});

const generateQRCode = async (doctorId) => {
    const qrData = `doctor:${doctorId}`;
    const qrCodeFileName = `${Date.now()}-${doctorId}-qr.png`;
    const qrCodePath = path.join(__dirname, "../uploads/doctors", qrCodeFileName);

    console.log("Generating QR Code for doctor:", doctorId);
    console.log("Saving QR Code to:", qrCodePath); // Log QR code path

    await QRCode.toFile(qrCodePath, qrData);
    console.log("QR Code saved successfully");

    return `uploads/doctors/${qrCodeFileName}`; // Return relative path
};

// Endpoint to get QR Code for doctor
router.get("/:id/qr-code", auth, async (req, res) => {
    try {
        const doctor = await Doctor.findById(req.params.id);
        console.log("Doctor fetched from DB:", doctor); // Log doctor data

        if (!doctor) {
            console.log("No doctor found with ID:", req.params.id);
            return res.status(404).json({ message: "Doctor not found" });
        }

        if (!doctor.qrCode) {
            console.log("No QR code associated with doctor ID:", req.params.id);
            return res.status(404).json({ message: "QR Code not found for this doctor" });
        }

        // Normalize the QR code path (remove extra parts if any)
        let qrCodePath = doctor.qrCode.replace(/\\/g, "/");  // Normalize backslashes to forward slashes

        // Check if the path starts with 'uploads/doctors' (if not, add it)
        if (!qrCodePath.startsWith('uploads/doctors/')) {
            qrCodePath = 'uploads/doctors/' + qrCodePath;
        }

        console.log("Normalized QR Code path:", qrCodePath);  // Log normalized path

        // Check if file exists at the QR code path
        const fullPath = path.join(__dirname, "../", qrCodePath);
        console.log("Full path to QR code:", fullPath); // Log full path to verify it

        if (!fs.existsSync(fullPath)) {
            console.log("QR Code file not found at:", fullPath);
            return res.status(404).json({ message: "QR Code file not found" });
        }

        res.json({
            qrCode: qrCodePath,
            price: doctor.price,  // <== Add this line
        });

    } catch (err) {
        console.error("Error fetching QR code:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// Bulk delete doctors
router.delete("/bulk-delete", auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: "Not authorized. Only admins can delete doctors." });
        }
        return bulkDeleteDoctors(req, res);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
});

// Delete doctor by ID
router.delete("/:id", auth, async (req, res) => {
    try {
        const doctor = await Doctor.findByIdAndDelete(req.params.id);

        if (!doctor) {
            return res.status(404).json({ message: "Doctor not found" });
        }

        res.status(200).json({ message: "Doctor deleted successfully" });
    } catch (error) {
        console.error("Error deleting doctor:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// New route to get all doctors from both collections
router.get("/allDoctors", auth, getAllDoctorsData); 

// New route to get doctor by ID from both collections
router.get("/getDoctorById/:id", auth, getDoctorById);

// update doctor details
router.put("/updateDoctor/:id", auth, updateDoctor);

// verify doctor
router.put("/verify/:id", auth, verifyDoctor);

module.exports = router;
