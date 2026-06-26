const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/bookingController");
const { uploadPaymentScreenshot } = require("../controllers/bookingController");
const Booking = require("../models/Booking");
const auth = require("../middleware/auth");
const {
  createBooking,
  getAllBookings,
  getNotifications,
  updateBookingStatus,
  updateMeetLink,
  deleteBooking,
  prescribeMedicine,
  getRecommendedSupplements,
  updateRatingAndReview,
  getRatingAndReview,

  getBookingsByPatientId,
  getBookingsByDoctorId,
  getReviewedBookingsByPatientId,
  getReviewedBookingsForDoctorId
} = require("../controllers/bookingController");

// POST route to book an appointment
router.post("/", auth, createBooking);

// Route to fetch all bookings
router.get("/bookings", auth, getAllBookings);

// Route to fetch all notifications
router.get("/notifications", auth, getNotifications);

// PUT route to update booking requestAccept status
router.put("/update/:id", auth, updateBookingStatus);

router.put("/update/meet-link/:id", auth, updateMeetLink);

// DELETE route to delete a booking by ID
router.delete("/delete/:id", auth, deleteBooking);

// Route to update recommended supplements
router.put("/supplements", auth, prescribeMedicine);

// Route to get recommended supplements
router.get("/supplements/:id", auth, getRecommendedSupplements);

// Route to update rating and review
router.put("/rating-review/:id", auth, updateRatingAndReview);

// Route to get rating and review
router.get("/rating-review/:id", auth, getRatingAndReview);

router.get("/reviews/:doctorEmail", async (req, res) => {
  const { doctorEmail } = req.params;
  try {
    const reviews = await Booking.find({
      doctorEmail,
      rating: { $ne: null },
      review: { $ne: "" },
    }).select("patientName rating review dateOfAppointment");
    res.json(reviews);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/:id/payment", auth, bookingController.uploadPaymentScreenshot);
router.put("/:id/verify-payment", auth, bookingController.verifyPaymentProof);

// Removed duplicate GET / here

// Removed duplicate GET / here

// Get bookings by patient ID
router.get("/patient/:patientId", auth, getBookingsByPatientId);

// Get bookings by doctor ID
router.get("/doctor/:doctorId", auth, getBookingsByDoctorId);

// Get reviewed bookings by patient ID
router.get("/patient/reviews/:patientId", auth, getReviewedBookingsByPatientId);

// Get reviewed bookings by doctor ID
router.get("/doctor/reviews/:doctorId", auth, getReviewedBookingsForDoctorId);

module.exports = router;
