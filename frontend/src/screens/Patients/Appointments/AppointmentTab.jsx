import { useState } from "react";
import {
	AlertCircle,
	Calendar,
	ChevronDown,
	Clock,
	Link as LinkIcon,
	Mail,
	MessageSquareText,
	Pencil,
	Pill,
	RotateCcw,
	ShoppingBag,
	Star,
	Stethoscope,
	UploadCloud,
	Video,
	XCircle,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import ShareRecordModal from "./ShareRecordModal";
import { authFetch } from "../../../utils/authFetch";
import { BACKEND_URL } from "../../../config";

const BACKEND = BACKEND_URL;

// A booking is still open for sharing records: any time up to the appointment,
// or within 24h after it (matches the backend's isWithinSharingWindow check).
const isWithinSharingWindow = (dateOfAppointment) => {
	const now = new Date();
	const appointmentTime = new Date(dateOfAppointment);
	if (appointmentTime >= now) return true;
	const hoursSinceAppointment = (now - appointmentTime) / (1000 * 60 * 60);
	return hoursSinceAppointment <= 24;
};

const formatDate = (d) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const STATUS_VARIANTS = {
	Upcoming: "default",
	Pending: "warning",
	Denied: "destructive",
	Completed: "success",
	"Cancelled by Doctor": "destructive",
	Rescheduled: "warning",
};

// Collapsed by default (keeps cards short) — expands to show dosage/instructions
// per medicine, plus the visit's diagnosis if one was recorded.
const PrescriptionSummary = ({ diagnosis, supplements }) => {
	const [open, setOpen] = useState(false);
	const count = supplements?.length || 0;
	const hasDiagnosis = Boolean(diagnosis && diagnosis.trim());
	const hasSupplements = count > 0;

	let headerTitle = "Diagnosis & Prescription";
	if (hasDiagnosis && hasSupplements) {
		headerTitle = `Diagnosis recorded · ${count} medicine${count > 1 ? "s" : ""} prescribed`;
	} else if (hasDiagnosis) {
		headerTitle = `Diagnosis recorded · Medicines not provided`;
	} else if (hasSupplements) {
		headerTitle = `Diagnosis not provided · ${count} medicine${count > 1 ? "s" : ""} prescribed`;
	} else {
		headerTitle = "Diagnosis not provided · Medicines not provided";
	}

	return (
		<div className="mt-3 rounded-(--jh-radius-md) bg-secondary/60">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				aria-expanded={open}
				className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-semibold text-foreground/80 hover:text-foreground"
			>
				<Stethoscope size={14} className={hasDiagnosis || hasSupplements ? "text-primary" : "text-muted-foreground"} />
				<span>{headerTitle}</span>
				<ChevronDown size={14} className={cn("ml-auto text-muted-foreground transition-transform", open && "rotate-180")} />
			</button>
			{open ? (
				<div className="flex flex-col gap-2 border-t border-border px-3 pb-3 pt-2 text-sm">
					{hasDiagnosis ? (
						<p className="flex items-start gap-1.5 text-foreground">
							<Stethoscope size={13} className="mt-0.5 shrink-0 text-primary" />
							<span><strong>Diagnosis:</strong> {diagnosis}</span>
						</p>
					) : (
						<p className="flex items-start gap-1.5 text-xs text-muted-foreground">
							<Stethoscope size={13} className="mt-0.5 shrink-0" />
							<span><strong>Diagnosis:</strong> Not provided</span>
						</p>
					)}

					{hasSupplements ? (
						<div className="flex flex-col gap-1.5">
							{supplements.map((s, i) => (
								<div key={s._id || i} className="flex flex-col gap-0.5 rounded-md bg-card px-2.5 py-2">
									<div className="flex items-center justify-between gap-2">
										<span className="font-semibold text-foreground">
											<span className="font-medium text-muted-foreground">Medicine: </span>
											{s.medicineName || "Not provided"}
										</span>
										{s.medicineId ? (
											<Link
												to={`/medicines/${s.medicineId}`}
												className="shrink-0 text-xs font-semibold text-primary hover:underline"
											>
												View in store
											</Link>
										) : null}
									</div>
									<span className="text-xs text-muted-foreground">
										<strong>Dosage:</strong> {s.dosage || "Not provided"}
									</span>
									<span className="text-xs text-muted-foreground">
										<strong>Instructions:</strong> {s.instructions || "Not provided"}
									</span>
								</div>
							))}
						</div>
					) : (
						<p className="flex items-start gap-1.5 text-xs text-muted-foreground">
							<Pill size={13} className="mt-0.5 shrink-0" />
							<span><strong>Medicines:</strong> Not provided</span>
						</p>
					)}
				</div>
			) : null}
		</div>
	);
};

// The reason-for-visit is often a full paragraph — it gets its own section
// (same visual treatment as the doctor's-message note) instead of being
// squeezed into the meta strip. Only editable on upcoming appointments.
const IllnessSection = ({ appointmentId, illness, editable, onSaved }) => {
	const [editing, setEditing] = useState(false);
	const [value, setValue] = useState(illness || "");
	const [saving, setSaving] = useState(false);

	if (!illness && !editable) return null;

	if (editing) {
		const handleSave = async () => {
			const trimmed = value.trim();
			if (!trimmed) {
				alert("Description cannot be empty.");
				return;
			}
			setSaving(true);
			try {
				const response = await authFetch(`${BACKEND}/api/bookings/${appointmentId}/illness`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ patientIllness: trimmed }),
				});
				if (!response.ok) {
					const err = await response.json().catch(() => ({}));
					throw new Error(err.error || "Failed to update");
				}
				onSaved(appointmentId, trimmed);
				setEditing(false);
			} catch (err) {
				alert(err.message);
			} finally {
				setSaving(false);
			}
		};

		return (
			<div className="mt-3 flex flex-col gap-1.5 rounded-(--jh-radius-md) bg-secondary/60 p-3">
				<span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
					<Stethoscope size={13} /> Reason for visit
				</span>
				<textarea
					value={value}
					onChange={(e) => setValue(e.target.value)}
					rows={3}
					placeholder="Describe your symptoms or reason for this visit..."
					className="w-full rounded-md border border-input bg-card px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
				/>
				<div className="flex gap-2">
					<Button size="sm" onClick={handleSave} disabled={saving}>
						{saving ? "Saving..." : "Save"}
					</Button>
					<Button
						size="sm"
						variant="ghost"
						onClick={() => {
							setValue(illness || "");
							setEditing(false);
						}}
						disabled={saving}
					>
						Cancel
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="mt-3 rounded-(--jh-radius-md) bg-secondary/60 p-3">
			<span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
				<Stethoscope size={13} /> Reason for visit
				{editable ? (
					<button
						type="button"
						onClick={() => {
							setValue(illness || "");
							setEditing(true);
						}}
						aria-label="Edit reason for visit"
						className="ml-auto rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
					>
						<Pencil size={12} />
					</button>
				) : null}
			</span>
			<p className="mt-1 text-sm text-foreground">{illness || "Not provided"}</p>
		</div>
	);
};

