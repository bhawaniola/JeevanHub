const Booking = require("../models/Booking");
const Doctor = require("../models/Doctor");
const Patient = require("../models/Patient");
const Medicine = require("../models/Medicine");
const Cart = require("../models/Cart");
const Notification = require("../models/Notification");
const AyurvedaDietPlan = require("../models/AyurvedaDietPlan");
const { publishYogaDraft } = require("./dietYogaController");
const { publishYogaPlanForPatient } = require("./ayurvedaYogaPlanController");
const { isDailyConfigured, createDailyRoom, createDailyMeetingToken } = require("../utils/dailyClient");
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const getRazorpay = require("../services/razorpayService");
const notificationController = require("./notificationController");

// Slot times ("HH:MM") are always IST wall-clock -- the doctor picked "23:00"
// meaning 11pm India time, regardless of what timezone the server process
// happens to run in (Render/Docker default to UTC). Building the instant with
// `Date.setHours` uses the *server's* local timezone, which silently corrupts
// this by ~5.5h whenever server tz !== IST. Always go through this helper
// instead of setHours for slot-time math.
const buildIstDateTime = (dateOfAppointment, timeStr) => {
	if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return null;
	const [hours, minutes] = timeStr.split(':').map(Number);
	if (Number.isNaN(hours)) return null;
	const dateObj = new Date(dateOfAppointment);
	const y = dateObj.getUTCFullYear();
	const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
	const d = String(dateObj.getUTCDate()).padStart(2, '0');
	const hh = String(hours).padStart(2, '0');
	const mm = String(minutes || 0).padStart(2, '0');
	return new Date(`${y}-${m}-${d}T${hh}:${mm}:00+05:30`);
};

// A pending request "expires" once its slot's start time has passed without the
// doctor acting on it — from that point on it's treated the same as an explicit
// denial. timeSlot here is always the doctor's 24h "HH:MM" startTime string,
// resolved live from Doctor.availableSlots (never persisted on the Booking itself).
const AUTO_DENY_MESSAGE = "Automatically denied — the requested slot passed without a response.";
const hasSlotTimePassed = (dateOfAppointment, timeSlot) => {
	const slotDateTime = buildIstDateTime(dateOfAppointment, timeSlot);
	if (!slotDateTime) return false;
	return new Date() > slotDateTime;
};

// Resolves a booking's actual startTime/duration from the doctor's slot
// template + any same-day reschedule override -- the values are never
// persisted on the Booking itself (see hasSlotTimePassed above).
const resolveBookingSlotTime = (doctor, booking) => {
	if (!doctor || !doctor.availableSlots || !booking.slotId) return null;

	const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(booking.dateOfAppointment).getDay()];
	const baseSlots = doctor.availableSlots[dayName] || [];
	const baseSlot = baseSlots.find(s => s._id.toString() === booking.slotId.toString());
	if (!baseSlot) return null;

	let startTime = baseSlot.startTime;
	let duration = baseSlot.duration || 30;

	if (Array.isArray(doctor.scheduleOverrides)) {
		const bookingDateStr = new Date(booking.dateOfAppointment).toDateString();
		const override = doctor.scheduleOverrides.find(o =>
			new Date(o.date).toDateString() === bookingDateStr &&
			o.targetSlotId && o.targetSlotId.toString() === booking.slotId.toString() &&
			o.type === 'rescheduled'
		);
		if (override) {
			startTime = override.newStartTime || startTime;
			duration = override.newDuration || duration;
		}
	}

	return { startTime, duration };
};

// The video call room only opens in a window around the actual slot --
// otherwise a patient (or a leaked join link) could join hours early/late.
const JOIN_WINDOW_BEFORE_MS = 10 * 60 * 1000;
const JOIN_WINDOW_AFTER_GRACE_MS = 15 * 60 * 1000;
// How long after a slot ends a paid booking's payout stays "held" before the
// settlement cron auto-releases it -- the patient's dispute window.
const PAYOUT_HOLD_GRACE_MS = 48 * 60 * 60 * 1000;

// Fairness/escrow: computes the payout-hold fields for a just-confirmed paid
// booking (slot-end + PAYOUT_HOLD_GRACE_MS). Returns null for free bookings --
// there's nothing to hold. Shared by every path that can confirm a booking
// (free auto-confirm, Razorpay verification, manual screenshot upload).
const computeBookingPayoutHold = async (booking) => {
	if (!booking.amountPaid || booking.amountPaid <= 0) return null;
	const doctor = await Doctor.findById(booking.doctorId);
	const slotTime = resolveBookingSlotTime(doctor, booking);
	const joinWindow = getJoinWindow(booking.dateOfAppointment, slotTime);
	const slotEnd = joinWindow ? joinWindow.closesAt : new Date(Date.now() + PAYOUT_HOLD_GRACE_MS);
	return {
		payoutStatus: 'held',
		payoutHoldUntil: new Date(slotEnd.getTime() + PAYOUT_HOLD_GRACE_MS),
	};
};
const getJoinWindow = (dateOfAppointment, slotTime) => {
	if (!slotTime || !slotTime.startTime) return null;
	const start = buildIstDateTime(dateOfAppointment, slotTime.startTime);
	if (!start) return null;
	const end = new Date(start.getTime() + (slotTime.duration || 30) * 60 * 1000 + JOIN_WINDOW_AFTER_GRACE_MS);
	return { opensAt: new Date(start.getTime() - JOIN_WINDOW_BEFORE_MS), closesAt: end };
};

// Global registry for SSE doctor connections
const doctorConnections = new Map();

// Export the connections so we can theoretically emit from other controllers if needed
exports.doctorConnections = doctorConnections;

// Add or update rating and review
exports.updateRatingAndReview = async (req, res) => {
	const { id } = req.params;
	const { rating, review } = req.body;

	try {
		if (rating && (rating < 1 || rating > 5)) {
			return res.status(400).json({ error: "Rating must be between 1 and 5" });
		}

		const booking = await Booking.findById(id);
		if (!booking) {
			return res.status(404).json({ error: "Booking not found" });
		}
		if (booking.patientId.toString() !== req.user._id.toString()) {
			return res.status(403).json({ error: "Not authorized to update this booking" });
		}

		const updatedBooking = await Booking.findByIdAndUpdate(
			id,
			{ rating, review },
			{ new: true }
		);

		if (!updatedBooking) {
			return res.status(404).json({ error: "Booking not found" });
		}

		try {
			const stars = rating ? `${rating} ★` : '';
			await notificationController.createNotification(
				booking.doctorId,
				'doctor',
				booking._id.toString(),
				`New ${stars} review submitted by ${booking.patientName || 'a patient'}: "${review || ''}"`,
				'review'
			);
		} catch (e) {
			console.error("Failed to create review notification for doctor:", e.message);
		}

		return res.status(200).json({
			message: "Rating and review updated successfully",
			booking: updatedBooking,
		});
	} catch (error) {
		console.error("Error updating rating and review:", error);
		return res.status(500).json({ error: "Server error" });
	}
};

// Get rating and review for a booking
exports.getRatingAndReview = async (req, res) => {
	const { id } = req.params;

	try {
		const booking = await Booking.findById(id);

		if (!booking) {
			return res.status(404).json({ error: "Booking not found" });
		}
		if (req.user.role !== 'admin' && booking.patientId.toString() !== req.user._id.toString() && booking.doctorId.toString() !== req.user._id.toString()) {
			return res.status(403).json({ error: "Not authorized" });
		}

		return res.status(200).json({
			message: "Rating and review retrieved successfully",
			rating: booking.rating,
			review: booking.review,
		});
	} catch (error) {
		console.error("Error retrieving rating and review:", error);
		return res.status(500).json({ error: "Server error" });
	}
};

