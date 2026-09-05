import { useState, useEffect, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronDown, Mail, Phone, Calendar, Clock, Star, Pill } from "lucide-react";

import { AuthContext } from "../../context/AuthContext";
import { authFetch } from "../../utils/authFetch";
import { BACKEND_URL } from "../../config";
import { DashboardShell, DashboardPageHeader } from "@/components/layout/DashboardShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateReadable } from "@/lib/date";
import { MedicalHistoryViewer } from "./doctorPrescribe/MedicalHistoryViewer";

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

function PatientDetail() {
	const { patientId } = useParams();
	const navigate = useNavigate();
	const { auth } = useContext(AuthContext);

	const [patient, setPatient] = useState(null);
	const [visits, setVisits] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [showVisits, setShowVisits] = useState(false);
	const [expandedMedicines, setExpandedMedicines] = useState({});

	const toggleMedicines = (id) => {
		setExpandedMedicines((prev) => ({ ...prev, [id]: !prev[id] }));
	};

	useEffect(() => {
		const fetchAll = async () => {
			try {
				const token = auth?.token || localStorage.getItem("token");
				const [profileRes, historyRes] = await Promise.all([
					authFetch(`${BACKEND_URL}/api/patients/getPatient/${patientId}`, { headers: { Authorization: `Bearer ${token}` } }),
					authFetch(`${BACKEND_URL}/api/bookings/history/patient/${patientId}`, { headers: { Authorization: `Bearer ${token}` } }),
				]);

				if (!profileRes.ok) throw new Error("Failed to load this patient's profile.");
				const profileData = await profileRes.json();
				setPatient(profileData);

				if (historyRes.ok) {
					const historyData = await historyRes.json();
					setVisits(historyData.bookings || []);
				}
			} catch (err) {
				setError(err.message);
			} finally {
				setLoading(false);
			}
		};

		if (patientId) fetchAll();
	}, [patientId, auth?.token]);

	if (loading) {
		return (
			<DashboardShell>
				<p className="text-muted-foreground">Loading...</p>
			</DashboardShell>
		);
	}

	if (error || !patient) {
		return (
			<DashboardShell>
				<p className="text-destructive">{error || "Patient not found."}</p>
			</DashboardShell>
		);
	}

	return (
		<DashboardShell>
			<Button
				onClick={() => navigate("/patient-list")}
				className="mb-4 bg-[var(--jh-olive-light)] text-[var(--jh-cream)] hover:bg-[var(--jh-olive-leaf)] transition-colors flex items-center gap-2"
			>
				<ChevronLeft className="size-4" /> Back to Patient List
			</Button>

			<DashboardPageHeader
				title={`${patient.firstName} ${patient.lastName}`}
				description="Patient profile, medical history, and consultation record."
			/>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<Card className="p-6 lg:col-span-1">
					<h3 className="mb-3 border-b border-border pb-2 text-base font-semibold text-foreground">Profile</h3>
					<div className="flex flex-col gap-2.5 text-sm text-foreground/80">
						<span className="flex items-center gap-2">
							<Mail className="size-4 text-muted-foreground" /> {patient.email}
						</span>
						{patient.phone ? (
							<span className="flex items-center gap-2">
								<Phone className="size-4 text-muted-foreground" /> {patient.phone}
							</span>
						) : null}
						<span>
							{patient.age != null ? `${patient.age} yrs` : "Age N/A"} &bull; {patient.gender || "N/A"}
						</span>
					</div>
				</Card>

				<div className="lg:col-span-2">
					<MedicalHistoryViewer patientId={patientId} />
				</div>
			</div>

			<Card className="mt-6 overflow-hidden p-0">
				<button
					type="button"
					onClick={() => setShowVisits((prev) => !prev)}
					className="flex w-full items-center justify-between gap-2 bg-transparent p-5 text-left"
				>
					<h3 className="text-base font-semibold text-foreground">
						Previous Appointments with You ({visits.length})
					</h3>
					<ChevronDown className={`size-4 text-muted-foreground transition-transform ${showVisits ? "rotate-180" : ""}`} />
				</button>

				{showVisits ? (
					<div className="flex flex-col gap-4 border-t border-border p-5">
						{visits.length === 0 ? (
							<p className="text-sm text-muted-foreground">No accepted appointments with this patient yet.</p>
						) : (
							visits.map((visit) => (
								<div key={visit._id} className="rounded-lg border border-border p-4">
									<div className="flex flex-wrap items-center justify-between gap-3">
										<div className="flex flex-col gap-1 text-sm text-foreground/80">
											<span className="flex items-center gap-1.5">
												<Calendar className="size-4 text-muted-foreground" />
												{formatDateReadable(visit.dateOfAppointment)}
											</span>
											{visit.timeSlot ? (
												<span className="flex items-center gap-1.5">
													<Clock className="size-4 text-muted-foreground" /> {format12HourTime(visit.timeSlot)}
												</span>
											) : null}
										</div>
										<Badge variant={visit.amountPaid === 0 ? "secondary" : "default"}>
											{visit.amountPaid === 0 ? "Free" : `₹${visit.amountPaid}`}
										</Badge>
									</div>

									{/* 1. Reason for Visit */}
									<p className="mt-3 text-xs text-muted-foreground">
										<strong className="text-foreground">Reason for Visit:</strong>{" "}
										{visit.patientIllness || <span className="italic text-muted-foreground/75">Not specified</span>}
									</p>

									{/* 2. Diagnosis */}
									<p className="mt-1.5 text-xs text-muted-foreground">
										<strong className="text-foreground">Diagnosis:</strong>{" "}
										{visit.diagnosis ? visit.diagnosis : <span className="italic text-muted-foreground/75">Not given</span>}
									</p>

									{/* 3. Medicines Prescribed (below Reason for Visit & Diagnosis) */}
									{visit.recommendedSupplements?.length > 0 ? (
										<div className="mt-2.5">
											<button
												type="button"
												onClick={() => toggleMedicines(visit._id)}
												className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition-colors cursor-pointer bg-transparent border-0 p-0"
											>
												<Pill className="size-3.5 text-muted-foreground" />
												<span>
													{visit.recommendedSupplements.length} medicine
													{visit.recommendedSupplements.length > 1 ? "s" : ""} prescribed
												</span>
												<ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${expandedMedicines[visit._id] ? "rotate-180" : ""}`} />
											</button>

											{expandedMedicines[visit._id] ? (
												<div className="mt-2.5 pl-4 flex flex-col gap-2.5 text-xs text-muted-foreground border-l-2 border-border ml-1.5">
													{visit.recommendedSupplements.map((med, idx) => (
														<div key={med._id || idx} className="flex flex-col gap-1 rounded-md bg-secondary/30 p-2.5 border border-border/60">
															<div>
																<strong className="text-foreground">Medicine Name:</strong>{" "}
																<span className="font-semibold text-foreground">{med.medicineName}</span>
															</div>
															{med.dosage ? (
																<div>
																	<strong className="text-foreground">Dosage:</strong>{" "}
																	<span>{med.dosage}</span>
																</div>
															) : null}
															{med.instructions ? (
																<div>
																	<strong className="text-foreground">Instructions:</strong>{" "}
																	<span className="italic">{med.instructions}</span>
																</div>
															) : null}
														</div>
													))}
												</div>
											) : null}
										</div>
									) : (
										<p className="mt-1.5 text-xs text-muted-foreground">
											<strong className="text-foreground">Medicines:</strong>{" "}
											<span className="italic text-muted-foreground/75">None prescribed</span>
										</p>
									)}

									<Button size="sm" variant="outline" className="mt-3.5" onClick={() => navigate(`/doctorsprescribe/${visit._id}`)}>
										View / Edit Prescription
									</Button>
								</div>
							))
						)}
					</div>
				) : null}
			</Card>
		</DashboardShell>
	);
}

export default PatientDetail;
