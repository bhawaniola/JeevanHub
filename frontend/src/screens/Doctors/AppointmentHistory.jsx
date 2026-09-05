import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Calendar, ChevronLeft, ChevronRight, ChevronDown, Star, CheckCircle2, Hourglass, Pill, Search, X } from "lucide-react";

import { AuthContext } from "../../context/AuthContext";
import { authFetch } from "../../utils/authFetch";
import { BACKEND_URL } from "../../config";
import { DashboardShell, DashboardPageHeader } from "@/components/layout/DashboardShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateReadable } from "@/lib/date";

const parseAppointmentDateTime = (dateString, timeSlot) => {
	const appointmentDate = new Date(dateString);
	if (!timeSlot || typeof timeSlot !== "string") return appointmentDate;
	const startTimePart = timeSlot.split(" - ")[0].trim();
	let [hours, minutes] = startTimePart.split(/[:\s]/).map(Number);
	const period = startTimePart.includes("PM") ? "PM" : "AM";

	if (period === "PM" && hours !== 12) {
		hours += 12;
	} else if (period === "AM" && hours === 12) {
		hours = 0;
	}

	appointmentDate.setHours(hours || 0, minutes || 0, 0, 0);
	return appointmentDate;
};

const format12HourTime = (timeStr) => {
	if (!timeStr) return "";
	if (timeStr.toLowerCase().includes("am") || timeStr.toLowerCase().includes("pm")) return timeStr;
	let [hours, minutes] = timeStr.split(":");
	hours = parseInt(hours, 10);
	const ampm = hours >= 12 ? "PM" : "AM";
	hours = hours % 12;
	hours = hours ? hours : 12;
	hours = hours < 10 ? "0" + hours : hours;
	return `${hours}:${minutes} ${ampm}`;
};

const timeElapsed = (dateStr) => {
	if (!dateStr) return "Recently";
	const diff = Date.now() - new Date(dateStr).getTime();
	const minutes = Math.floor(diff / 60000);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
};

const TIME_FILTER_OPTIONS = [
	{ value: "all", label: "All Appointments" },
	{ value: "today", label: "Today" },
	{ value: "week", label: "Last 7 Days" },
	{ value: "month", label: "Last 30 Days" },
];