// Controller function to handle booking creation
exports.createBooking = async (req, res) => {
	if (req.user.role !== 'patient') {
		return res.status(403).json({ error: "Access denied. Only patients can create bookings." });
	}
	const {
		doctorName,
		doctorId,
		doctorEmail,
		slotId,
		dateOfAppointment,
		email,
		patientName,
		patientGender,
		patientAge,
		patientIllness,
		meetLink,
		amountPaid,
	} = req.body; // Destructure the request body
	const patientId = req.user._id; // Enforce ownership
	const patientEmail = email || req.user.email;

	if (!doctorName) {
		return res.status(400).json({ error: "Doctor name are required" });
	} else if (!slotId) {
		return res.status(400).json({ error: "Slot ID is required" });
	}

	const appointmentDate = new Date(dateOfAppointment);
	if (isNaN(appointmentDate.getTime())) {
		return res.status(400).json({ error: "Invalid appointment date." });
	}
	const todayStart = new Date();
	todayStart.setHours(0, 0, 0, 0);
	if (appointmentDate < todayStart) {
		return res.status(400).json({ error: "Cannot book an appointment in the past." });
	}
	if (patientAge !== undefined && patientAge !== null && patientAge !== '') {
		const ageNum = Number(patientAge);
		if (!Number.isFinite(ageNum) || ageNum < 0 || ageNum > 120) {
			return res.status(400).json({ error: "Please provide a valid patient age (0-120)." });
		}
	}
	if (patientIllness && patientIllness.length > 1000) {
		return res.status(400).json({ error: "Patient illness description is too long (max 1000 characters)." });
	}

	try {
		const doctor = await Doctor.findOne({ email: doctorEmail });
		if (!doctor) {
			return res.status(404).json({ error: "Doctor not found" });
		}
		// Check slot availability considering overrides and active bookings (max capacity)
		const dateObj = new Date(dateOfAppointment);
		const startOfDay = new Date(dateObj);
		startOfDay.setHours(0,0,0,0);
		const endOfDay = new Date(dateObj);
		endOfDay.setHours(23,59,59,999);

		const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
		// Free (amountPaid: 0) bookings still need to expire eventually — without a
		// bound, a patient who never gets a doctor decision holds the slot forever.
		const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
		const activeBookings = await Booking.find({
			doctorId: doctor._id,
			dateOfAppointment: { $gte: startOfDay, $lte: endOfDay },
			$or: [
				{ requestAccept: 'accepted' },
				{ requestAccept: 'pending', amountPaid: 0, createdAt: { $gte: oneDayAgo } },
				{
					requestAccept: 'pending',
					amountPaid: { $gt: 0 },
					$or: [
						{ 'paymentScreenshots.0': { $exists: true } },
						{ paymentStatus: 'Completed' },
						{ createdAt: { $gte: tenMinutesAgo } }
					]
				}
			]
		});

		const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dateObj.getDay()];
		let baseSlots = [...(doctor.availableSlots[dayName] || [])].map(s => s.toObject ? s.toObject() : s);
		const dateOverrides = doctor.scheduleOverrides.filter(o => new Date(o.date).toDateString() === dateObj.toDateString());
		
		if (dateOverrides.some(o => o.type === 'cancelled' && !o.targetSlotId)) {
			return res.status(400).json({ error: "Doctor is unavailable on this date." });
		}

		for (const override of dateOverrides) {
			if (override.type === 'cancelled' && override.targetSlotId) {
				baseSlots = baseSlots.filter(s => s.isOverride || s._id.toString() !== override.targetSlotId.toString());
			} else if (override.type === 'rescheduled' && override.targetSlotId) {
				const idx = baseSlots.findIndex(s => !s.isOverride && s._id.toString() === override.targetSlotId.toString());
				if (idx !== -1) {
					baseSlots[idx] = {
                        ...baseSlots[idx],
                        startTime: override.newStartTime || baseSlots[idx].startTime,
                        maxCapacity: override.newMaxCapacity || baseSlots[idx].maxCapacity,
                        isOverride: true,
                    };
				}
			} else if (override.type === 'added') {
				baseSlots.push({
					_id: override._id,
					startTime: override.newStartTime,
					maxCapacity: override.newMaxCapacity || 1,
					isOverride: true
				});
			}
		}

		const foundSlot = baseSlots.find(s => s._id.toString() === slotId.toString());
		if (!foundSlot) {
			return res.status(400).json({ error: "Invalid or cancelled time slot." });
		}
		
		const slotBookings = activeBookings.filter(b => b.slotId.toString() === slotId.toString());
		if (slotBookings.length >= (foundSlot.maxCapacity || 1)) {
			return res.status(400).json({ error: "This time slot is already booked for the selected doctor. Please Choose a different date or time slot." });
		}

		const resolvedAmountPaid = amountPaid !== undefined ? amountPaid : (doctor.price || 0);

		// Create a new booking
		const newBooking = new Booking({
			doctorId: doctor._id,
			doctorName,
			doctorEmail,
			slotId,
			patientId,
			dateOfAppointment,
			patientEmail,
			patientName,
			patientGender,
			patientAge,
			patientIllness,
			meetLink,
			amountPaid: resolvedAmountPaid,
			// Appointments confirm by default -- there's no doctor accept/deny step.
			// A free consult is confirmed immediately; a paid one confirms as soon as
			// payment lands (verifyBookingPayment / uploadPaymentScreenshot), so it
			// stays 'pending' only for the few minutes it takes to pay.
			requestAccept: resolvedAmountPaid > 0 ? 'pending' : 'accepted',
		});

		// Save the booking to the database
		await newBooking.save();

		// Two requests can pass the capacity check above concurrently before either
		// inserts. Close that race by re-running the identical query post-insert:
		// only the first `maxCapacity` bookings for this slot (by creation order)
		// survive, so a loser here is cleanly rejected and its doc removed.
		const confirmBookings = await Booking.find({
			doctorId: doctor._id,
			slotId,
			dateOfAppointment: { $gte: startOfDay, $lte: endOfDay },
			$or: [
				{ requestAccept: 'accepted' },
				{ requestAccept: 'pending', amountPaid: 0, createdAt: { $gte: oneDayAgo } },
				{
					requestAccept: 'pending',
					amountPaid: { $gt: 0 },
					$or: [
						{ 'paymentScreenshots.0': { $exists: true } },
						{ paymentStatus: 'Completed' },
						{ createdAt: { $gte: tenMinutesAgo } }
					]
				}
			]
		}).sort({ createdAt: 1 });

		const slotConfirmBookings = confirmBookings.filter(b => b.slotId.toString() === slotId.toString());
		const rank = slotConfirmBookings.findIndex(b => b._id.equals(newBooking._id));
		if (rank === -1 || rank >= (foundSlot.maxCapacity || 1)) {
			await Booking.deleteOne({ _id: newBooking._id });
			return res.status(409).json({ error: "This time slot was just booked by someone else. Please choose a different slot." });
		}

		// Notify doctor of new pending booking
		notifyDoctor(doctor._id);
		try {
			const dateStr = new Date(newBooking.dateOfAppointment).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
			const timeStr = foundSlot?.startTime ? ` at ${foundSlot.startTime}` : '';
			await notificationController.createNotification(
				doctor._id,
				'doctor',
				newBooking._id.toString(),
				`New appointment booked by ${newBooking.patientName || 'a patient'} scheduled for ${dateStr}${timeStr}.`,
				'appointment'
			);
		} catch (e) {
			console.error("Failed to create doctor booking notification:", e.message);
		}

		return res.status(201).json({
			message: "Appointment booked successfully",
			booking: newBooking,
		});
	} catch (error) {
		console.error("Error creating booking:", error);
		return res.status(500).json({ error: "Server error" });
	}
};

// Controller function to get all bookings
exports.getAllBookings = async (req, res) => {
	try {
		if (req.user.role !== 'admin') {
			return res.status(403).json({ message: "Access denied. Admins only." });
		}
		// Fetch all bookings from the database
		const bookings = await Booking.find();

		// Check if any bookings exist
		if (bookings.length === 0) {
			return res.status(404).json({ message: "No bookings found" });
		}

		// Return all bookings in the response
		return res.status(200).json({
			message: "Bookings retrieved successfully",
			bookings,
		});
	} catch (error) {
		console.error("Error fetching bookings:", error);
		return res.status(500).json({ error: "Server error" });
	}
};

const cloudinary = require("../config/cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const isPlaceholder = (v) => !v || v.startsWith('your_');
const CLOUDINARY_CONFIGURED = !isPlaceholder(process.env.CLOUDINARY_CLOUD_NAME) &&
	!isPlaceholder(process.env.CLOUDINARY_API_KEY) &&
	!isPlaceholder(process.env.CLOUDINARY_API_SECRET);

const LOCAL_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'payments');