const AppointmentTab = ({
	activeTab,
	upcomingAppointments,
	pendingDoctors,
	deniedDoctors,
	previousAppointments,
	supplements,
	onRatingClick,
	onIllnessUpdated,
	onRequestCancelled,
}) => {
	const navigate = useNavigate();
	// { bookingId, mode: 'upload' | 'reference' } — which action opened the modal
	// decides which of ShareRecordModal's two modes it should start on.
	const [shareModal, setShareModal] = useState(null);
	const [cancellingId, setCancellingId] = useState(null);
	const [rebookingId, setRebookingId] = useState(null);
	const [reportingId, setReportingId] = useState(null);

	// Fairness/escrow: the doctor's payout for a paid appointment is held for a
	// window after the slot — this is the patient's chance to flag a problem
	// (e.g. the doctor never joined) before it auto-releases.
	const handleReportIssue = async (appointment) => {
		const reason = window.prompt("What went wrong with this appointment? (e.g. the doctor never joined the call)");
		if (!reason || !reason.trim()) return;
		setReportingId(appointment._id);
		try {
			const response = await authFetch(`${BACKEND}/api/bookings/${appointment._id}/dispute`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ reason }),
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || "Failed to report this issue");
			alert("Thanks — we've flagged this and will review it before any payout goes out.");
		} catch (err) {
			alert(err.message || "Could not report this issue. Please try again.");
		} finally {
			setReportingId(null);
		}
	};

	const handleCancelRequest = async (appointment) => {
		if (!window.confirm(`Cancel your pending request with Dr. ${appointment.doctorName}?`)) return;
		setCancellingId(appointment._id);
		try {
			const response = await authFetch(`${BACKEND}/api/bookings/delete/${appointment._id}`, {
				method: "DELETE",
			});
			if (!response.ok) throw new Error("Failed to cancel request");
			onRequestCancelled(appointment._id);
		} catch {
			alert("Could not cancel this request. Please try again.");
		} finally {
			setCancellingId(null);
		}
	};

	const handleRebook = async (appointment) => {
		setRebookingId(appointment._id);
		try {
			// doctorId may be a populated object (from getBookingsByPatientId's
			// .populate('doctorId')) or a plain string ID depending on the
			// endpoint the booking came from — handle both.
			const targetDoctorId = appointment.doctorId?._id || appointment.doctorId;
			const response = await authFetch(`${BACKEND}/api/doctors/publicDoctors`);
			if (!response.ok) throw new Error("Failed to load doctor");
			const doctors = await response.json();
			const rawDoctor = (doctors.doctors || doctors).find((d) => d._id === targetDoctorId);
			if (!rawDoctor) throw new Error("This doctor is no longer available.");
			// DoctorDetailPage.js expects the same shape DoctorsScreen.js builds when a
			// patient clicks a doctor card normally (a combined `name`, not raw
			// firstName/lastName) — publicDoctors returns the raw shape, so map it here too.
			const doctor = { ...rawDoctor, name: `${rawDoctor.firstName} ${rawDoctor.lastName}` };
			navigate("/doctor-detail", { state: { doctor } });
		} catch (err) {
			alert(err.message || "Could not start a new booking with this doctor.");
		} finally {
			setRebookingId(null);
		}
	};

	const [joiningId, setJoiningId] = useState(null);
	const handleJoinDaily = async (bookingId) => {
		setJoiningId(bookingId);
		try {
			const response = await authFetch(`${BACKEND}/api/bookings/${bookingId}/daily-join`);
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || "Failed to join meeting");
			window.open(data.url, "_blank");
		} catch (err) {
			alert(err.message || "Could not join the meeting. Please try again.");
		} finally {
			setJoiningId(null);
		}
	};

	// Shared card shell used by all four tabs — variant controls which
	// meta/action pieces are relevant for that appointment's state.
	const AppointmentCard = ({ appointment, variant }) => {
		const isRescheduled = appointment.isRescheduledByDoctor;
		const isCancelledByDoctor = appointment.isCancelledByDoctor;

		let badgeLabel = variant === "previous" ? appointment.source : variant.charAt(0).toUpperCase() + variant.slice(1);
		if (variant === "denied" && isCancelledByDoctor) badgeLabel = "Cancelled by Doctor";
		const badgeVariant = STATUS_VARIANTS[badgeLabel] || (variant === "denied" ? "destructive" : "default");

		const rowSupplements = supplements[appointment._id];
		const showRating =
			(variant === "upcoming" && new Date(appointment.dateOfAppointment) < new Date()) ||
			(variant === "previous" && appointment.source === "Completed");
		const canShare = variant !== "denied" && isWithinSharingWindow(appointment.dateOfAppointment);
		const canRebook = variant === "denied" || (variant === "previous" && appointment.source !== "Pending");
		// doctorId comes back populated (a full object) from getBookingsByPatientId,
		// not a plain string — anything that needs the raw ID has to unwrap it.
		const doctorIdStr = appointment.doctorId?._id || appointment.doctorId;

		return (
			<div className="rounded-(--jh-radius-lg) bg-card p-4 shadow-(--jh-shadow-rest) sm:p-5">
				<div className="flex flex-wrap items-start justify-between gap-2">
					<h3 className="font-display text-lg text-foreground">Dr. {appointment.doctorName}</h3>
					<div className="flex flex-wrap items-center gap-1.5">
						{isRescheduled ? <Badge variant="warning">Rescheduled</Badge> : null}
						<Badge variant={badgeVariant}>{badgeLabel}</Badge>
					</div>
				</div>

				<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
					<span className="flex items-center gap-1.5"><Calendar size={13} /> {formatDate(appointment.dateOfAppointment)}</span>
					{appointment.timeSlot ? <span className="flex items-center gap-1.5"><Clock size={13} /> {appointment.timeSlot}</span> : null}
					<span className="flex items-center gap-1.5 text-xs"><Mail size={12} /> {appointment.doctorEmail}</span>
				</div>

				<IllnessSection
					appointmentId={appointment._id}
					illness={appointment.patientIllness}
					editable={variant === "upcoming"}
					onSaved={onIllnessUpdated}
				/>

				{variant === "denied" && (
					<div className="mt-3 rounded-(--jh-radius-md) border border-destructive/20 bg-destructive/5 p-3">
						<span className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
							<AlertCircle size={13} /> Reason for Cancellation
						</span>
						<p className="mt-1 text-sm text-foreground">{appointment.doctorsMessage || "No specific reason provided by doctor."}</p>
					</div>
				)}

				{variant === "previous" && appointment.doctorsMessage ? (
					<div className="mt-3 rounded-(--jh-radius-md) bg-secondary/60 p-3">
						<span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
							<MessageSquareText size={13} /> Doctor's Note
						</span>
						<p className="mt-1 text-sm text-foreground">{appointment.doctorsMessage}</p>
					</div>
				) : null}

				{variant === "upcoming" || variant === "previous" ? (
					<PrescriptionSummary diagnosis={appointment.diagnosis} supplements={rowSupplements} />
				) : null}

				{showRating && appointment.rating != null ? (
					<div className="mt-3 flex flex-wrap items-center gap-2">
						<span className="flex items-center gap-0.5">
							{[...Array(5)].map((_, i) => (
								<Star
									key={i}
									size={15}
									className={i < appointment.rating ? "fill-(--jh-turmeric-gold) text-(--jh-turmeric-gold)" : "text-border"}
								/>
							))}
						</span>
						{appointment.review ? <span className="text-sm italic text-muted-foreground">"{appointment.review}"</span> : null}
					</div>
				) : null}

				<div className="mt-4 flex flex-wrap gap-2">
					{variant === "upcoming" && (
						<>
							<Button size="sm" onClick={() => handleJoinDaily(appointment._id)} disabled={joiningId === appointment._id}>
								<Video size={14} /> {joiningId === appointment._id ? "Joining…" : "Join Meet"}
							</Button>
							{appointment.meetLink && appointment.meetLink !== "no" ? (
								<Button
									size="sm"
									variant="outline"
									title="Backup link from your doctor, in case the built-in video call fails"
									onClick={() => window.open(appointment.meetLink, "_blank")}
								>
									<LinkIcon size={14} /> Alternate Link
								</Button>
							) : null}
						</>
					)}

					{(variant === "upcoming" || variant === "previous") && appointment.payoutStatus === "held" ? (
						<Button
							size="sm"
							variant="ghost"
							title="Flag a problem with this appointment before payout to the doctor is released"
							onClick={() => handleReportIssue(appointment)}
							disabled={reportingId === appointment._id}
						>
							{reportingId === appointment._id ? "Reporting…" : "Report an Issue"}
						</Button>
					) : null}

					{variant === "pending" ? (
						<Button
							size="sm"
							variant="destructive"
							onClick={() => handleCancelRequest(appointment)}
							disabled={cancellingId === appointment._id}
						>
							<XCircle size={14} /> {cancellingId === appointment._id ? "Cancelling..." : "Cancel Request"}
						</Button>
					) : null}

					{showRating && appointment.rating == null ? (
						<Button
							size="sm"
							variant="ghost"
							onClick={() => (variant === "previous" ? navigate(`/PatientFeedback/${appointment._id}`) : onRatingClick(appointment._id))}
						>
							<Star size={14} /> Give Rating
						</Button>
					) : null}

					{canShare ? (
						<Button size="sm" variant="outline" onClick={() => setShareModal({ bookingId: appointment._id, mode: "upload" })}>
							<UploadCloud size={14} /> Share Prescription
						</Button>
					) : null}

					{variant === "previous" && appointment.source === "Completed" && rowSupplements?.length > 0 ? (
						<Button size="sm" variant="ghost" onClick={() => navigate("/cart")}>
							<ShoppingBag size={14} /> View in Cart
						</Button>
					) : null}

					{canRebook ? (
						<Button size="sm" variant="ghost" onClick={() => handleRebook(appointment)} disabled={rebookingId === appointment._id}>
							<RotateCcw size={14} /> {rebookingId === appointment._id ? "Loading..." : "Rebook with this Doctor"}
						</Button>
					) : null}
				</div>
			</div>
		);
	};

	const renderList = (items, variant, sortDirection, emptyText) => {
		const sorted = [...items].sort((a, b) =>
			sortDirection === "asc"
				? new Date(a.dateOfAppointment) - new Date(b.dateOfAppointment)
				: new Date(b.dateOfAppointment) - new Date(a.dateOfAppointment),
		);
		return (
			<div className="flex flex-col gap-4">
				{sorted.length > 0 ? (
					sorted.map((a) => <AppointmentCard key={a._id} appointment={a} variant={variant} />)
				) : (
					<EmptyState title={emptyText} />
				)}
			</div>
		);
	};

	let content;
	switch (activeTab) {
		case "Upcoming":
			content = renderList(upcomingAppointments, "upcoming", "asc", "No upcoming doctor assigned.");
			break;
		case "Pending":
			content = renderList(pendingDoctors, "pending", "asc", "No pending doctor requests at the moment.");
			break;
		case "Denied":
			content = renderList(deniedDoctors, "denied", "desc", "No denied doctor requests at the moment.");
			break;
		case "Previous":
			content = renderList(previousAppointments, "previous", "desc", "No previous appointments in your history.");
			break;
		default:
			content = <p className="text-muted-foreground">Select a tab to view appointments</p>;
	}

	return (
		<>
			{content}
			{shareModal ? (
				<ShareRecordModal bookingId={shareModal.bookingId} initialMode={shareModal.mode} onClose={() => setShareModal(null)} />
			) : null}
		</>
	);
};

export default AppointmentTab;