function AppointmentHistory() {
	const [activeTab, setActiveTab] = useState("Previous");
	const navigate = useNavigate();
	const [previousAppointments, setPreviousAppointments] = useState([]);
	const [deniedAppointments, setDeniedAppointments] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	const [galleryImages, setGalleryImages] = useState([]);
	const [currentImageIndex, setCurrentImageIndex] = useState(0);
	const [selectedIllness, setSelectedIllness] = useState(null);
	const [expandedPatients, setExpandedPatients] = useState({});

	const [searchTerm, setSearchTerm] = useState("");
	const [timeFilter, setTimeFilter] = useState("all");
	const [customDate, setCustomDate] = useState("");
	const [visibleProofs, setVisibleProofs] = useState({});

	const toggleProofVisibility = (bookingId) => {
		setVisibleProofs((prev) => ({ ...prev, [bookingId]: !prev[bookingId] }));
	};

	const toggleExpanded = (patientKey) => {
		setExpandedPatients((prev) => ({ ...prev, [patientKey]: !prev[patientKey] }));
	};

	const { auth } = useContext(AuthContext);
	const doctorId = auth.user?.id;

	useEffect(() => {
		const fetchAppointments = async () => {
			try {
				if (!doctorId) {
					setLoading(false);
					setError("Error: Doctor ID not found.");
					return;
				}

				const response = await authFetch(`${BACKEND_URL}/api/bookings/doctor/${doctorId}`);

				if (!response.ok) {
					if (response.status === 404) {
						setPreviousAppointments([]);
						setDeniedAppointments([]);
						setLoading(false);
						return;
					}
					throw new Error("Failed to fetch appointments");
				}

				const data = await response.json();
				const currentTime = new Date();
				const rawBookings = Array.isArray(data.bookings) ? data.bookings : [];

				const previous = [];
				const denied = [];

				rawBookings.forEach((appointment) => {
					if (appointment.requestAccept === "denied") {
						denied.push(appointment);
						return;
					}

					if (appointment.requestAccept === "accepted") {
						const appointmentDateTime = parseAppointmentDateTime(appointment.dateOfAppointment, appointment.timeSlot);

						const endTime = new Date(appointmentDateTime);
						endTime.setMinutes(endTime.getMinutes() + 30);

						if (currentTime > endTime) {
							previous.push(appointment);
						}
					}
				});

				previous.sort((a, b) => new Date(b.dateOfAppointment) - new Date(a.dateOfAppointment));
				denied.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

				setPreviousAppointments(previous);
				setDeniedAppointments(denied);
				setLoading(false);
			} catch (error) {
				setError(error.message);
				setLoading(false);
			}
		};

		fetchAppointments();
	}, [doctorId]);

	// Filter appointments based on active search and date filters
	const filterAppointments = (appointments, isDenied = false) => {
		return appointments.filter((appt) => {
			// Name filter
			const patientName = appt.patientName || "";
			const matchesName = patientName.toLowerCase().includes(searchTerm.toLowerCase());
			if (!matchesName) return false;

			// Date filter
			const dateStr = isDenied ? appt.createdAt : appt.dateOfAppointment;
			if (!dateStr) return true;
			
			// Normalize date objects to ignore time comparisons for exact matching
			const apptDate = new Date(dateStr);

			if (customDate) {
				const targetDate = new Date(customDate);
				return apptDate.toDateString() === targetDate.toDateString();
			}

			if (timeFilter === "today") {
				return apptDate.toDateString() === new Date().toDateString();
			}

			if (timeFilter === "week") {
				const oneWeekAgo = new Date();
				oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
				oneWeekAgo.setHours(0, 0, 0, 0);
				return apptDate >= oneWeekAgo;
			}

			if (timeFilter === "month") {
				const oneMonthAgo = new Date();
				oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
				oneMonthAgo.setHours(0, 0, 0, 0);
				return apptDate >= oneMonthAgo;
			}

			return true;
		});
	};

	const filteredPrevious = filterAppointments(previousAppointments, false);
	const filteredDenied = filterAppointments(deniedAppointments, true);

	// Group each patient's completed appointments into one row -- a returning
	// patient previously showed up once per visit; here their whole history
	// (all prescriptions across visits) rolls up under a single card.
	const patients = [];
	const patientsByKey = new Map();
	filteredPrevious.forEach((appointment) => {
		const key = appointment.patientId?._id || appointment.patientId || appointment.patientEmail;
		if (!patientsByKey.has(key)) {
			const entry = { key, latest: appointment, visits: [] };
			patientsByKey.set(key, entry);
			patients.push(entry);
		}
		patientsByKey.get(key).visits.push(appointment);
	});
	// Each patient's visits arrive already sorted newest-first (previousAppointments
	// is sorted that way), and `latest` is simply the first visit seen per patient.
	patients.forEach((entry) => {
		entry.prescriptions = entry.visits.flatMap((visit) =>
			(visit.recommendedSupplements || []).map((supplement) => ({
				...supplement,
				visitDate: visit.dateOfAppointment,
			}))
		);
	});

	if (loading) {
		return (
			<DashboardShell>
				<p className="text-muted-foreground">Loading...</p>
			</DashboardShell>
		);
	}

	if (error) {
		return (
			<DashboardShell>
				<p className="text-destructive">Error: {error}</p>
			</DashboardShell>
		);
	}

	return (
		<DashboardShell>
			<DashboardPageHeader title="Appointment History" description="Past consultations and denied requests." />

			{/* Filters Panel */}
			<Card className="mb-6 p-4 flex flex-col md:flex-row items-center gap-4 bg-card">
				<div className="relative w-full md:w-72">
					<Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
					<Input
						placeholder="Search patient by name..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="pl-9 pr-8"
					/>
					{searchTerm && (
						<button
							onClick={() => setSearchTerm("")}
							className="absolute right-2.5 top-3 text-muted-foreground hover:text-foreground"
						>
							<X className="size-4" />
						</button>
					)}
				</div>

				<div className="flex w-full md:w-auto items-center gap-2">
					<Select
						value={timeFilter}
						onValueChange={(val) => {
							setTimeFilter(val);
							setCustomDate(""); // Clear custom date when quick range changes
						}}
						items={TIME_FILTER_OPTIONS}
					>
						<SelectTrigger className="w-full md:w-48">
							<SelectValue placeholder="All Appointments" />
						</SelectTrigger>
						<SelectContent>
							{TIME_FILTER_OPTIONS.map((opt) => (
								<SelectItem key={opt.value} value={opt.value}>
									{opt.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="flex w-full md:w-auto items-center gap-2">
					<span className="text-sm font-medium text-muted-foreground hidden md:inline">Or:</span>
					<div className="relative flex items-center w-full md:w-auto">
						<Input
							type="date"
							value={customDate}
							onChange={(e) => {
								setCustomDate(e.target.value);
								if (e.target.value) {
									setTimeFilter("all"); // Reset quick filter when custom date is chosen
								}
							}}
							onMouseDown={(e) => {
								e.preventDefault(); // Prevents the blue text highlight of dd/mm/yyyy segments
								try {
									e.target.showPicker();
								} catch (err) {
									// Ignore errors in browsers that don't support showPicker
								}
							}}
							className="w-full md:w-auto pr-8 cursor-pointer"
						/>
						{customDate && (
							<button
								onClick={() => setCustomDate("")}
								className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
							>
								<X className="size-4" />
							</button>
						)}
					</div>
				</div>
			</Card>

			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList className="mb-6">
					<TabsTrigger value="Previous" className="cursor-pointer">Previous Appointments</TabsTrigger>
					<TabsTrigger value="Denied" className="cursor-pointer">Denied / Cancelled</TabsTrigger>
				</TabsList>

				<TabsContent value="Previous">
					{patients.length === 0 ? (
						<p className="text-center text-muted-foreground">No previous patients found.</p>
					) : (
						<div className="flex flex-col gap-5">
							{patients.map(({ key, latest, visits, prescriptions }) => {
								const hasScreenshots = latest.paymentScreenshots && latest.paymentScreenshots.length > 0;
								const isPendingPayment = latest.amountPaid > 0 && latest.paymentStatus === "Pending";
								const isExpanded = !!expandedPatients[key];

								return (
									<Card key={key} className="p-6">
										<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
											<div>
												<div className="flex flex-wrap items-center gap-2">
													<h3 className="text-lg font-semibold text-foreground">{latest.patientName}</h3>
													<Badge variant="secondary" title="Total appointments with you">
														{visits.length} visit{visits.length > 1 ? "s" : ""}
													</Badge>
												</div>
												<p
													className="mt-1 text-sm text-muted-foreground"
													title={`Age: ${latest.patientAge} yrs | Gender: ${latest.patientGender} | Email: ${latest.patientEmail}`}
												>
													{latest.patientAge || "N/A"} yrs &bull; {latest.patientGender || "N/A"} &bull;{" "}
													{latest.patientEmail || "N/A"}
												</p>
												<div className="mt-3 text-sm text-foreground/80">
													<strong className="text-foreground">Latest reason for visit:</strong>{" "}
													{latest.patientIllness && latest.patientIllness.length > 80 ? (
														<>
															{latest.patientIllness.substring(0, 80)}...
															<button
																className="ml-1 text-primary underline hover:no-underline"
																onClick={() => setSelectedIllness(latest.patientIllness)}
															>
																More
															</button>
														</>
													) : (
														latest.patientIllness || "No illness information"
													)}
												</div>
												{latest.rating ? (
													<div
														className="mt-3 flex items-center gap-1 text-xs text-muted-foreground"
														title="Patient's feedback for the latest consultation"
													>
														<Star className="size-3.5 fill-primary text-primary" /> {latest.rating}/5
														{latest.review ? ` — "${latest.review}"` : ""}
													</div>
												) : (
													<div className="mt-3 text-xs text-muted-foreground">No review submitted yet</div>
												)}
											</div>

											<div>
												<div className="flex flex-wrap items-center justify-between gap-3">
													<div className="flex flex-col gap-1 text-sm text-foreground/80">
														<span className="flex items-center gap-1.5" title="Most Recent Appointment">
															<Calendar className="size-4 text-muted-foreground" />
															{new Date(latest.dateOfAppointment).toLocaleDateString("en-GB", {
																weekday: "short",
																day: "numeric",
																month: "short",
																year: "numeric",
															})}
														</span>
														<span className="flex items-center gap-1.5" title="Time of Appointment">
															<Clock className="size-4 text-muted-foreground" />
															{format12HourTime(latest.timeSlot)}
														</span>
													</div>
													<Badge variant={latest.amountPaid === 0 ? "secondary" : "default"} title="Latest Consultation Fee">
														{latest.amountPaid === 0 ? "Free" : `₹${latest.amountPaid}`}
													</Badge>
												</div>

												{latest.paymentStatus === "Completed" ? (
													<p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-primary">
														<CheckCircle2 className="size-4" /> Payment Verified
													</p>
												) : null}

												{hasScreenshots ? (
													<div className="mt-3">
														<button
															type="button"
															onClick={() => toggleProofVisibility(latest._id)}
															className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0 outline-none"
														>
															{visibleProofs[latest._id] ? "Hide Payment Proof" : "View Payment Proof"} ({latest.paymentScreenshots.length})
														</button>
														{visibleProofs[latest._id] && (
															<div className="mt-2 flex flex-wrap gap-2">
																{latest.paymentScreenshots.map((proof, index) => {
																	const imgUrl = proof.startsWith("http")
																		? proof
																		: `${BACKEND_URL || "http://localhost:8080"}/${proof}`;
																	return (
																		<img
																			key={index}
																			src={imgUrl}
																			alt={`Payment Proof ${index + 1}`}
																			className="size-16 cursor-pointer rounded-md border border-border object-cover"
																			onClick={() => {
																				setGalleryImages(latest.paymentScreenshots);
																				setCurrentImageIndex(index);
																			}}
																		/>
																	);
																})}
															</div>
														)}
													</div>
												) : null}

												{isPendingPayment && !hasScreenshots ? (
													<p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
														<Hourglass className="size-3.5" /> Awaiting payment proof
													</p>
												) : null}

												{prescriptions.length > 0 ? (
													<button
														type="button"
														onClick={() => toggleExpanded(key)}
														className="mt-3 flex w-full items-center gap-1.5 border-t border-dashed border-border bg-transparent pt-3 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
													>
														<Pill className="size-3.5" /> {prescriptions.length} medicine{prescriptions.length > 1 ? "s" : ""} prescribed across {visits.length} visit{visits.length > 1 ? "s" : ""}
														<ChevronDown className={`ml-auto size-3.5 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
													</button>
												) : (
													<div className="mt-3 flex w-full items-center gap-1.5 border-t border-dashed border-border pt-3 text-left text-xs font-medium text-muted-foreground/60 select-none">
														<Pill className="size-3.5" /> No medicine prescribed yet
													</div>
												)}

												{isExpanded ? (
													<div className="mt-2.5 flex flex-col gap-2 rounded-(--jh-radius-md) bg-secondary/50 p-3 text-xs text-foreground/80 border border-border/60">
														{prescriptions.map((supplement, idx) => (
															<div key={idx} className="flex flex-col gap-1 rounded bg-card/80 p-2.5 border border-border/50">
																<div className="flex flex-wrap items-center justify-between gap-2">
																	<div>
																		<strong className="text-foreground">Medicine Name:</strong>{" "}
																		<span className="font-semibold text-foreground">{supplement.medicineName}</span>
																	</div>
																	{supplement.visitDate ? (
																		<div className="text-muted-foreground font-medium">
																			<strong className="text-foreground/80">Prescribed Date:</strong> {formatDateReadable(supplement.visitDate)}
																		</div>
																	) : null}
																</div>
																{supplement.dosage ? (
																	<div>
																		<strong className="text-foreground">Dosage:</strong>{" "}
																		<span>{supplement.dosage}</span>
																	</div>
																) : null}
																{supplement.instructions ? (
																	<div>
																		<strong className="text-foreground">Instructions:</strong>{" "}
																		<span className="italic">{supplement.instructions}</span>
																	</div>
																) : null}
															</div>
														))}
													</div>
												) : null}
											</div>

											<div>
												<Button onClick={() => navigate(`/doctorsprescribe/${latest._id}`)}>
													Prescribe Medicine & Diet - Yoga Plan
												</Button>
											</div>
										</div>
									</Card>
								);
							})}
						</div>
					)}
				</TabsContent>

				<TabsContent value="Denied">
					{filteredDenied.length === 0 ? (
						<p className="text-center text-muted-foreground">No denied requests found.</p>
					) : (
						<div className="flex flex-col gap-5">
							{filteredDenied.map((appointment) => (
								<Card key={appointment._id} className="p-6">
									<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
										<div>
											<div className="flex flex-wrap items-center gap-2">
												<h3 className="text-lg font-semibold text-foreground">{appointment.patientName}</h3>
												<Badge variant="destructive" title="This request was denied">
													Denied
												</Badge>
												{appointment.isReturningPatient ? (
													<Badge variant="secondary" title="Has previously booked appointments with you">
														Returning
													</Badge>
												) : (
													<Badge title="First-time booking with you">New</Badge>
												)}
											</div>
											<p
												className="mt-1 text-sm text-muted-foreground"
												title={`Age: ${appointment.patientAge} yrs | Gender: ${appointment.patientGender} | Email: ${appointment.patientEmail}`}
											>
												{appointment.patientAge || "N/A"} yrs &bull; {appointment.patientGender || "N/A"} &bull;{" "}
												{appointment.patientEmail || "N/A"}
											</p>
											<div className="mt-3 text-sm text-foreground/80">
												<strong className="text-foreground">Illness:</strong>{" "}
												{appointment.patientIllness && appointment.patientIllness.length > 80 ? (
													<>
														{appointment.patientIllness.substring(0, 80)}...
														<button
															className="ml-1 text-primary underline hover:no-underline"
															onClick={() => setSelectedIllness(appointment.patientIllness)}
														>
															More
														</button>
													</>
												) : (
													appointment.patientIllness || "No illness information"
												)}
											</div>
											<div
												className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"
												title="Time since the appointment was requested"
											>
												<Clock className="size-3.5" /> Requested {timeElapsed(appointment.createdAt)}
											</div>
										</div>

										<div>
											<div className="flex flex-wrap items-center justify-between gap-3">
												<div className="flex flex-col gap-1 text-sm text-foreground/80">
													<span className="flex items-center gap-1.5" title="Requested Date">
														<Calendar className="size-4 text-muted-foreground" />
														{new Date(appointment.dateOfAppointment).toLocaleDateString("en-GB", {
															weekday: "short",
															day: "numeric",
															month: "short",
															year: "numeric",
														})}
													</span>
													<span className="flex items-center gap-1.5" title="Requested Time">
														<Clock className="size-4 text-muted-foreground" />
														{format12HourTime(appointment.timeSlot)}
													</span>
												</div>
												<Badge variant={appointment.amountPaid === 0 ? "secondary" : "default"} title="Consultation Fee">
													{appointment.amountPaid === 0 ? "Free" : `₹${appointment.amountPaid}`}
												</Badge>
											</div>
											<div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
												<strong className="block">Reason for Denial</strong>
												{appointment.doctorsMessage || "No reason was provided."}
											</div>
										</div>
									</div>
								</Card>
							))}
						</div>
					)}
				</TabsContent>
			</Tabs>

			{/* Payment Proof Image Gallery Modal */}
			<Dialog open={galleryImages.length > 0} onOpenChange={(open) => !open && setGalleryImages([])}>
				<DialogContent className="max-w-2xl">
					<div className="relative flex items-center justify-center">
						{galleryImages.length > 1 ? (
							<button
								className="absolute left-0 z-10 rounded-full bg-muted p-2 text-foreground"
								onClick={() => setCurrentImageIndex((prev) => (prev === 0 ? galleryImages.length - 1 : prev - 1))}
							>
								<ChevronLeft className="size-5" />
							</button>
						) : null}

						<img
							src={
								galleryImages[currentImageIndex]?.startsWith("http")
									? galleryImages[currentImageIndex]
									: `${BACKEND_URL || "http://localhost:8080"}/${galleryImages[currentImageIndex]}`
							}
							alt="Enlarged Proof"
							className="max-h-[70vh] w-full rounded-lg object-contain"
						/>

						{galleryImages.length > 1 ? (
							<button
								className="absolute right-0 z-10 rounded-full bg-muted p-2 text-foreground"
								onClick={() => setCurrentImageIndex((prev) => (prev === galleryImages.length - 1 ? 0 : prev + 1))}
							>
								<ChevronRight className="size-5" />
							</button>
						) : null}
					</div>

					{galleryImages.length > 1 ? (
						<div className="flex justify-center gap-2">
							{galleryImages.map((_, idx) => (
								<span
									key={idx}
									onClick={() => setCurrentImageIndex(idx)}
									className={
										idx === currentImageIndex
											? "size-2 cursor-pointer rounded-full bg-primary"
											: "size-2 cursor-pointer rounded-full bg-muted-foreground/30"
									}
								/>
							))}
						</div>
					) : null}
				</DialogContent>
			</Dialog>

			{/* Illness Modal */}
			<Dialog open={!!selectedIllness} onOpenChange={(open) => !open && setSelectedIllness(null)}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle>Patient's Illness Details</DialogTitle>
					</DialogHeader>
					<p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">{selectedIllness}</p>
				</DialogContent>
			</Dialog>
		</DashboardShell>
	);
}

export default AppointmentHistory;