let storage;
if (CLOUDINARY_CONFIGURED) {
	storage = new CloudinaryStorage({
		cloudinary: cloudinary,
		params: async (req, file) => {
			return {
				folder: "jeevanhub/payments",
				resource_type: "auto",
				public_id: Date.now() + "-" + file.originalname.split('.')[0]
			};
		},
	});
} else {
	fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
	storage = multer.diskStorage({
		destination: LOCAL_UPLOAD_DIR,
		filename: (req, file, cb) => {
			const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
			cb(null, `${Date.now()}-${safeName}`);
		},
	});
}

const fileFilter = (req, file, cb) => {
	const filetypes = /jpeg|jpg|png|pdf/;
	const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
	const mimetype = filetypes.test(file.mimetype);

	if (mimetype && extname) {
		return cb(null, true);
	} else {
		cb(new Error("Only jpeg, jpg, png, and pdf files are allowed"));
	}
};

const upload = multer({
	storage: storage,
	fileFilter: fileFilter,
}).array("paymentScreenshots", 5);

exports.uploadPaymentScreenshot = (req, res) => {
	upload(req, res, async function (err) {
		if (err instanceof multer.MulterError) {
			return res.status(400).json({ error: err.message });
		} else if (err) {
			return res.status(400).json({ error: err.message });
		}

		console.log("🟡 Uploading payment screenshots...");
		console.log(req.files);

		const { id } = req.params;

		if (!req.files || req.files.length === 0) {
			return res.status(400).json({ error: "Payment screenshot is required" });
		}

		try {
			const booking = await Booking.findById(id);
			if (!booking) {
				return res.status(404).json({ error: "Booking not found" });
			}
			if (booking.patientId.toString() !== req.user._id.toString()) {
				return res.status(403).json({ error: "Not authorized" });
			}

			// Save all uploaded file paths (use relative URL paths if stored locally)
			booking.paymentScreenshots = req.files.map(file => {
				if (CLOUDINARY_CONFIGURED) {
					return file.path;
				} else {
					return `uploads/payments/${file.filename}`;
				}
			});
			
			// C5-1: Server dictates status, not client. Unlike Razorpay this isn't
			// cryptographically verified, so paymentStatus stays Pending -- but the
			// appointment still confirms by default (no doctor review gate); the
			// payout-hold/dispute system is the fraud net, not a manual accept step.
			booking.paymentStatus = "Pending";
			booking.requestAccept = "accepted";
			const payoutHold = await computeBookingPayoutHold(booking);
			if (payoutHold) Object.assign(booking, payoutHold);

			await booking.save();

			// Notify doctor of new screenshot upload
			notifyDoctor(booking.doctorId);
			try {
				const dateStr = new Date(booking.dateOfAppointment).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
				await notificationController.createNotification(
					booking.doctorId,
					'doctor',
					booking._id.toString(),
					`Payment screenshot uploaded by ${booking.patientName || 'patient'} for consultation scheduled for ${dateStr}.`,
					'appointment'
				);
			} catch (e) {
				console.error("Failed to create doctor screenshot notification:", e.message);
			}

			return res.status(200).json({
				message: "Payment screenshot uploaded and booking updated",
				booking,
			});
		} catch (error) {
			console.error("❌ Error uploading payment screenshot:", error);
			return res.status(500).json({ error: "Server error" });
		}
	});
};

// Verifies a Razorpay payment for a booking's consultation fee -- same
// signature + server-fetched-amount pattern as orderController.createOrder,
// so a tampered request body can't mark an underpaid or fake booking as paid.
exports.verifyBookingPayment = async (req, res) => {
	const { id } = req.params;
	const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

	try {
		if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
			return res.status(400).json({ error: "Missing payment verification details" });
		}
		if (!process.env.RAZORPAY_KEY_SECRET) {
			return res.status(500).json({ error: "Payment gateway not configured" });
		}

		const booking = await Booking.findById(id);
		if (!booking) {
			return res.status(404).json({ error: "Booking not found" });
		}
		if (booking.patientId.toString() !== req.user._id.toString()) {
			return res.status(403).json({ error: "Not authorized" });
		}

		const expectedSignature = crypto
			.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
			.update(razorpayOrderId + "|" + razorpayPaymentId)
			.digest('hex');
		if (expectedSignature !== razorpaySignature) {
			return res.status(400).json({ error: "Payment verification failed" });
		}

		// Signature only proves the payment/order pair is genuine -- confirm the
		// Razorpay order amount against this booking's fee before trusting it.
		const razorpayOrder = await getRazorpay().orders.fetch(razorpayOrderId);
		if (razorpayOrder.amount !== Math.round(booking.amountPaid * 100)) {
			return res.status(400).json({ error: "Paid amount does not match consultation fee" });
		}

		booking.paymentDetails = {
			razorpayOrderId,
			razorpayPaymentId,
			razorpaySignature,
			amount: booking.amountPaid,
			currency: "INR",
			status: "paid"
		};
		booking.paymentStatus = "Completed";
		booking.paymentConfirmedAt = new Date();

		// Appointments confirm by default once payment lands -- no separate
		// doctor accept step.
		booking.requestAccept = "accepted";
		const payoutHold = await computeBookingPayoutHold(booking);
		if (payoutHold) Object.assign(booking, payoutHold);

		await booking.save();

		notifyDoctor(booking.doctorId);
		try {
			const dateStr = new Date(booking.dateOfAppointment).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
			// 1. Notify Doctor
			await notificationController.createNotification(
				booking.doctorId,
				'doctor',
				booking._id.toString(),
				`Payment confirmed for consultation with ${booking.patientName || 'a patient'} scheduled for ${dateStr}.`,
				'appointment'
			);

			// 2. Notify Patient
			const doctorDisplay = booking.doctorName && (booking.doctorName.toLowerCase().startsWith('dr.') || booking.doctorName.toLowerCase().startsWith('dr '))
				? booking.doctorName
				: `Dr. ${booking.doctorName || "your doctor"}`;

			await notificationController.createNotification(
				booking.patientId,
				'patient',
				booking._id.toString(),
				`Payment of ₹${booking.amountPaid} confirmed for your consultation with ${doctorDisplay} scheduled for ${dateStr}.`,
				'payment'
			);
		} catch (e) {
			console.error("Failed to create payment notifications:", e.message);
		}

		return res.status(200).json({
			message: "Payment verified successfully",
			booking,
		});
	} catch (error) {
		console.error("❌ Error verifying booking payment:", error);
		return res.status(500).json({ error: "Server error" });
	}
};

const sharedRecordStorage = new CloudinaryStorage({
	cloudinary: cloudinary,
	params: async (req, file) => {
		return {
			folder: "jeevanhub/shared-records",
			resource_type: "auto",
			public_id: Date.now() + "-" + file.originalname.split('.')[0]
		};
	},
});

const uploadSharedRecord = multer({
	storage: sharedRecordStorage,
	fileFilter: fileFilter,
}).single("file");

// Helper: is this booking still within the window where a patient may share records
// for it — any time up to the appointment, or within 24h after it.
const isWithinSharingWindow = (dateOfAppointment) => {
	const now = new Date();
	const appointmentTime = new Date(dateOfAppointment);
	if (appointmentTime >= now) return true;
	const hoursSinceAppointment = (now - appointmentTime) / (1000 * 60 * 60);
	return hoursSinceAppointment <= 24;
};

