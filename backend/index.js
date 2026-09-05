require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const authRoutes = require("./routes/authRoutes");
const medicineRoutes = require("./routes/medicineRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const orderRoutes = require("./routes/orderRoutes")
const blogRoutes = require("./routes/blogRoutes")
const prakritiRoutes = require("./routes/prakritiRoutes");
const dietYogaRoutes = require("./routes/dietYogaRoutes");
const ayurvedaRoutes = require("./routes/ayurvedaRoutes");
const searchRoutes = require("./routes/searchRoutes");

const uploadRoutes = require("./routes/uploadRoutes");
const generateBlogRoutes = require("./routes/generateBlogRoutes");
const getAllRecords = require("./routes/patientRecordsRoutes");
const patientRoutes = require("./routes/patientRoutes");
const retailerRoutes = require("./routes/retailerRoutes");
const cartRoutes = require("./routes/cartRoutes");
const knowledgeBaseRoutes = require("./routes/knowledgeBaseRoutes");
const chatRoutes = require("./routes/chatRoutes");
const { startScheduler } = require("./scheduler");
const paymentRoutes = require("./routes/paymentRoutes");
const medicineDraftRoutes = require("./routes/medicineDraftRoutes");
const callbackRequestRoutes = require("./routes/callbackRequestRoutes");
const cronRoutes = require("./routes/cronRoutes");

if (process.env.NODE_ENV !== 'production') {
    mongoose.set('debug', true);
}
const app = express();
const PORT = process.env.PORT || 8080;

// MongoDB connection
mongoose
  .connect(process.env.MDB)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:3000", // Dynamic frontend URL
  "http://localhost:3000", // For local development
  "http://localhost:3002", // For local development (alt port)
  "https://ayurvedic-app-frontend.onrender.com",
  "https://agiagentworld.com",
  "https://jeevanhub.com",
  "https://www.jeevanhub.com"
  // Add other necessary frontend origins here if applicable
];

// Middleware
app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true, // required so the httpOnly refresh-token cookie is sent/received
  maxAge: 86400 // cache preflight so repeat requests skip the OPTIONS round-trip
}));

app.use(compression());
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads")); // Serve images from the uploads folder

app.get("/", (req, res) => {
  res.send("Backend is running");
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/medicines", medicineRoutes);
app.use("/api/drafts/medicine", medicineDraftRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/orders", orderRoutes)
app.use("/api/blogs", blogRoutes)
app.use("/api/prakriti", prakritiRoutes)
app.use("/api/diet-yoga", dietYogaRoutes);
app.use("/api/ayurveda", ayurvedaRoutes);
app.use('/api/notifications', notificationRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/cart", cartRoutes);

app.use("/api/upload", uploadRoutes);
app.use("/api/webhook", generateBlogRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/retailers", retailerRoutes);
app.use("/api/patient-records", getAllRecords);
app.use("/api/chat", chatRoutes);
app.use("/api/knowledge", knowledgeBaseRoutes);

app.use("/api/payment", paymentRoutes);
app.use("/api/callback-requests", callbackRequestRoutes);
app.use("/api/cron", cronRoutes);


// Start the scheduler
startScheduler();

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
      message: "Internal Server Error", 
      error: process.env.NODE_ENV === 'production' ? null : err.message 
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});