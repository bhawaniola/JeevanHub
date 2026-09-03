const cron = require('node-cron');
const mongoose = require('mongoose');

// Models
const Booking = require('./models/Booking');
const Patient = require('./models/Patient');
const Doctor = require('./models/Doctor');
const DietYoga = require('./models/DietYoga');
const AyurvedaDietPlan = require('./models/AyurvedaDietPlan');
const AyurvedaYogaPlan = require('./models/AyurvedaYogaPlan');

const Notification = require('./models/Notification');

const { createNotification } = require('./controllers/notificationController');
const { sendWhatsAppMessage } = require('./controllers/whatsappController');

// Best-effort reminder dispatch: in-app notification always saved, WhatsApp
// send is fire-and-forget since no verified WhatsApp Business templates exist yet.
async function dispatchReminder({ userId, role, refId, type, message, phone, whatsappTemplate, whatsappComponents }) {
	// For daily routine reminders ('diet' / 'yoga'), auto-archive prior unread reminders
	// so the patient's inbox only keeps the fresh active routine rather than accumulating daily spam.
	if (type === 'diet' || type === 'yoga') {
		try {
			await Notification.updateMany(
				{ userId, role, type, isRead: false },
				{ $set: { isRead: true } }
			);
		} catch (e) {
			console.error(`   -> ⚠️ Failed to archive old ${type} reminders:`, e.message);
		}
	}

	try {
		await createNotification(userId, role, refId, message, type);
	} catch (error) {
		console.error(`   -> ❌ In-app notification failed:`, error.message);
	}

	if (phone) {
		try {
			await sendWhatsAppMessage(phone, whatsappTemplate, whatsappComponents);
		} catch (error) {
			console.error(`   -> ❌ WhatsApp send failed:`, error.message);
		}
	}
}

// ==========================================
// ⚙️ CONFIGURATION & TIMERS
// ==========================================
// Morning routines (Yoga + Diet): 4:00 AM IST
const MORNING_ROUTINE_TIME = process.env.MORNING_ROUTINE_TIME || '0 4 * * *';
// Evening appointment reminders for tomorrow: 8:00 PM IST
const APPOINTMENT_REMINDER_TIME = process.env.APPOINTMENT_REMINDER_TIME || '0 20 * * *';

const startScheduler = () => {
	console.log(`📅 Schedulers active:`);
	console.log(`   - Morning Routines (Diet & Yoga): ${MORNING_ROUTINE_TIME} (Asia/Kolkata)`);
	console.log(`   - Evening Appointment Reminders: ${APPOINTMENT_REMINDER_TIME} (Asia/Kolkata)`);

	// 1. Morning Cron: Same-Day Diet & Yoga Routines (4:00 AM)
	cron.schedule(MORNING_ROUTINE_TIME, async () => {
		console.log('\n☀️ --- MORNING ROUTINES SCHEDULER START ---');
		const today = new Date();
		try {
			await sendDietPlans(today);
			await sendYogaPlans();
			console.log('✅ Morning routine notifications processed.');
		} catch (error) {
			console.error('❌ Morning Routines Error:', error);
		}
		console.log('☀️ --- MORNING ROUTINES SCHEDULER END ---\n');
	}, { scheduled: true, timezone: "Asia/Kolkata" });

	// 2. Evening Cron: Next-Day Appointment Reminders (8:00 PM)
	cron.schedule(APPOINTMENT_REMINDER_TIME, async () => {
		console.log('\n🌙 --- APPOINTMENT REMINDERS SCHEDULER START ---');
		const today = new Date();
		const tomorrow = new Date(today);
		tomorrow.setDate(today.getDate() + 1);

		const startOfTomorrow = new Date(new Date(tomorrow).setHours(0, 0, 0, 0));
		const endOfTomorrow = new Date(new Date(tomorrow).setHours(23, 59, 59, 999));

		try {
			await sendAppointmentReminders(startOfTomorrow, endOfTomorrow);
			console.log('✅ Appointment reminders processed.');
		} catch (error) {
			console.error('❌ Appointment Reminders Error:', error);
		}
		console.log('🌙 --- APPOINTMENT REMINDERS SCHEDULER END ---\n');
	}, { scheduled: true, timezone: "Asia/Kolkata" });
};