// ✅ Patient shares a record (external file upload OR a reference to one of their own
// past bookings on this platform) onto a specific upcoming/recent booking.
exports.addSharedRecord = (req, res) => {
	uploadSharedRecord(req, res, async function (err) {
		if (err) {
			return res.status(400).json({ error: err.message });
		}

		const { id } = req.params;
		const { referencedBookingId, medicalHistoryDocId, note } = req.body;

		try {
			if (req.user.role !== 'patient') {
				return res.status(403).json({ error: "Only patients can share records." });
			}

			const booking = await Booking.findById(id);
			if (!booking) {
				return res.status(404).json({ error: "Booking not found" });
			}
			if (booking.patientId.toString() !== req.user._id.toString()) {
				return res.status(403).json({ error: "Not authorized to share records on this booking" });
			}

			if (!isWithinSharingWindow(booking.dateOfAppointment)) {
				return res.status(400).json({ error: "This booking is outside the window for sharing records (up to 24 hours after the appointment)." });
			}

			let newRecord;
			if (req.file) {
				newRecord = {
					type: "external_file",
					fileUrl: req.file.path,
					note: note || ""
				};
			} else if (medicalHistoryDocId) {
				// Links a document already uploaded + OCR-reviewed via the patient's
				// medical-history uploader (ShareRecordModal's upload flow) onto this
				// booking, instead of re-uploading the file a second time.
				const patient = await Patient.findOne(
					{ _id: req.user._id, "medicalHistory._id": medicalHistoryDocId },
					{ "medicalHistory.$": 1 }
				);
				const doc = patient?.medicalHistory?.[0];
				if (!doc) {
					return res.status(404).json({ error: "Medical history document not found" });
				}
				if (doc.patientVerification?.status !== "submitted") {
					return res.status(400).json({ error: "This document hasn't been reviewed and submitted yet." });
				}
				newRecord = {
					type: "external_file",
					fileUrl: doc.url,
					note: note || ""
				};
			} else if (referencedBookingId) {
				const refBooking = await Booking.findById(referencedBookingId);
				if (!refBooking) {
					return res.status(404).json({ error: "Referenced booking not found" });
				}
				if (refBooking.patientId.toString() !== req.user._id.toString()) {
					return res.status(403).json({ error: "You can only reference your own bookings" });
				}
				newRecord = {
					type: "platform_reference",
					referencedBookingId,
					note: note || ""
				};
			} else {
				return res.status(400).json({ error: "A file, medicalHistoryDocId, or referencedBookingId is required" });
			}

			booking.patientSharedRecords.push(newRecord);
			await booking.save();

			notifyDoctor(booking.doctorId);

			return res.status(201).json({
				message: "Record shared successfully",
				booking
			});
		} catch (error) {
			console.error("Error adding shared record:", error);
			return res.status(500).json({ error: "Server error" });
		}
	});
};

// ✅ List the patient's own past accepted bookings that actually have a prescription,
// so they can pick one to reference (platform_reference) into the current booking.
exports.getOwnBookingsForSharing = async (req, res) => {
	try {
		if (req.user.role !== 'patient') {
			return res.status(403).json({ error: "Access denied" });
		}

		const { excludeBookingId } = req.query;
		const filter = {
			patientId: req.user._id,
			requestAccept: 'accepted',
			'recommendedSupplements.0': { $exists: true }
		};
		if (excludeBookingId) {
			filter._id = { $ne: excludeBookingId };
		}

		const bookings = await Booking.find(filter)
			.select('doctorName dateOfAppointment recommendedSupplements diagnosis patientIllness')
			.sort({ dateOfAppointment: -1 });

		return res.status(200).json({ bookings });
	} catch (error) {
		console.error("Error fetching patient's own bookings for sharing:", error);
		return res.status(500).json({ error: "Server error" });
	}
};

exports.getNotifications = async (req, res) => {
	const { email } = req.query;
	console.log(email);
	if (!email) {
		return res.status(400).json({ error: "User email is required" });
	}
	if (req.user.role !== 'admin' && req.user.email !== email) {
		return res.status(403).json({ error: "Not authorized to view notifications for this email" });
	}

	try {
		// Fetch bookings for the specified user email
		const bookings = await Booking.find({ patientEmail: email }).sort({
			createdAt: -1,
		});

		// Map bookings to notification-like format
		const notifications = bookings.map((booking) => ({
			message: `Your appointment with Dr. ${booking.doctorName} is confirmed for ${booking.timeSlot}.`,
			date: booking.createdAt,
		}));

		return res.status(200).json({
			message: "Notifications retrieved successfully",
			notifications,
		});
	} catch (error) {
		console.error("Error fetching notifications:", error);
		return res.status(500).json({ error: "Server error" });
	}
};

// New controller function to update booking requestAccept status
exports.updateBookingStatus = async (req, res) => {
    const { id } = req.params;
    const { requestAccept, doctorsMessage } = req.body;

    try {
        // Prepare the update object
        let updateData = {
            requestAccept,
            doctorsMessage
        };

        // Accepting a request is the doctor's verification of the payment proof shown
        // alongside it in Current Requests — there is no separate verification step.
        if (requestAccept === "accepted") {
            updateData.paymentStatus = "Completed";
            updateData.paymentConfirmedAt = new Date();

            // Video calls run on Daily.co by default (see getDailyJoinInfo) -- meetLink
            // is now only an optional backup the doctor can set here or later via
            // updateMeetLink, shared with the patient in case Daily.co fails.
            if (req.body.meetLink && req.body.meetLink.trim() !== "") {
                updateData.meetLink = req.body.meetLink.trim();
            }

            // Fairness/escrow: start the payout hold on acceptance so the doctor
            // doesn't get paid out immediately -- the patient has a window to
            // dispute a no-show. See computeBookingPayoutHold and the settlement cron.
            const existingBooking = await Booking.findById(id);
            const payoutHold = existingBooking ? await computeBookingPayoutHold(existingBooking) : null;
            if (payoutHold) Object.assign(updateData, payoutHold);
        }

        // Find the booking by ID and update the fields, ensuring doctor owns it
        const updatedBooking = await Booking.findOneAndUpdate(
            { _id: id, doctorId: req.user._id },
            updateData,
            { new: true }
        );

        if (!updatedBooking) {
            return res.status(404).json({ error: "Booking not found" });
        }
        
        notifyDoctor(updatedBooking.doctorId);

        return res.status(200).json({
            message: `Booking ${requestAccept === "accepted" ? "accepted" : "denied"} successfully`,
            booking: updatedBooking,
        });
    } catch (error) {
        console.error("Error updating booking:", error);
        return res.status(500).json({ error: "Server error" });
    }
};

// Doctor cancels an already-confirmed appointment. Since appointments confirm
// by default now (no accept/deny request queue), this is the doctor's only
// way to back out of one -- and unlike a patient-raised dispute, a doctor
// self-cancelling is an admission, so the refund happens immediately instead
// of waiting on the hold window.
exports.cancelBookingByDoctor = async (req, res) => {
	const { id } = req.params;
	const { reason } = req.body;

	try {
		const booking = await Booking.findOne({ _id: id, doctorId: req.user._id });
		if (!booking) {
			return res.status(404).json({ error: "Booking not found" });
		}
		if (booking.requestAccept !== "accepted") {
			return res.status(400).json({ error: "Only a confirmed appointment can be cancelled." });
		}
		if (booking.payoutStatus === "released") {
			return res.status(400).json({ error: "This booking's payout has already been released -- contact support to arrange a refund." });
		}

		booking.requestAccept = "denied";
		booking.doctorsMessage = reason?.trim() || "Cancelled by the doctor.";
		if (booking.amountPaid > 0) {
			booking.payoutStatus = "refunded";
		}
		await booking.save();

		await notificationController.createNotification(
			booking.patientId,
			'patient',
			booking._id,
			booking.amountPaid > 0
				? `Your appointment with Dr. ${booking.doctorName} has been cancelled by the doctor. ₹${booking.amountPaid} will be refunded.`
				: `Your appointment with Dr. ${booking.doctorName} has been cancelled by the doctor.`,
			'appointment'
		);

		notifyDoctor(booking.doctorId);

		return res.status(200).json({ message: "Appointment cancelled", booking });
	} catch (error) {
		console.error("Error cancelling booking:", error);
		return res.status(500).json({ error: "Server error" });
	}
};

// New controller function to update the meetLink
exports.updateMeetLink = async (req, res) => {
	const { id } = req.params; // Get booking ID from the URL params
	const { meetLink } = req.body; // Get the meetLink from the request body
	console.log(meetLink);
	if (!meetLink || meetLink.trim() === "") {
		return res.status(400).json({ error: "Meet link is required" });
	}

	try {
		// Find the booking by ID and update the meetLink field, ensuring doctor owns it
		const updatedBooking = await Booking.findOneAndUpdate(
			{ _id: id, doctorId: req.user._id },
			{ meetLink },
			{ new: true }
		);

		if (!updatedBooking) {
			return res.status(404).json({ error: "Booking not found" });
		}

		return res.status(200).json({
			message: "Meet link updated successfully",
			booking: updatedBooking,
		});
	} catch (error) {
		console.error("Error updating meet link:", error);
		return res.status(500).json({ error: "Server error" });
	}
};

