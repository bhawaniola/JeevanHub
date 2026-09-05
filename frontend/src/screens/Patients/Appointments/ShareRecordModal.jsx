import { useContext, useEffect, useState } from "react";
import { Link as LinkIcon, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PatientVerificationPanel } from "@/components/PatientVerificationPanel";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/date";
import { AuthContext } from "../../../context/AuthContext";
import { authFetch } from "../../../utils/authFetch";
import { BACKEND_URL } from "../../../config";

// Lets a patient share context with their doctor ahead of / shortly after a specific
// booking — either an external file (a photo/PDF of an outside prescription, run
// through the same OCR review/edit/submit flow as the profile's medical-history
// uploader) or a reference to one of their own past prescriptions on this platform.
const ShareRecordModal = ({ bookingId, onClose, onShared, initialMode = "upload" }) => {
	const { auth } = useContext(AuthContext);
	const [mode, setMode] = useState(initialMode); // 'upload' | 'reference'
	const [file, setFile] = useState(null);
	const [note, setNote] = useState("");
	const [ownBookings, setOwnBookings] = useState([]);
	const [selectedBookingId, setSelectedBookingId] = useState("");
	const [loadingOwnBookings, setLoadingOwnBookings] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [uploadError, setUploadError] = useState("");
	// Once a file is uploaded it goes through the same OCR review step as the
	// profile's medical-history uploader before it counts as "shared" -- this
	// holds that in-progress document.
	const [reviewDoc, setReviewDoc] = useState(null);

	useEffect(() => {
		if (mode !== "reference" || ownBookings.length > 0) return;

		const fetchOwnBookings = async () => {
			setLoadingOwnBookings(true);
			try {
				const response = await authFetch(
					`${BACKEND_URL}/api/bookings/sharing/own-bookings?excludeBookingId=${bookingId}`,
				);
				if (response.ok) {
					const data = await response.json();
					setOwnBookings(data.bookings || []);
				}
			} catch (err) {
				console.error("Error fetching your own bookings:", err);
			} finally {
				setLoadingOwnBookings(false);
			}
		};

		fetchOwnBookings();
	}, [mode, bookingId, ownBookings.length]);

	const handleUploadForReview = async () => {
		if (!file) {
			alert("Please choose a file to upload.");
			return;
		}

		setUploading(true);
		setUploadError("");
		try {
			const formData = new FormData();
			formData.append("documents", file);

			const response = await authFetch(`${BACKEND_URL}/api/patients/${auth.user.id}/medical-history`, {
				method: "POST",
				body: formData,
			});

			const data = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(data.message || "Failed to upload document");
			}

			const uploaded = (data.medicalHistory || []).at(-1);
			if (!uploaded) {
				throw new Error("Upload succeeded but no document was returned");
			}
			setReviewDoc(uploaded);
		} catch (err) {
			console.error("Error uploading document for review:", err);
			setUploadError(err.message);
		} finally {
			setUploading(false);
		}
	};

	// Fires once the patient hits "Submit to doctor" inside the OCR review panel
	// (PatientVerificationPanel already handles the save/submit calls itself --
	// once it reaches "submitted" we still need to attach the doc to *this*
	// booking so it shows up on the doctor's booking view).
	const handleReviewDocUpdate = async (updatedDoc) => {
		setReviewDoc(updatedDoc);
		if (updatedDoc?.patientVerification?.status !== "submitted") return;

		setSubmitting(true);
		try {
			const formData = new FormData();
			formData.append("medicalHistoryDocId", updatedDoc._id);
			formData.append("note", note);

			const response = await authFetch(`${BACKEND_URL}/api/bookings/${bookingId}/shared-records`, {
				method: "POST",
				body: formData,
			});
			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.error || "Failed to attach document to this booking");
			}
			onShared?.();
			onClose();
		} catch (err) {
			console.error("Error attaching reviewed document to booking:", err);
			setUploadError(err.message);
		} finally {
			setSubmitting(false);
		}
	};

	const handleSubmitReference = async () => {
		if (!selectedBookingId) {
			alert("Please select a prescription to link.");
			return;
		}

		setSubmitting(true);
		try {
			const formData = new FormData();
			formData.append("referencedBookingId", selectedBookingId);
			formData.append("note", note);

			const response = await authFetch(`${BACKEND_URL}/api/bookings/${bookingId}/shared-records`, {
				method: "POST",
				body: formData,
			});

			if (!response.ok) {
				const errData = await response.json().catch(() => ({}));
				throw new Error(errData.error || "Failed to share record");
			}

			alert("Shared with your doctor successfully.");
			onShared?.();
			onClose();
		} catch (err) {
			console.error("Error sharing record:", err);
			alert(`Error: ${err.message}`);
		} finally {
			setSubmitting(false);
		}
	};

	const inReview = mode === "upload" && !!reviewDoc;

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className={cn("gap-4", inReview ? "max-w-4xl" : "max-w-lg")}>
				<DialogTitle>Share a prescription with your doctor</DialogTitle>
				<DialogDescription>
					{inReview
						? "Review the transcribed details below, correct anything OCR got wrong, then submit -- your doctor only ever sees the final, submitted version."
						: "Upload a photo or PDF of an outside prescription, or link one of your own prescriptions from this platform, so your doctor has it for reference around this appointment."}
				</DialogDescription>

				{!inReview ? (
					<div className="flex gap-1 rounded-lg bg-secondary p-1" role="group" aria-label="Share method">
						<button
							type="button"
							onClick={() => setMode("upload")}
							className={cn(
								"flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors",
								mode === "upload" ? "bg-card text-primary shadow-(--jh-shadow-rest)" : "text-muted-foreground hover:text-foreground",
							)}
						>
							<Upload size={16} /> Upload a file
						</button>
						<button
							type="button"
							onClick={() => setMode("reference")}
							className={cn(
								"flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors",
								mode === "reference" ? "bg-card text-primary shadow-(--jh-shadow-rest)" : "text-muted-foreground hover:text-foreground",
							)}
						>
							<LinkIcon size={16} /> Link a past prescription
						</button>
					</div>
				) : null}

				{mode === "upload" ? (
					inReview ? (
						<div className="flex flex-col gap-2">
							{uploadError ? <p className="text-xs text-destructive">{uploadError}</p> : null}
							<div className="flex h-[70vh] max-h-[70vh] flex-col overflow-hidden rounded-lg border border-border md:flex-row">
								<div className="flex flex-1 items-center justify-center overflow-auto bg-secondary/60">
									{reviewDoc.mimeType?.startsWith("image/") ? (
										<img src={reviewDoc.url} alt={reviewDoc.fileName} className="max-h-full max-w-full object-contain" />
									) : (
										<iframe src={reviewDoc.url} title={reviewDoc.fileName} className="size-full border-0" />
									)}
								</div>
								<PatientVerificationPanel doc={reviewDoc} patientId={auth.user.id} onDocUpdate={handleReviewDocUpdate} />
							</div>
						</div>
					) : (
						<div className="flex flex-col gap-3">
							<div className="flex flex-col gap-1.5">
								<Label htmlFor="share-record-file">Prescription photo or PDF</Label>
								<input
									id="share-record-file"
									type="file"
									accept="image/*,application/pdf"
									onChange={(e) => setFile(e.target.files[0])}
									className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-secondary-foreground"
								/>
							</div>
							{uploadError ? <p className="text-xs text-destructive">{uploadError}</p> : null}
							<Button onClick={handleUploadForReview} disabled={uploading || !file} className="w-full">
								{uploading ? (
									<>
										<Loader2 className="size-4 animate-spin" /> Transcribing...
									</>
								) : (
									"Upload & review"
								)}
							</Button>
						</div>
					)
				) : (
					<div className="flex flex-col gap-3">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor="share-record-reference">Choose a past prescription</Label>
							{loadingOwnBookings ? (
								<p className="text-sm text-muted-foreground">Loading your prescriptions...</p>
							) : ownBookings.length === 0 ? (
								<p className="text-sm text-muted-foreground">You don't have any prescriptions on this platform yet.</p>
							) : (
								<Select
									value={selectedBookingId}
									onValueChange={setSelectedBookingId}
									items={ownBookings.map((b) => ({
										value: b._id,
										label: `Dr. ${b.doctorName} — ${formatDate(b.dateOfAppointment)}${
											b.recommendedSupplements?.length > 0
												? ` (${b.recommendedSupplements.map((s) => s.medicineName).join(", ")})`
												: ""
										}`,
									}))}
								>
									<SelectTrigger id="share-record-reference">
										<SelectValue placeholder="Select one..." />
									</SelectTrigger>
									<SelectContent>
										{ownBookings.map((b) => (
											<SelectItem key={b._id} value={b._id}>
												Dr. {b.doctorName} — {formatDate(b.dateOfAppointment)}
												{b.recommendedSupplements?.length > 0
													? ` (${b.recommendedSupplements.map((s) => s.medicineName).join(", ")})`
													: ""}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						</div>

						<div className="flex flex-col gap-1.5">
							<Label htmlFor="share-record-note">Note (optional)</Label>
							<textarea
								id="share-record-note"
								value={note}
								onChange={(e) => setNote(e.target.value)}
								placeholder="Any context for your doctor..."
								rows={2}
								className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
							/>
						</div>

						<Button onClick={handleSubmitReference} disabled={submitting} className="w-full">
							{submitting ? (
								<>
									<Loader2 className="size-4 animate-spin" /> Sharing...
								</>
							) : (
								"Share with doctor"
							)}
						</Button>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
};

export default ShareRecordModal;