// ==========================================
// 1. APPOINTMENT REMINDERS (Using Patient & Doctor Tables)
// ==========================================
async function sendAppointmentReminders(start, end) {
	console.log('👉 Checking Appointments...');

	const bookings = await Booking.find({
		dateOfAppointment: { $gte: start, $lte: end },
		requestAccept: 'accepted'
	})
		.populate('patientId') // Joins with Patient Table
		.populate('doctorId'); // Joins with Doctor Table

	for (const booking of bookings) {
		// Check if patient and doctor data exist after populate
		if (booking.patientId && booking.doctorId) {
			const doctorFirst = booking.doctorId.firstName || booking.doctorId.firstname || '';
			const doctorLast = booking.doctorId.lastName || booking.doctorId.lastname || '';
			let rawDocName = [doctorFirst, doctorLast].filter(Boolean).join(' ').trim() || booking.doctorName || 'your doctor';
			const realDoctorName = rawDocName.toLowerCase().startsWith('dr.') || rawDocName.toLowerCase().startsWith('dr ')
				? rawDocName
				: `Dr. ${rawDocName}`;

			const patientFirst = booking.patientId.firstName || '';
			const patientLast = booking.patientId.lastName || '';
			const realPatientName = [patientFirst, patientLast].filter(Boolean).join(' ').trim() || booking.patientName || 'Patient';

			console.log(`   -> Reminding ${realPatientName} with ${realDoctorName}...`);

			const meetUrl = (booking.dailyRoomUrl && booking.dailyRoomUrl !== 'no')
				? booking.dailyRoomUrl
				: (booking.meetLink && booking.meetLink !== 'no' ? booking.meetLink : '');

			const linkToSend = meetUrl || 'Link will be shared shortly';
			const appointmentMessage = meetUrl
				? `Reminder: you have an appointment with ${realDoctorName} tomorrow. Join link: ${meetUrl}`
				: `Reminder: you have an appointment with ${realDoctorName} tomorrow. Link will be shared shortly.`;

			await dispatchReminder({
				userId: booking.patientId._id,
				role: 'patient',
				refId: booking._id.toString(),
				type: 'appointment',
				message: appointmentMessage,
				phone: booking.patientId.phone || null,
				whatsappTemplate: 'appointment_reminder',
				whatsappComponents: [{
					type: 'body',
					parameters: [
						{ type: 'text', text: realPatientName },
						{ type: 'text', text: realDoctorName },
						{ type: 'text', text: linkToSend }
					]
				}]
			});
		}
	}
}

// ==========================================
// 2. DIET PLANS (Same-Day Morning Dispatch with Deduplication)
// ==========================================
async function sendDietPlans(targetDate = new Date()) {
	console.log('👉 Checking Diet Plans...');

	const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
	const dayName = daysOfWeek[targetDate.getDay()];
	const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);

	const processedPatients = new Set();

	// 1. Primary: Check modern AyurvedaDietPlan collection
	const modernPlans = await AyurvedaDietPlan.find({}).populate('patientId');
	for (const plan of modernPlans) {
		if (!plan.patientId || processedPatients.has(plan.patientId._id.toString())) continue;

		const activeWeeklyPlan = (plan.doctorReview?.published && plan.doctorReview?.weeklyPlan?.length)
			? plan.doctorReview.weeklyPlan
			: plan.weeklyPlan;

		const dayPlan = activeWeeklyPlan?.find(d => d.day?.toLowerCase() === dayName);
		if (!dayPlan) continue;

		const b = (dayPlan.breakfast?.items || []).join(', ') || dayPlan.breakfast?.portion || '-';
		const l = (dayPlan.lunch?.items || []).join(', ') || dayPlan.lunch?.portion || '-';
		const d = (dayPlan.dinner?.items || []).join(', ') || dayPlan.dinner?.portion || '-';
		const dietSummary = `Breakfast: ${b}, Lunch: ${l}, Dinner: ${d}`;

		const realPatientName = [plan.patientId.firstName, plan.patientId.lastName].filter(Boolean).join(' ').trim() || 'Patient';
		processedPatients.add(plan.patientId._id.toString());

		console.log(`   -> Sending today's (${capitalizedDay}) diet to ${realPatientName}...`);

		await dispatchReminder({
			userId: plan.patientId._id,
			role: 'patient',
			refId: plan._id.toString(),
			type: 'diet',
			message: `🌿 Today's diet plan (${capitalizedDay}): ${dietSummary}`,
			phone: plan.patientId.phone || null,
			whatsappTemplate: 'diet_plan_reminder',
			whatsappComponents: [{
				type: 'body',
				parameters: [
					{ type: 'text', text: realPatientName },
					{ type: 'text', text: dietSummary }
				]
			}]
		});
	}

	// 2. Fallback: Legacy DietYoga collection (for patients not yet in AyurvedaDietPlan)
	const legacyPlans = await DietYoga.find({}).populate('patient');
	for (const plan of legacyPlans) {
		if (!plan.patient || processedPatients.has(plan.patient._id.toString())) continue;

		const dailyDiet = plan.diet?.weekly?.[dayName];
		if (!dailyDiet) continue;

		const dietSummary = `Breakfast: ${dailyDiet.breakfast || '-'}, Lunch: ${dailyDiet.lunch || '-'}, Dinner: ${dailyDiet.dinner || '-'}`;
		const realPatientName = [plan.patient.firstName, plan.patient.lastName].filter(Boolean).join(' ').trim() || 'Patient';
		processedPatients.add(plan.patient._id.toString());

		console.log(`   -> Sending today's (${capitalizedDay}) legacy diet to ${realPatientName}...`);

		await dispatchReminder({
			userId: plan.patient._id,
			role: 'patient',
			refId: plan._id.toString(),
			type: 'diet',
			message: `🌿 Today's diet plan (${capitalizedDay}): ${dietSummary}`,
			phone: plan.patient.phone || null,
			whatsappTemplate: 'diet_plan_reminder',
			whatsappComponents: [{
				type: 'body',
				parameters: [
					{ type: 'text', text: realPatientName },
					{ type: 'text', text: dietSummary }
				]
			}]
		});
	}
}