// Resolves (creating on first call) the Daily.co room for a booking and
// mints a per-requester meeting token -- the doctor always joins as room
// owner so the call actually starts, unlike the old public-Jitsi flow where
// neither side could ever become moderator.
exports.getDailyJoinInfo = async (req, res) => {
	const { id } = req.params;

	if (!isDailyConfigured()) {
		return res.status(503).json({ error: "Video calling is not configured on this server." });
	}

	try {
		const booking = await Booking.findById(id);
		if (!booking) {
			return res.status(404).json({ error: "Booking not found" });
		}

		const isDoctor = booking.doctorId.toString() === req.user._id.toString() && req.user.role === "doctor";
		const isPatient = booking.patientId.toString() === req.user._id.toString() && req.user.role === "patient";
		if (!isDoctor && !isPatient && req.user.role !== "admin") {
			return res.status(403).json({ error: "Not authorized to join this meeting." });
		}

		if (booking.requestAccept !== "accepted") {
			return res.status(400).json({ error: "This appointment hasn't been accepted yet." });
		}

		const doctor = await Doctor.findById(booking.doctorId);
		const slotTime = resolveBookingSlotTime(doctor, booking);
		const joinWindow = getJoinWindow(booking.dateOfAppointment, slotTime);

		// Admins can still open the room (support/troubleshooting); the actual
		// patient/doctor are held to the window so a leaked link, or just an
		// early click, can't sit in an idle room burning Daily.co minutes.
		if (joinWindow && req.user.role !== "admin") {
			const now = new Date();
			if (now < joinWindow.opensAt) {
				return res.status(403).json({ error: "This call opens 10 minutes before your slot. Please come back closer to the time." });
			}
			if (now > joinWindow.closesAt) {
				return res.status(403).json({ error: "This appointment's time window has passed." });
			}
		}

		let needsSave = false;
		if (!booking.dailyRoomUrl) {
			const roomName = `ayuhub-${booking._id}`;
			// Room self-destructs shortly after the slot ends instead of sitting
			// around for a flat 6h -- a leaked room URL/token stops working once
			// the appointment is actually over.
			const expiresAt = joinWindow ? Math.floor(joinWindow.closesAt.getTime() / 1000) : Math.floor(Date.now() / 1000) + 6 * 60 * 60;
			const room = await createDailyRoom(roomName, expiresAt);
			booking.dailyRoomName = room.name;
			booking.dailyRoomUrl = room.url;
			needsSave = true;
		}

		// Fairness: the doctor actually opening the room is the technical
		// proof-of-attendance signal the settlement cron uses to tell a real
		// no-show apart from a disputed-but-attended call.
		if (isDoctor && !booking.doctorJoinedAt) {
			booking.doctorJoinedAt = new Date();
			needsSave = true;
		}
		if (needsSave) {
			await booking.save();
		}

		const userName = isDoctor ? booking.doctorName : booking.patientName;
		const token = await createDailyMeetingToken({
			roomName: booking.dailyRoomName,
			isOwner: isDoctor,
			userName: userName || (isDoctor ? "Doctor" : "Patient"),
			expiresAt: joinWindow ? Math.floor(joinWindow.closesAt.getTime() / 1000) : undefined,
		});

		return res.status(200).json({ url: `${booking.dailyRoomUrl}?t=${token}` });
	} catch (error) {
		console.error("Error creating Daily join info:", error);
		return res.status(500).json({ error: "Server error" });
	}
};

// Patient-raised dispute over a held payout (e.g. doctor no-show) -- freezes
// the settlement cron's auto-release so an admin has to look at it.
exports.raiseBookingDispute = async (req, res) => {
	const { id } = req.params;
	const { reason } = req.body;

	try {
		if (req.user.role !== 'patient') {
			return res.status(403).json({ error: "Only patients can raise a dispute" });
		}
		if (!reason || !reason.trim()) {
			return res.status(400).json({ error: "A reason is required" });
		}

		const booking = await Booking.findById(id);
		if (!booking) {
			return res.status(404).json({ error: "Booking not found" });
		}
		if (booking.patientId.toString() !== req.user._id.toString()) {
			return res.status(403).json({ error: "Not authorized" });
		}
		if (booking.payoutStatus !== 'held') {
			return res.status(400).json({ error: `Cannot dispute this booking -- its payout is already ${booking.payoutStatus}.` });
		}

		booking.payoutStatus = 'disputed';
		booking.dispute = { reason: reason.trim(), raisedAt: new Date() };
		await booking.save();

		try {
			await notificationController.createNotification(
				booking.doctorId,
				'doctor',
				booking._id.toString(),
				`A dispute was raised for the appointment with ${booking.patientName || 'patient'}. Reason: "${reason.trim()}".`,
				'dispute'
			);
		} catch (e) {
			console.error("Failed to create doctor dispute notification:", e.message);
		}

		return res.status(200).json({ message: "Dispute raised. Our team will review this before any payout goes out.", booking });
	} catch (error) {
		console.error("Error raising booking dispute:", error);
		return res.status(500).json({ error: "Server error" });
	}
};

// Admin resolves a disputed payout -- either releases it (dispute rejected)
// or refunds the patient (dispute upheld). Actual money movement (payout to
// the doctor's bank account, or refund via Razorpay) is a manual step for
// now; this just records the decision and unblocks/settles the state.
exports.resolveBookingDispute = async (req, res) => {
	const { id } = req.params;
	const { resolution } = req.body; // 'released' | 'refunded'

	try {
		if (req.user.role !== 'admin') {
			return res.status(403).json({ error: "Admins only" });
		}
		if (!['released', 'refunded'].includes(resolution)) {
			return res.status(400).json({ error: "resolution must be 'released' or 'refunded'" });
		}

		const booking = await Booking.findById(id);
		if (!booking) {
			return res.status(404).json({ error: "Booking not found" });
		}
		if (booking.payoutStatus !== 'disputed') {
			return res.status(400).json({ error: "This booking has no open dispute." });
		}

		booking.payoutStatus = resolution;
		booking.dispute.resolvedAt = new Date();
		booking.dispute.resolution = resolution;
		booking.dispute.resolvedBy = req.user._id;
		await booking.save();

		return res.status(200).json({ message: `Dispute resolved as ${resolution}.`, booking });
	} catch (error) {
		console.error("Error resolving booking dispute:", error);
		return res.status(500).json({ error: "Server error" });
	}
};

// Lists all bookings an admin currently needs to act on: open disputes plus
// anything held with no doctorJoinedAt whose window has already closed
// (a likely no-show the cron will otherwise sit on rather than silently pay out).
exports.getBookingPayoutQueue = async (req, res) => {
	try {
		if (req.user.role !== 'admin') {
			return res.status(403).json({ error: "Admins only" });
		}

		const disputed = await Booking.find({ payoutStatus: 'disputed' }).sort({ 'dispute.raisedAt': -1 });
		const likelyNoShow = await Booking.find({
			payoutStatus: 'held',
			doctorJoinedAt: null,
			payoutHoldUntil: { $lte: new Date() }
		}).sort({ payoutHoldUntil: 1 });

		return res.status(200).json({ disputed, likelyNoShow });
	} catch (error) {
		console.error("Error fetching booking payout queue:", error);
		return res.status(500).json({ error: "Server error" });
	}
};

// New controller function to delete a booking
exports.deleteBooking = async (req, res) => {
	const { id } = req.params;

	try {
		// Find the booking by ID and delete it, ensuring patient owns it
		const deletedBooking = await Booking.findOneAndDelete({ _id: id, patientId: req.user._id });

		if (!deletedBooking) {
			return res.status(404).json({ message: "Booking not found or not authorized to delete" });
		}
		
		notifyDoctor(deletedBooking.doctorId);
		try {
			const dateStr = new Date(deletedBooking.dateOfAppointment).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
			await notificationController.createNotification(
				deletedBooking.doctorId,
				'doctor',
				deletedBooking._id.toString(),
				`Consultation scheduled for ${dateStr} has been cancelled by ${deletedBooking.patientName || 'the patient'}.`,
				'appointment'
			);
		} catch (e) {
			console.error("Failed to create doctor cancellation notification:", e.message);
		}

		return res.status(200).json({ message: "Booking deleted successfully" });
	} catch (error) {
		console.error("Error deleting booking:", error);
		return res.status(500).json({ error: "Server error" });
	}
};

