import { useState, useContext, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { ArrowLeft, Clock, Loader2, Plus, Star, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/date";
import { AuthContext } from "../../context/AuthContext";
import { authFetch } from "../../utils/authFetch";
import { BACKEND_URL, RAZORPAY_KEY_ID } from "../../config";
import defaultProfilePic from "../../media/default-profile.png";

const getLocalDateString = (d = new Date()) => {
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

function DoctorDetail() {
	const location = useLocation();
	const navigate = useNavigate();
	const { doctor } = location.state;

	const specializations = Array.isArray(doctor.specialization)
		? doctor.specialization
		: (doctor.specialization || "").toString().split(",").map((s) => s.trim()).filter(Boolean);

	const { auth } = useContext(AuthContext);
	const patientFirstName = auth.user?.firstName || "Patient";
	const patientLastName = auth.user?.lastName || "";
	const patientGender = auth.user?.gender;
	const patientAge = auth.user?.age;

	const patientName = patientFirstName + " " + patientLastName;

	const [selectedTime, setSelectedTime] = useState(null);
	const [patientIllness, setPatientIllness] = useState("");

	useEffect(() => {
		window.scrollTo(0, 0);
	}, []);
	const [dateOfAppointment, setDateOfAppointment] = useState(getLocalDateString());
	const [availableSlots, setAvailableSlots] = useState([]);
	const [doctorUpiId, setDoctorUpiId] = useState(doctor.upiId || "");
	const [paymentModalOpen, setPaymentModalOpen] = useState(false);
	const [currentBooking, setCurrentBooking] = useState(null);
	const [screenshotFiles, setScreenshotFiles] = useState([]);
	const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
	const [payingViaRazorpay, setPayingViaRazorpay] = useState(false);
	const [showManualUpi, setShowManualUpi] = useState(false);
	const [uploadAlert, setUploadAlert] = useState(null);
	const [timeLeft, setTimeLeft] = useState(600);
	const [loadingSlots, setLoadingSlots] = useState(false);
	const [showAllSlots, setShowAllSlots] = useState(false);
	const [zoomImage, setZoomImage] = useState(false);
	const [carouselStartDate, setCarouselStartDate] = useState(getLocalDateString());

	useEffect(() => {
		if (!paymentModalOpen || !currentBooking) return;

		const bookingTime = new Date(currentBooking.createdAt).getTime();
		const updateTimer = () => {
			const now = new Date().getTime();
			const diffInSeconds = Math.floor((bookingTime + 10 * 60 * 1000 - now) / 1000);
			if (diffInSeconds <= 0) {
				setTimeLeft(0);
				handleCancelPayment(true);
			} else {
				setTimeLeft(diffInSeconds);
			}
		};

		updateTimer();
		const interval = setInterval(updateTimer, 1000);
		return () => clearInterval(interval);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [paymentModalOpen, currentBooking]);

	// Paid slots no longer require the doctor to have a UPI ID on file --
	// Razorpay is a platform-level gateway, not tied to a per-doctor payout ID.
	const filteredSlots = availableSlots || [];

	const dates = useMemo(() => {
		const d = [];
		const [year, month, day] = carouselStartDate.split("-").map(Number);
		for (let i = 0; i < 14; i++) {
			const date = new Date(year, month - 1, day);
			date.setDate(date.getDate() + i);
			d.push(date);
		}
		return d;
	}, [carouselStartDate]);
	const [reviews, setReviews] = useState([]);
	const [statusMessage, setStatusMessage] = useState({ message: "", type: "" });

	const getPatientIdFromToken = () => {
		const token = localStorage.getItem("token");
		if (token) {
			try {
				const decoded = jwtDecode(token);
				return decoded.id || decoded.userId || null;
			} catch (e) {
				console.error("Failed to decode token:", e);
				return null;
			}
		}
		return null;
	};

	const patientId = getPatientIdFromToken();

	const fetchSlots = async () => {
		if (!dateOfAppointment) return;
		setLoadingSlots(true);
		try {
			const token = localStorage.getItem("token");
			const res = await authFetch(`${BACKEND_URL}/api/doctors/${doctor.id || doctor._id}/slots/${dateOfAppointment}`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			const data = await res.json();
			if (res.ok) {
				setAvailableSlots(data.slots || []);
				if (data.upiId !== undefined) {
					setDoctorUpiId(data.upiId);
				}
			}
		} catch (e) {
			console.error("Error fetching slots", e);
		} finally {
			setLoadingSlots(false);
		}
	};

	const handleBookAppointment = async () => {
		if (selectedTime && patientIllness && dateOfAppointment) {
			const email = localStorage.getItem("email");
			const role = localStorage.getItem("role");

			const convertTo24Hour = (timeStr) => {
				let [time, modifier] = timeStr.split(" ");
				let [hours, minutes] = time.split(":");

				if (modifier === "PM" && hours !== "12") {
					hours = parseInt(hours, 10) + 12;
				}
				if (modifier === "AM" && hours === "12") {
					hours = "00";
				}

				return `${hours}:${minutes}`;
			};

			const time24 = convertTo24Hour(selectedTime.startTime);
			const [year, month, day] = dateOfAppointment.split("-");
			const [hours, minutes] = time24.split(":");

			if (!patientId) {
				setStatusMessage({ message: "Authentication failed. Please log in again.", type: "error" });
				return;
			}

			if (role !== "patient") {
				setStatusMessage({ message: "Only patients can book appointments.", type: "error" });
				return;
			}

			const patientEmail = localStorage.getItem("email");

			let bookingData = {
				doctorId: doctor.id || doctor._id,
				doctorName: doctor.name,
				doctorEmail: doctor.email,
				slotId: selectedTime._id,
				dateOfAppointment: dateOfAppointment,
				patientId: patientId,
				patientEmail: patientEmail,
				email: email,
				patientName: patientName,
				patientGender: patientGender,
				patientAge: patientAge,
				patientIllness: patientIllness,
				amountPaid: selectedTime.fee !== undefined ? selectedTime.fee : doctor.pricepoint || 0,
				meetLink: "no",
			};

			if (role === "patient") {
				bookingData.email = email;
			} else {
				alert("Only patients can book appointments.");
				return;
			}

			try {
				const token = localStorage.getItem("token");
				const response = await authFetch(`${BACKEND_URL}/api/bookings`, {
					method: "POST",
					headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
					body: JSON.stringify(bookingData),
				});

				const result = await response.json();

				if (response.ok) {
					if (bookingData.amountPaid > 0) {
						setCurrentBooking(result.booking);
						setShowManualUpi(false);
						setPaymentModalOpen(true);
					} else {
						alert("Appointment booked successfully!");
					}
				} else {
					alert(result.error || "Failed to book appointment");
				}
			} catch (error) {
				console.error("Error booking appointment:", error);
			}
		} else {
			setStatusMessage({ message: "Please fill all fields and select a time slot.", type: "error" });
		}
	};

	const handleRazorpayPayment = async () => {
		setPayingViaRazorpay(true);
		try {
			const token = localStorage.getItem("token");
			const res = await authFetch(`${BACKEND_URL}/api/payment/create-order`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
				body: JSON.stringify({ amount: currentBooking.amountPaid }),
			});
			const razorpayOrder = await res.json();
			if (!res.ok) {
				throw new Error(razorpayOrder.error || "Could not start payment");
			}

			const options = {
				key: RAZORPAY_KEY_ID,
				amount: razorpayOrder.amount,
				currency: razorpayOrder.currency,
				name: "JeevanHub",
				description: `Consultation fee — Dr. ${doctor.firstName} ${doctor.lastName}`,
				order_id: razorpayOrder.id,

				handler: async function (response) {
					try {
						const verifyRes = await authFetch(`${BACKEND_URL}/api/bookings/${currentBooking._id}/verify-payment`, {
							method: "PUT",
							headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
							body: JSON.stringify({
								razorpayOrderId: response.razorpay_order_id,
								razorpayPaymentId: response.razorpay_payment_id,
								razorpaySignature: response.razorpay_signature,
							}),
						});
						const verifyData = await verifyRes.json();
						if (!verifyRes.ok) throw new Error(verifyData.error || "Payment verification failed");

						setPaymentModalOpen(false);
						setCurrentBooking(null);
						alert("Payment successful! Your appointment is confirmed.");
						fetchSlots();
					} catch (err) {
						console.error("Error verifying payment:", err);
						alert(`Payment was received but we could not confirm it: ${err.message}. Please contact support with payment id ${response.razorpay_payment_id}.`);
					} finally {
						setPayingViaRazorpay(false);
					}
				},

				modal: {
					ondismiss: () => setPayingViaRazorpay(false),
				},

				prefill: {
					name: patientName,
				},

				theme: {
					color: "#556b2f",
				},
			};

			const rzp = new window.Razorpay(options);
			rzp.on("payment.failed", () => {
				alert("Payment failed. Please try again.");
				setPayingViaRazorpay(false);
			});
			rzp.open();
		} catch (err) {
			console.error("Payment error:", err);
			alert(err.message || "Payment failed");
			setPayingViaRazorpay(false);
		}
	};

	const handleUploadProof = async (e) => {
		e.preventDefault();
		if (screenshotFiles.length === 0) {
			alert("Please choose at least one screenshot file to upload.");
			return;
		}

		setUploadingScreenshot(true);
		const formData = new FormData();
		screenshotFiles.forEach((file) => {
			formData.append("paymentScreenshots", file);
		});

		try {
			const token = localStorage.getItem("token");
			const response = await authFetch(`${BACKEND_URL}/api/bookings/${currentBooking._id}/payment`, {
				method: "POST",
				headers: { Authorization: `Bearer ${token}` },
				body: formData,
			});

			const result = await response.json();
			if (response.ok) {
				setPaymentModalOpen(false);
				setCurrentBooking(null);
				setScreenshotFiles([]);
				alert("Payment proof uploaded! Your appointment is confirmed.");
				fetchSlots();
			} else {
				alert(result.error || "Failed to upload payment proof.");
			}
		} catch (error) {
			console.error("Error uploading payment proof:", error);
			alert("Failed to upload payment proof.");
		} finally {
			setUploadingScreenshot(false);
		}
	};

	const handleCancelPayment = async (autoCancel = false) => {
		if (!autoCancel && !window.confirm("Are you sure you want to cancel booking? The held slot will be released immediately.")) return;

		const bookingIdToCancel = currentBooking._id;

		setPaymentModalOpen(false);
		setCurrentBooking(null);
		setScreenshotFiles([]);

		try {
			const token = localStorage.getItem("token");
			const response = await authFetch(`${BACKEND_URL}/api/bookings/delete/${bookingIdToCancel}`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${token}` },
			});

			if (response.ok) {
				alert(
					autoCancel
						? "Your 10-minute payment window has expired. The slot has been released."
						: "Booking cancelled. The slot has been released.",
				);
				fetchSlots();
			} else {
				const result = await response.json();
				alert(autoCancel ? "Your 10-minute payment window has expired." : result.error || "Failed to release the slot.");
			}
		} catch (error) {
			console.error("Error cancelling booking:", error);
			alert(autoCancel ? "Your 10-minute payment window has expired." : "Failed to cancel booking.");
		}
	};

	useEffect(() => {
		const fetchReviews = async () => {
			try {
				const res = await fetch(`${BACKEND_URL}/api/bookings/reviews/${doctor.email}`);
				setReviews(await res.json());
			} catch (err) {
				console.error("Error fetching reviews:", err);
			}
		};
		fetchReviews();
	}, [doctor.email]);

	useEffect(() => {
		fetchSlots();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [dateOfAppointment, doctor._id, doctor.id]);

	const formatDateLabel = (dateObj) => {
		const today = new Date();
		const tomorrow = new Date();
		tomorrow.setDate(today.getDate() + 1);

		const dateStr = formatDate(dateObj);
		if (dateStr === formatDate(today)) return "Today";
		if (dateStr === formatDate(tomorrow)) return "Tomorrow";
		return dateObj.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
	};

	const isSlotPassed = (timeStr) => {
		if (dateOfAppointment !== getLocalDateString()) return false;
		const [time, modifier] = timeStr.split(" ");
		let [hours, minutes] = time.split(":").map(Number);
		if (modifier === "PM" && hours !== 12) hours += 12;
		if (modifier === "AM" && hours === 12) hours = 0;
		const slotTime = new Date();
		slotTime.setHours(hours, minutes, 0, 0);
		return slotTime <= new Date();
	};

	const formatTime12Hour = (time24) => {
		if (!time24) return "";
		const [hours, minutes] = time24.split(":");
		const h = parseInt(hours, 10);
		const ampm = h >= 12 ? "PM" : "AM";
		const h12 = h % 12 || 12;
		return `${h12}:${minutes} ${ampm}`;
	};

	const currentProfilePic =
		doctor.profileImage && doctor.profileImage !== "undefined" && doctor.profileImage !== "null"
			? doctor.profileImage
			: defaultProfilePic;

	return (
		<main className="bg-background">
			<div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 lg:px-8">
				<button
					onClick={() => navigate(-1)}
					className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
				>
					<ArrowLeft size={16} />
					Back to Doctors
				</button>
			</div>
			<div className="mx-auto grid max-w-5xl gap-6 px-4 pb-10 pt-2 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:px-8">
				<div className="flex flex-col gap-6">
					<div className="rounded-(--jh-radius-lg) bg-card p-5 shadow-(--jh-shadow-rest) sm:p-6">
						<div className="flex items-start gap-4">
							<img
								src={currentProfilePic}
								alt="Doctor"
								onClick={() => setZoomImage(true)}
								className="size-20 shrink-0 cursor-zoom-in rounded-full border border-border object-cover"
							/>
							<div className="min-w-0 flex-1">
								<h1 className="font-display text-2xl text-foreground">{doctor.name.replace(/^Dr\.?\s*/i, "")}</h1>
								<p className="text-sm text-muted-foreground">{parseInt(doctor.experience) || doctor.experience} years experience</p>
								<div className="mt-2 flex flex-wrap gap-1.5">
									{specializations.map((spec, idx) => (
										<Badge key={idx} variant="secondary">
											{spec}
										</Badge>
									))}
								</div>
							</div>
						</div>

						<div className="mt-4 border-t border-border pt-4">
							<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Education</p>
							<p className="mt-1 text-sm text-foreground">{doctor.education}</p>
						</div>
					</div>

					<div className="rounded-(--jh-radius-lg) bg-card p-5 shadow-(--jh-shadow-rest) sm:p-6">
						<h2 className="font-display text-xl text-foreground">Patient reviews</h2>
						{reviews.length > 0 ? (
							<div className="mt-3 flex flex-col gap-3">
								{reviews.map((r, i) => (
									<div key={i} className="rounded-(--jh-radius-md) bg-secondary/60 p-3">
										<p className="flex items-center gap-1 text-sm text-foreground">
											<strong className="font-semibold">{r.patientName}</strong>
											<span className="flex items-center gap-0.5 text-(--jh-turmeric-gold)">
												{r.rating} <Star size={12} className="fill-current" />
											</span>
										</p>
										<p className="mt-1 text-sm text-muted-foreground">{r.review}</p>
										<p className="mt-1 text-xs text-muted-foreground">{formatDate(r.dateOfAppointment)}</p>
									</div>
								))}
							</div>
						) : (
							<p className="mt-2 text-sm text-muted-foreground">No reviews yet for this doctor.</p>
						)}
					</div>
				</div>

				<div className="flex flex-col rounded-(--jh-radius-lg) bg-card p-5 shadow-(--jh-shadow-rest) sm:p-6">
					<div className="mb-5">
						<div className="mb-2 flex items-center justify-between gap-2">
							<Label className="font-semibold">Select date</Label>
							<input
								type="date"
								min={getLocalDateString()}
								value={carouselStartDate}
								onChange={(e) => {
									if (e.target.value) {
										setCarouselStartDate(e.target.value);
										setDateOfAppointment(e.target.value);
										setSelectedTime(null);
										setShowAllSlots(false);
									}
								}}
								className="rounded-md border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
							/>
						</div>
						<div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
							{dates.map((d) => {
								const dateStr = getLocalDateString(d);
								const isSelected = dateOfAppointment === dateStr;
								return (
									<button
										key={dateStr}
										onClick={() => {
											setDateOfAppointment(dateStr);
											setSelectedTime(null);
											setShowAllSlots(false);
										}}
										className={cn(
											"rounded-(--jh-radius-md) px-2.5 py-2 text-center text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
											isSelected ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-foreground hover:bg-secondary",
										)}
									>
										{formatDateLabel(d)}
									</button>
								);
							})}
						</div>
					</div>

					<p className="text-sm font-semibold text-foreground">Available slots</p>
					<div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
						{loadingSlots ? (
							<p className="text-sm text-muted-foreground">Loading slots...</p>
						) : filteredSlots.length > 0 ? (
							(showAllSlots ? filteredSlots : filteredSlots.slice(0, 4)).map((slot, idx) => {
								const isBooked = slot.remainingCapacity <= 0;
								const isPast = isSlotPassed(slot.startTime);
								const isDisabled = isBooked || isPast;
								const isSelected = selectedTime?.startTime === slot.startTime;

								return (
									<button
										key={idx}
										disabled={isDisabled}
										onClick={() => setSelectedTime(slot)}
										className={cn(
											"relative flex flex-col gap-1 rounded-(--jh-radius-md) border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
											isDisabled
												? "cursor-not-allowed border-border bg-secondary/40 opacity-60"
												: isSelected
													? "border-primary bg-primary/10"
													: "border-border bg-card hover:border-ring",
										)}
									>
										<div className="flex items-center justify-between gap-2">
											<div className="flex items-baseline gap-1.5">
												<span className="text-sm font-bold text-foreground">{formatTime12Hour(slot.startTime)}</span>
												<span className="text-xs text-border">|</span>
												<span className="text-xs font-semibold text-muted-foreground">{slot.duration} min</span>
											</div>
											<span className="text-sm font-bold text-primary">₹{slot.fee !== undefined ? slot.fee : doctor.pricepoint}</span>
										</div>
										<div className="flex items-center justify-between gap-2">
											<span className="truncate text-[10px] text-muted-foreground">
												{slot.consultationType === "Both" ? "Online/In-Person" : slot.consultationType}
											</span>
											{slot.sessionType === "Group" ? (
												<Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">
													Group: {slot.remainingCapacity} left
												</Badge>
											) : null}
										</div>
										{isBooked ? (
											<span className="absolute right-2 top-2 rounded-(--jh-radius-sm) bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-white">
												FULL
											</span>
										) : null}
									</button>
								);
							})
						) : (
							<p className="text-sm text-muted-foreground">No slots available on this date.</p>
						)}
					</div>

					{!loadingSlots && filteredSlots.length > 4 ? (
						<div className="mt-2 text-center">
							<button
								type="button"
								onClick={() => setShowAllSlots(!showAllSlots)}
								className="text-xs font-semibold text-muted-foreground hover:text-primary"
							>
								{showAllSlots ? "Show less ▲" : `Show ${filteredSlots.length - 4} more ▼`}
							</button>
						</div>
					) : null}

					<div className="mt-4 flex flex-col gap-1.5">
						<Label htmlFor="patientIllness">Describe your illness</Label>
						<textarea
							id="patientIllness"
							value={patientIllness}
							onChange={(e) => setPatientIllness(e.target.value)}
							placeholder="Explain in detail about the illness"
							rows={3}
							required
							className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
						/>
					</div>

					<p className="mt-4 text-xs leading-relaxed text-muted-foreground">
						<strong className="font-semibold">Note:</strong> Your appointment is confirmed as soon as booking (and payment, if applicable)
						goes through — no separate doctor approval needed. You'll find it under "Your appointed doctor" on the home page.
					</p>

					<div className="sticky bottom-0 mt-5 border-t border-border bg-card pt-4">
						<Button onClick={handleBookAppointment} className="w-full">
							Book appointment
						</Button>

						{statusMessage.message ? (
							<p className={cn("mt-2 text-sm", statusMessage.type === "error" ? "text-destructive" : "text-primary")}>
								{statusMessage.message}
							</p>
						) : null}
					</div>
				</div>
			</div>

			<Dialog open={zoomImage} onOpenChange={setZoomImage}>
				<DialogContent showClose={false} className="max-w-2xl bg-transparent p-0 shadow-none">
					<img src={currentProfilePic} alt="Enlarged profile" className="max-h-[85vh] w-full rounded-(--jh-radius-lg) object-contain" />
				</DialogContent>
			</Dialog>

			<Dialog open={paymentModalOpen && Boolean(currentBooking)} onOpenChange={(open) => !open && handleCancelPayment()}>
				<DialogContent className="max-w-2xl">
					<DialogTitle>Secure payment</DialogTitle>
					<p className="rounded-(--jh-radius-md) bg-secondary/60 px-3 py-2 text-sm text-muted-foreground">
						Your slot is temporarily locked for you. Complete payment now to confirm.
					</p>

					<div className="grid gap-6 sm:grid-cols-2">
						<div className="flex flex-col gap-4">
							<div className="flex flex-col gap-2 text-sm">
								<div className="flex items-center justify-between">
									<span className="text-muted-foreground">Doctor</span>
									<strong className="font-semibold text-foreground">
										Dr. {doctor.firstName} {doctor.lastName}
									</strong>
								</div>
								<div className="flex items-center justify-between">
									<span className="text-muted-foreground">Consultation fee</span>
									<strong className="font-semibold text-primary">₹{currentBooking?.amountPaid}</strong>
								</div>
							</div>

							<Button type="button" variant="destructive" onClick={() => handleCancelPayment()} disabled={uploadingScreenshot} className="hidden sm:inline-flex">
								Cancel booking & release slot
							</Button>
						</div>

						<div className="flex flex-col gap-4">
							<span className="mx-auto inline-flex items-center gap-1.5 rounded-(--jh-radius-pill) bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
								<Clock size={13} />
								<span className={timeLeft < 60 ? "text-destructive" : undefined}>
									{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
								</span>
								remaining to complete payment
							</span>

							<Button type="button" className="w-full" onClick={handleRazorpayPayment} disabled={payingViaRazorpay}>
								{payingViaRazorpay ? <Loader2 className="size-4 animate-spin" /> : null}
								{payingViaRazorpay ? "Processing..." : "Pay Now"}
							</Button>

							{doctorUpiId ? (
								showManualUpi ? (
									<div className="flex flex-col gap-4">
										<div className="flex flex-col items-center gap-2 sm:hidden">
											<Button
												type="button"
												variant="outline"
												className="w-full"
												onClick={() => {
													const upiUrl = `upi://pay?pa=${doctorUpiId}&pn=Dr.%20${doctor.firstName}%20${doctor.lastName}&am=${currentBooking?.amountPaid}&cu=INR&tn=AyuHub-${currentBooking?._id}`;
													window.open(upiUrl, "_self");
												}}
											>
												Pay using any UPI app
											</Button>
											<span className="text-xs text-muted-foreground">OR</span>
										</div>

										<div className="flex flex-col items-center gap-2 text-center">
											<p className="text-sm font-semibold text-foreground">Scan QR code to pay</p>
											<img
												src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
													`upi://pay?pa=${doctorUpiId}&pn=Dr.%20${doctor.firstName}%20${doctor.lastName}&am=${currentBooking?.amountPaid}&cu=INR&tn=AyuHub-${currentBooking?._id}`,
												)}`}
												alt="UPI payment QR code"
												className="size-40 rounded-(--jh-radius-md) bg-secondary/60 p-2"
											/>
										</div>

										<form onSubmit={handleUploadProof} className="flex flex-col gap-3">
								<div>
									<Label>Upload payment screenshots (max 5)</Label>
									<p className="mt-1 text-xs text-muted-foreground">Upload screenshots of the successful transaction. You can add multiple images.</p>
								</div>

								<div className="flex flex-wrap gap-2">
									{screenshotFiles.map((file, index) => (
										<div key={index} className="relative size-16 overflow-hidden rounded-(--jh-radius-md) bg-secondary/60">
											{file.type.startsWith("image/") ? (
												<img src={URL.createObjectURL(file)} alt={`preview-${index}`} className="size-full object-cover" />
											) : (
												<div className="flex size-full items-center justify-center text-xs font-semibold text-muted-foreground">PDF</div>
											)}
											<button
												type="button"
												onClick={() => setScreenshotFiles((prev) => prev.filter((_, i) => i !== index))}
												aria-label="Remove file"
												className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white"
											>
												<X size={10} />
											</button>
										</div>
									))}
									{screenshotFiles.length < 5 ? (
										<button
											type="button"
											onClick={() => document.getElementById("multi-screenshot-input").click()}
											className="flex size-16 items-center justify-center rounded-(--jh-radius-md) border border-dashed border-border text-muted-foreground hover:border-ring hover:text-foreground"
										>
											<Plus size={20} />
										</button>
									) : null}
								</div>
								<input
									type="file"
									id="multi-screenshot-input"
									multiple
									accept="image/*,application/pdf"
									className="sr-only"
									onChange={(e) => {
										const files = Array.from(e.target.files);
										const availableSpace = 5 - screenshotFiles.length;

										if (files.length > availableSpace) {
											const discardedFiles = files.slice(availableSpace);
											setUploadAlert({
												message: "Maximum 5 files allowed. The following files were discarded:",
												files: discardedFiles.map((f) => f.name),
											});
										}

										setScreenshotFiles([...screenshotFiles, ...files].slice(0, 5));
										e.target.value = null;
									}}
								/>

								<DialogFooter>
									<Button type="button" variant="destructive" onClick={() => handleCancelPayment()} disabled={uploadingScreenshot} className="sm:hidden">
										Cancel booking & release slot
									</Button>
									<Button type="submit" disabled={uploadingScreenshot}>
										{uploadingScreenshot ? <Loader2 className="size-4 animate-spin" /> : null}
										{uploadingScreenshot ? "Uploading..." : "Submit payment proof"}
									</Button>
								</DialogFooter>
										</form>

										<button
											type="button"
											onClick={() => setShowManualUpi(false)}
											className="mx-auto bg-transparent p-0 text-xs font-medium text-muted-foreground underline hover:text-foreground"
										>
											Back to Pay Now
										</button>
									</div>
								) : (
									<button
										type="button"
										onClick={() => setShowManualUpi(true)}
										className="mx-auto bg-transparent p-0 text-xs font-medium text-muted-foreground underline hover:text-foreground"
									>
										Or pay manually via UPI (QR / screenshot)
									</button>
								)
							) : null}
						</div>
					</div>
				</DialogContent>
			</Dialog>

			<Dialog open={Boolean(uploadAlert)} onOpenChange={(open) => !open && setUploadAlert(null)}>
				<DialogContent className="max-w-sm text-center">
					<DialogTitle>Some files were skipped</DialogTitle>
					<p className="text-sm text-muted-foreground">{uploadAlert?.message}</p>
					<div className="flex flex-wrap justify-center gap-1.5">
						{uploadAlert?.files.map((name, i) => (
							<Badge key={i} variant="secondary">
								{name}
							</Badge>
						))}
					</div>
					<Button onClick={() => setUploadAlert(null)}>OK</Button>
				</DialogContent>
			</Dialog>
		</main>
	);
}

export default DoctorDetail;