// ==========================================
// 3. YOGA PLANS (Same-Day Morning Dispatch with Deduplication)
// ==========================================
async function sendYogaPlans() {
	console.log('👉 Checking Yoga Routines...');

	const processedPatients = new Set();

	// 1. Primary: Check modern AyurvedaYogaPlan collection
	const modernPlans = await AyurvedaYogaPlan.find({}).populate('patientId');
	for (const plan of modernPlans) {
		if (!plan.patientId || processedPatients.has(plan.patientId._id.toString())) continue;

		const morningList = (plan.doctorReview?.published && plan.doctorReview?.morning?.length)
			? plan.doctorReview.morning
			: plan.morning;
		const eveningList = (plan.doctorReview?.published && plan.doctorReview?.evening?.length)
			? plan.doctorReview.evening
			: plan.evening;

		if ((!morningList || morningList.length === 0) && (!eveningList || eveningList.length === 0)) {
			continue;
		}

		let yogaMessage = "";
		if (morningList && morningList.length > 0) {
			yogaMessage += "☀️ Morning: " + morningList.map(item => item.name).join(", ") + ". ";
		}
		if (eveningList && eveningList.length > 0) {
			yogaMessage += "🌙 Evening: " + eveningList.map(item => item.name).join(", ");
		}

		const realPatientName = [plan.patientId.firstName, plan.patientId.lastName].filter(Boolean).join(' ').trim() || 'Patient';
		processedPatients.add(plan.patientId._id.toString());

		console.log(`   -> Sending today's Yoga routine to ${realPatientName}...`);

		await dispatchReminder({
			userId: plan.patientId._id,
			role: 'patient',
			refId: plan._id.toString(),
			type: 'yoga',
			message: `🧘 Today's yoga routine: ${yogaMessage}`,
			phone: plan.patientId.phone || null,
			whatsappTemplate: 'yoga_plan_reminder',
			whatsappComponents: [{
				type: 'body',
				parameters: [
					{ type: 'text', text: realPatientName },
					{ type: 'text', text: yogaMessage }
				]
			}]
		});
	}

	// 2. Fallback: Legacy DietYoga collection (for patients not yet in AyurvedaYogaPlan)
	const legacyPlans = await DietYoga.find({}).populate('patient');
	for (const plan of legacyPlans) {
		if (!plan.patient || processedPatients.has(plan.patient._id.toString())) continue;

		const morningList = plan.yoga?.morning;
		const eveningList = plan.yoga?.evening;

		if ((!morningList || morningList.length === 0) && (!eveningList || eveningList.length === 0)) {
			continue;
		}

		let yogaMessage = "";
		if (morningList && morningList.length > 0) {
			yogaMessage += "☀️ Morning: " + morningList.map(item => item.name).join(", ") + ". ";
		}
		if (eveningList && eveningList.length > 0) {
			yogaMessage += "🌙 Evening: " + eveningList.map(item => item.name).join(", ");
		}

		const realPatientName = [plan.patient.firstName, plan.patient.lastName].filter(Boolean).join(' ').trim() || 'Patient';
		processedPatients.add(plan.patient._id.toString());

		console.log(`   -> Sending today's legacy Yoga routine to ${realPatientName}...`);

		await dispatchReminder({
			userId: plan.patient._id,
			role: 'patient',
			refId: plan._id.toString(),
			type: 'yoga',
			message: `🧘 Today's yoga routine: ${yogaMessage}`,
			phone: plan.patient.phone || null,
			whatsappTemplate: 'yoga_plan_reminder',
			whatsappComponents: [{
				type: 'body',
				parameters: [
					{ type: 'text', text: realPatientName },
					{ type: 'text', text: yogaMessage }
				]
			}]
		});
	}
}

// ==========================================
// Password Reset OTP
// ==========================================
async function sendOTPWhatsApp(phone, firstName, otp) {
	try {
		const components = [
			{
				type: "body",
				parameters: [
					{ type: "text", text: firstName }, // {{1}} User's Name
					{ type: "text", text: otp }       // {{2}} The 5-digit OTP
				]
			}
		];

		const { sendWhatsAppMessage } = require('./controllers/whatsappController');
		
		await sendWhatsAppMessage(
			phone,
			"password_reset_otp", 
			components
		);
		console.log(`✅ OTP sent to ${phone}`);
	} catch (error) {
		console.error("❌ WhatsApp OTP Error:", error);
		throw new Error("Failed to send WhatsApp message");
	}
}


module.exports = {
	startScheduler,
	sendOTPWhatsApp
};