// Helper: add one unit of a medicine to the patient's cart FOR THIS DOCTOR
// (find-or-create) — never touches the patient's own default cart or another
// doctor's cart.
const addMedicineToCart = async (patientId, doctorId, medicine) => {
	let cart = await Cart.findOne({ patientId, doctorId });
	if (!cart) {
		cart = new Cart({
			patientId,
			doctorId,
			items: [{ medicineId: medicine._id, quantity: 1, price: medicine.price }],
			totalPrice: medicine.price
		});
	} else {
		const idx = cart.items.findIndex(i => i.medicineId.toString() === medicine._id.toString());
		if (idx > -1) {
			cart.items[idx].quantity += 1;
		} else {
			cart.items.push({ medicineId: medicine._id, quantity: 1, price: medicine.price });
		}
		cart.totalPrice += medicine.price;
		cart.updatedAt = Date.now();
	}
	await cart.save();
};

// Helper: remove a medicine entirely from this doctor's cart for this patient
// (used when a prescribed medicine is deleted). No-op if the cart or item is
// gone (e.g. already purchased). Deletes the cart doc if it ends up empty.
const removeMedicineFromCart = async (patientId, doctorId, medicineId) => {
	if (!medicineId) return;
	const cart = await Cart.findOne({ patientId, doctorId });
	if (!cart) return;
	const item = cart.items.find(i => i.medicineId.toString() === medicineId.toString());
	if (!item) return;
	cart.items = cart.items.filter(i => i.medicineId.toString() !== medicineId.toString());

	if (cart.items.length === 0) {
		await Cart.deleteOne({ _id: cart._id });
		return;
	}

	cart.totalPrice = Math.max(0, cart.totalPrice - (item.price * item.quantity));
	cart.updatedAt = Date.now();
	await cart.save();
};

// Helper: load a booking and confirm the requesting doctor owns it.
const loadOwnedBooking = async (bookingId, req, res) => {
	const booking = await Booking.findById(bookingId);
	if (!booking) {
		res.status(404).json({ error: "Booking not found." });
		return null;
	}
	if (req.user.role !== 'doctor' || booking.doctorId.toString() !== req.user._id.toString()) {
		res.status(403).json({ error: "Not authorized to modify this prescription." });
		return null;
	}
	return booking;
};

// ✅ Add one prescribed medicine (picked from inventory) to a booking. Silent — the
// patient is notified only when the doctor presses "Notify patient". Also adds the
// medicine to the patient's cart. Returns the created row (with its _id).
exports.addSupplement = async (req, res) => {
	const { id } = req.params;
	const { medicineId, dosage, instructions } = req.body;

	try {
		if (!medicineId) {
			return res.status(400).json({ error: "A medicine must be selected." });
		}

		const booking = await loadOwnedBooking(id, req, res);
		if (!booking) return;

		const medicine = await Medicine.findById(medicineId);
		if (!medicine) {
			return res.status(404).json({ error: "Selected medicine not found in inventory." });
		}

		booking.recommendedSupplements.push({
			medicineId: medicine._id,
			medicineName: medicine.name,
			dosage: dosage || "",
			instructions: instructions || "",
			// Stays hidden from the patient (and out of their cart) until the
			// doctor submits the prescription -- see publishPrescription.
			published: false,
		});
		await booking.save();

		const created = booking.recommendedSupplements[booking.recommendedSupplements.length - 1];
		return res.status(201).json({ message: "Medicine added to prescription.", supplement: created });
	} catch (error) {
		console.error("Error adding supplement:", error);
		return res.status(500).json({ error: "Server error", details: error.message });
	}
};

// ✅ Edit an existing prescribed medicine's dosage / instructions (realtime, silent).
exports.updateSupplement = async (req, res) => {
	const { id, supplementId } = req.params;
	const { dosage, instructions } = req.body;

	try {
		const booking = await loadOwnedBooking(id, req, res);
		if (!booking) return;

		const supplement = booking.recommendedSupplements.id(supplementId);
		if (!supplement) {
			return res.status(404).json({ error: "Prescribed medicine not found." });
		}

		if (dosage !== undefined) supplement.dosage = dosage;
		if (instructions !== undefined) supplement.instructions = instructions;
		await booking.save();

		return res.status(200).json({ message: "Prescription updated.", supplement });
	} catch (error) {
		console.error("Error updating supplement:", error);
		return res.status(500).json({ error: "Server error", details: error.message });
	}
};

// ✅ Remove a prescribed medicine (realtime). Also removes it from the patient's cart.
exports.deleteSupplement = async (req, res) => {
	const { id, supplementId } = req.params;

	try {
		const booking = await loadOwnedBooking(id, req, res);
		if (!booking) return;

		const supplement = booking.recommendedSupplements.id(supplementId);
		if (!supplement) {
			return res.status(404).json({ error: "Prescribed medicine not found." });
		}

		const medicineId = supplement.medicineId;
		const wasPublished = supplement.published;
		supplement.deleteOne();
		await booking.save();

		if (wasPublished) {
			await removeMedicineFromCart(booking.patientId, booking.doctorId, medicineId);
		}

		return res.status(200).json({ message: "Medicine removed from prescription." });
	} catch (error) {
		console.error("Error deleting supplement:", error);
		return res.status(500).json({ error: "Server error", details: error.message });
	}
};

// ✅ Set the doctor's diagnosis for this consultation (realtime, silent).
exports.updateDiagnosis = async (req, res) => {
	const { id } = req.params;
	const { diagnosis } = req.body;

	try {
		const booking = await loadOwnedBooking(id, req, res);
		if (!booking) return;

		booking.diagnosis = diagnosis || "";
		await booking.save();

		return res.status(200).json({ message: "Diagnosis saved.", diagnosis: booking.diagnosis });
	} catch (error) {
		console.error("Error updating diagnosis:", error);
		return res.status(500).json({ error: "Server error", details: error.message });
	}
};

// ✅ Patient edits their own reason-for-visit on an upcoming (accepted, not yet
// denied) booking — e.g. to add detail they forgot at booking time.
exports.updatePatientIllness = async (req, res) => {
	const { id } = req.params;
	const { patientIllness } = req.body;

	try {
		if (!patientIllness || !patientIllness.trim()) {
			return res.status(400).json({ error: "Description cannot be empty." });
		}

		const booking = await Booking.findById(id);
		if (!booking) {
			return res.status(404).json({ error: "Booking not found" });
		}
		if (booking.patientId.toString() !== req.user._id.toString()) {
			return res.status(403).json({ error: "Not authorized" });
		}
		if (booking.requestAccept !== "accepted") {
			return res.status(400).json({ error: "Only upcoming (accepted) appointments can be edited." });
		}

		booking.patientIllness = patientIllness.trim();
		await booking.save();

		return res.status(200).json({ message: "Description updated.", patientIllness: booking.patientIllness });
	} catch (error) {
		console.error("Error updating patient illness:", error);
		return res.status(500).json({ error: "Server error", details: error.message });
	}
};

// ✅ "Submit Prescription": everything the doctor has been silently saving as
// drafts (medicines, diet/wellness review, yoga) becomes visible to the
// patient in one shot, then the patient is notified. Called explicitly by
// the doctor when they're done -- realtime per-panel Save calls stay silent
// drafts until this runs.
exports.notifyPrescription = async (req, res) => {
	const { id } = req.params;

	try {
		const booking = await loadOwnedBooking(id, req, res);
		if (!booking) return;

		// 1. Medicines: publish any draft rows and add them to the patient's cart.
		const draftSupplements = booking.recommendedSupplements.filter((s) => s.published === false);
		for (const supp of draftSupplements) {
			supp.published = true;
			if (supp.medicineId) {
				try {
					const medicine = await Medicine.findById(supp.medicineId);
					if (medicine) await addMedicineToCart(booking.patientId, booking.doctorId, medicine);
				} catch (e) {
					console.error("Error adding published medicine to cart:", e);
				}
			}
		}
		if (draftSupplements.length) await booking.save();

		// 2. Diet plan + Other Wellness Recommendations (same doctorReview draft).
		try {
			const plan = await AyurvedaDietPlan.findOne({ patientId: booking.patientId });
			if (plan?.doctorReview?.reviewedAt && !plan.doctorReview.published) {
				plan.doctorReview.published = true;
				plan.status = "doctor_approved";
				await plan.save();
			}
		} catch (e) {
			console.error("Error publishing diet plan draft:", e);
		}

		// 3. Yoga plan (patient-scoped AI plan the doctor reviewed).
		try {
			await publishYogaPlanForPatient(booking.patientId);
		} catch (e) {
			console.error("Error publishing yoga plan draft:", e);
		}
		// Legacy booking-scoped manual yoga entries (pre-AI-generation flow),
		// kept for back-compat with any doctor still using the old per-booking
		// asana editor.
		try {
			await publishYogaDraft(id, req.user._id);
		} catch (e) {
			console.error("Error publishing legacy yoga draft:", e);
		}

		const doctorDisplayName = (booking.doctorName && (booking.doctorName.toLowerCase().startsWith('dr.') || booking.doctorName.toLowerCase().startsWith('dr ')))
			? booking.doctorName
			: `Dr. ${booking.doctorName || "Your Doctor"}`;

		const notifyMsg = `${doctorDisplayName} has updated your prescription and treatment plan. Tap to view.`;

		// Debounce: If an unread notification for this booking already exists, update it rather than creating a duplicate
		const existingRecent = await Notification.findOne({
			userId: booking.patientId,
			role: 'patient',
			orderId: id,
			type: 'system',
			isRead: false
		});

		if (existingRecent) {
			existingRecent.message = notifyMsg;
			existingRecent.createdAt = new Date();
			await existingRecent.save();
		} else {
			await new Notification({
				userId: booking.patientId,
				role: 'patient',
				orderId: id,
				type: 'system',
				message: notifyMsg,
				isRead: false
			}).save();
		}

		return res.status(200).json({ message: "Prescription submitted and patient notified." });
	} catch (error) {
		console.error("Error submitting prescription:", error);
		return res.status(500).json({ error: "Server error", details: error.message });
	}
};

// Get all supplements for a booking
exports.getRecommendedSupplements = async (req, res) => {
	const { id } = req.params;

	try {
		const booking = await Booking.findById(id).populate({
			path: 'recommendedSupplements.medicineId',
			select: 'images price name category quantity'
		});

		if (!booking) {
			return res.status(404).json({ error: "Booking not found" });
		}
		if (req.user.role !== 'admin' && booking.patientId.toString() !== req.user._id.toString() && booking.doctorId.toString() !== req.user._id.toString()) {
			return res.status(403).json({ error: "Not authorized" });
		}

		return res.status(200).json({
			message: "Recommended supplements retrieved successfully",
			supplements: booking.recommendedSupplements,
		});
	} catch (error) {
		console.error("Error retrieving supplements:", error);
		return res.status(500).json({ error: "Server error" });
	}
};

// 🔹 Temporary uploader (to push dummy JSON from Postman) removed due to security vulnerability

// ✅ Get bookings by patientId
exports.getBookingsByPatientId = async (req, res) => {
	const { patientId } = req.params;

	if (!patientId) {
		return res.status(400).json({ error: "Patient ID is required" });
	}
	if (req.user.role !== 'admin' && req.user._id.toString() !== patientId) {
		return res.status(403).json({ error: "Not authorized" });
	}

	try {
		const bookings = await Booking.find({ patientId }).populate('doctorId').sort({ createdAt: -1 });

		if (!bookings || bookings.length === 0) {
			return res.status(200).json({ bookings: [] });
		}

		// Process bookings with doctor schedule overrides (cancellations and reschedules)
		const expiredIds = [];
		const processedBookings = bookings.map(booking => {
			const bookingObj = booking.toObject ? booking.toObject() : booking;
			const doctor = booking.doctorId;

			// Resolve the current startTime for the booking based on base template.
			// Older/malformed bookings can have a missing slotId (or one that no
			// longer matches any base slot) -- guard the .toString() calls so a
			// single bad record doesn't 500 the whole list.
			if (doctor && doctor.availableSlots && booking.slotId) {
				const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(booking.dateOfAppointment).getDay()];
				const baseSlots = doctor.availableSlots[dayName] || [];
				const baseSlot = baseSlots.find(s => s._id.toString() === booking.slotId.toString());
				if (baseSlot) {
					bookingObj.timeSlot = baseSlot.startTime;
					bookingObj.timeSlotDuration = baseSlot.duration;
				}
			}

			if (doctor && Array.isArray(doctor.scheduleOverrides) && booking.slotId) {
				const bookingDateStr = new Date(booking.dateOfAppointment).toDateString();
				const override = doctor.scheduleOverrides.find(o => {
					return new Date(o.date).toDateString() === bookingDateStr &&
						   o.targetSlotId && o.targetSlotId.toString() === booking.slotId.toString();
				});

				if (override) {
					if (override.type === 'cancelled') {
						bookingObj.isCancelledByDoctor = true;
						bookingObj.requestAccept = "denied"; // Render as denied/cancelled
						bookingObj.doctorsMessage = override.newReason || "This slot was cancelled by the doctor.";
					} else if (override.type === 'rescheduled') {
						bookingObj.isRescheduledByDoctor = true;
						bookingObj.rescheduledTimeSlot = override.newStartTime;
						bookingObj.originalTimeSlot = bookingObj.timeSlot;
						bookingObj.timeSlot = override.newStartTime; // Dynamically show new time
						if (override.newDuration) bookingObj.timeSlotDuration = override.newDuration;
					}
				}
			}

			// A still-pending request whose slot time has already passed is
			// auto-denied — mirrors the same check on the doctor's side.
			if (bookingObj.requestAccept === 'pending' && hasSlotTimePassed(bookingObj.dateOfAppointment, bookingObj.timeSlot)) {
				bookingObj.requestAccept = 'denied';
				bookingObj.doctorsMessage = bookingObj.doctorsMessage || AUTO_DENY_MESSAGE;
				expiredIds.push(booking._id);
			}

			return bookingObj;
		});

		if (expiredIds.length > 0) {
			await Booking.updateMany(
				{ _id: { $in: expiredIds } },
				{ requestAccept: 'denied', doctorsMessage: AUTO_DENY_MESSAGE }
			);
		}

		return res.status(200).json({
			message: "Bookings retrieved successfully for patient",
			bookings: processedBookings,
		});
	} catch (error) {
		console.error("❌ Error fetching bookings by patient ID:", error);
		return res.status(500).json({ error: "Server error" });
	}
};

// ✅ Get bookings by doctorId
exports.getBookingsByDoctorId = async (req, res) => {
	const { doctorId } = req.params;

	if (!doctorId) {
		return res.status(400).json({ error: "Doctor ID is required" });
	}
	if (req.user.role !== 'admin' && req.user._id.toString() !== doctorId) {
		return res.status(403).json({ error: "Not authorized" });
	}

	try {
		const bookings = await Booking.find({ doctorId }).sort({ createdAt: -1 });

		if (!bookings || bookings.length === 0) {
			return res.status(200).json({ bookings: [] });
		}

		// Pre-calculate returning patients (any accepted booking in the past)
		const pastAcceptedBookings = await Booking.find({ doctorId, requestAccept: 'accepted' }, 'patientEmail');
		const returningEmails = new Set(pastAcceptedBookings.map(b => b.patientEmail).filter(Boolean));

		const doctor = await Doctor.findById(doctorId);
		let processedBookings = bookings;
		const expiredIds = [];
		if (doctor) {
			processedBookings = bookings.map(booking => {
				const bookingObj = booking.toObject ? booking.toObject() : booking;

				// Bookings with a missing/legacy slotId can't be matched against the
				// doctor's current slot templates -- skip that resolution instead of
				// letting a bad record crash the whole list with a 500.
				if (doctor.availableSlots && booking.slotId) {
					const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(booking.dateOfAppointment).getDay()];
					const baseSlots = doctor.availableSlots[dayName] || [];
					const baseSlot = baseSlots.find(s => s._id.toString() === booking.slotId.toString());
					if (baseSlot) {
						bookingObj.timeSlot = baseSlot.startTime;
					}
				}

				// Process bookings with doctor schedule overrides (cancellations and reschedules)
				if (Array.isArray(doctor.scheduleOverrides) && booking.slotId) {
					const bookingDateStr = new Date(booking.dateOfAppointment).toDateString();
					const override = doctor.scheduleOverrides.find(o => {
						return new Date(o.date).toDateString() === bookingDateStr &&
							   o.targetSlotId && o.targetSlotId.toString() === booking.slotId.toString();
					});

					if (override) {
						if (override.type === 'cancelled') {
							bookingObj.isCancelledByDoctor = true;
							bookingObj.requestAccept = "denied"; // Render as denied/cancelled
							bookingObj.doctorsMessage = override.newReason || "This slot was cancelled by you.";
						} else if (override.type === 'rescheduled') {
							bookingObj.isRescheduledByDoctor = true;
							bookingObj.rescheduledTimeSlot = override.newStartTime;
							bookingObj.originalTimeSlot = bookingObj.timeSlot;
							bookingObj.timeSlot = override.newStartTime; // Dynamically show new time
						}
					}
				}

				// A still-pending request whose slot time has already passed is
				// auto-denied — the doctor never gets to act on a stale request.
				if (bookingObj.requestAccept === 'pending' && hasSlotTimePassed(bookingObj.dateOfAppointment, bookingObj.timeSlot)) {
					bookingObj.requestAccept = 'denied';
					bookingObj.doctorsMessage = bookingObj.doctorsMessage || AUTO_DENY_MESSAGE;
					expiredIds.push(booking._id);
				}

				// Tag returning patient status
				if (booking.patientEmail && returningEmails.has(booking.patientEmail)) {
					bookingObj.isReturningPatient = true;
				} else {
					bookingObj.isReturningPatient = false;
				}

				return bookingObj;
			});
		}

		if (expiredIds.length > 0) {
			await Booking.updateMany(
				{ _id: { $in: expiredIds } },
				{ requestAccept: 'denied', doctorsMessage: AUTO_DENY_MESSAGE }
			);
		}

		return res.status(200).json({
			message: "Bookings retrieved successfully for doctor",
			bookings: processedBookings,
		});
	} catch (error) {
		console.error("❌ Error fetching bookings by doctor ID:", error);
		return res.status(500).json({ error: "Server error" });
	}
};

// ✅ Get reviewed bookings by patientId
exports.getReviewedBookingsByPatientId = async (req, res) => {
	const { patientId } = req.params;

	if (!patientId) {
		return res.status(400).json({ error: "Patient ID is required" });
	}
	if (req.user.role !== 'admin' && req.user._id.toString() !== patientId) {
		return res.status(403).json({ error: "Not authorized" });
	}

	try {
		const bookings = await Booking.find({
			patientId,
			review: { $exists: true, $nin: [null, ""] },
		}).sort({ createdAt: -1 });

		if (!bookings || bookings.length === 0) {
			return res.status(404).json({
				message: "No reviewed bookings found for this patient",
			});
		}

		return res.status(200).json({
			message: "Reviewed bookings retrieved successfully for patient",
			bookings,
		});

	} catch (error) {
		console.error("❌ Error fetching reviewed bookings by patient ID:", error);
		return res.status(500).json({ error: "Server error" });
	}
};

// ✅ Get reviewed bookings by doctorId
exports.getReviewedBookingsForDoctorId = async (req, res) => {
	const { doctorId } = req.params;

	if (!doctorId) {
		return res.status(400).json({ error: "Doctor ID is required" });
	}
	if (req.user.role !== 'admin' && req.user._id.toString() !== doctorId) {
		return res.status(403).json({ error: "Not authorized" });
	}

	try {
		const bookings = await Booking.find({
			doctorId,
			review: { $exists: true, $nin: [null, ""] },
		}).sort({ createdAt: -1 });

		if (!bookings || bookings.length === 0) {
			return res.status(404).json({
				message: "No reviewed bookings found for this doctor",
			});
		}

		return res.status(200).json({
			message: "Reviewed bookings retrieved successfully for doctor",
			bookings,
		});
	} catch (error) {
		console.error("❌ Error fetching reviewed bookings by doctor ID:", error);
		return res.status(500).json({ error: "Server error" });
	}
};

// Helper function to emit events to a doctor's open SSE connections
const notifyDoctor = (doctorId) => {
	const doctorConns = doctorConnections.get(doctorId.toString());
	if (doctorConns) {
		doctorConns.forEach((res) => {
			res.write(`data: {"type": "booking_update"}\n\n`);
		});
	}
};

// ✅ Get a single booking by ID — single source of truth for the Prescribe page.
// Scoped to the assigned doctor, the patient themselves, or an admin.
exports.getBookingById = async (req, res) => {
	const { id } = req.params;

	try {
		const booking = await Booking.findById(id)
			.populate('patientId', 'firstName lastName email phone gender age zipCode address profileImage')
			.populate('patientSharedRecords.referencedBookingId', 'doctorName dateOfAppointment recommendedSupplements diagnosis patientIllness');

		if (!booking) {
			return res.status(404).json({ error: "Booking not found" });
		}

		const isOwnerDoctor = req.user.role === 'doctor' && booking.doctorId.toString() === req.user._id.toString();
		const isOwnerPatient = req.user.role === 'patient' && booking.patientId._id.toString() === req.user._id.toString();

		if (req.user.role !== 'admin' && !isOwnerDoctor && !isOwnerPatient) {
			return res.status(403).json({ error: "Not authorized to view this booking" });
		}

		return res.status(200).json({ booking });
	} catch (error) {
		console.error("Error fetching booking by ID:", error);
		return res.status(500).json({ error: "Server error" });
	}
};

// ✅ Get this doctor's own past accepted bookings with a specific patient
// (used for the Prescription History section — deliberately NOT other doctors' bookings).
exports.getDoctorPatientHistory = async (req, res) => {
	const { patientId } = req.params;

	if (!patientId) {
		return res.status(400).json({ error: "Patient ID is required" });
	}

	try {
		if (req.user.role !== 'admin' && req.user.role !== 'doctor') {
			return res.status(403).json({ error: "Access denied" });
		}
		const doctorId = req.user.role === 'admin' ? req.query.doctorId : req.user._id;
		if (!doctorId) {
			return res.status(400).json({ error: "Doctor ID is required" });
		}

		const [bookings, doctor] = await Promise.all([
			Booking.find({
				doctorId,
				patientId,
				requestAccept: 'accepted',
				dateOfAppointment: { $lt: new Date() }
			}).sort({ dateOfAppointment: -1 }),
			Doctor.findById(doctorId)
		]);

		const processedBookings = bookings.map(booking => {
			const bookingObj = booking.toObject ? booking.toObject() : booking;

			if (doctor && doctor.availableSlots && booking.slotId) {
				const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(booking.dateOfAppointment).getDay()];
				const baseSlots = doctor.availableSlots[dayName] || [];
				const baseSlot = baseSlots.find(s => s._id && s._id.toString() === booking.slotId.toString());
				if (baseSlot) {
					bookingObj.timeSlot = baseSlot.startTime;
					bookingObj.timeSlotDuration = baseSlot.duration;
				}
			}

			if (doctor && Array.isArray(doctor.scheduleOverrides) && booking.slotId) {
				const bookingDateStr = new Date(booking.dateOfAppointment).toDateString();
				const override = doctor.scheduleOverrides.find(o => {
					return new Date(o.date).toDateString() === bookingDateStr &&
						   o.targetSlotId && o.targetSlotId.toString() === booking.slotId.toString();
				});

				if (override && override.type === 'rescheduled') {
					bookingObj.timeSlot = override.newStartTime;
					if (override.newDuration) bookingObj.timeSlotDuration = override.newDuration;
				}
			}

			return bookingObj;
		});

		return res.status(200).json({ bookings: processedBookings });
	} catch (error) {
		console.error("Error fetching doctor-patient history:", error);
		return res.status(500).json({ error: "Server error" });
	}
};

exports.streamNotifications = (req, res) => {
	const { doctorId } = req.params;

	// Set headers for SSE
	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Cache-Control', 'no-cache');
	res.setHeader('Connection', 'keep-alive');
	res.flushHeaders(); // flush the headers to establish connection

	// Add the connection to our map
	if (!doctorConnections.has(doctorId.toString())) {
		doctorConnections.set(doctorId.toString(), new Set());
	}
	doctorConnections.get(doctorId.toString()).add(res);

	// Send an initial connected message
	res.write('data: {"type": "connected"}\n\n');

	// Remove connection when client closes it
	req.on('close', () => {
		const doctorConns = doctorConnections.get(doctorId.toString());
		if (doctorConns) {
			doctorConns.delete(res);
			if (doctorConns.size === 0) {
				doctorConnections.delete(doctorId.toString());
			}
		}
	});
};
