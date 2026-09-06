import { FileText, Pill, Stethoscope, Image as ImageIcon, ExternalLink } from "lucide-react";

import { BACKEND_URL } from "../../../config";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/date";

const BACKEND = BACKEND_URL || "http://localhost:8080";

const SharedRecordCard = ({ record }) => {
	const isFile = record.type === "external_file";
	const ref = record.referencedBookingId;
	const fileUrl = record.fileUrl?.startsWith("http") ? record.fileUrl : `${BACKEND}/${record.fileUrl}`;
	const rawDoctor = ref?.doctorName || "Doctor";
	const doctorLabel = rawDoctor.startsWith("Dr.") ? rawDoctor : `Dr. ${rawDoctor}`;
	
	const isImage = isFile && /\.(jpe?g|png|webp|gif|svg)$/i.test(record.fileUrl || "");
	const isPdf = isFile && /\.pdf$/i.test(record.fileUrl || "");
	const fileName = isFile ? (record.fileUrl?.split("/").pop()?.split("\\").pop() || "Attached Document") : "";

	return (
		<div className="flex flex-col gap-2.5 rounded-lg border border-border/80 bg-secondary/50 p-3.5 shadow-xs transition-all hover:border-primary/40">
			<div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
				<Badge
					variant="outline"
					className="border-accent-foreground/30 bg-accent/40 text-accent-foreground uppercase text-[10px] font-semibold tracking-wider flex items-center gap-1.5"
				>
					{isFile ? (
						isImage ? (
							<>
								<ImageIcon size={12} className="text-primary" /> Attached Prescription (Image)
							</>
						) : isPdf ? (
							<>
								<FileText size={12} className="text-primary" /> Attached Prescription (PDF)
							</>
						) : (
							<>
								<FileText size={12} className="text-primary" /> External Document
							</>
						)
					) : (
						<>
							<Stethoscope size={12} className="text-primary" /> Linked Platform Prescription
						</>
					)}
				</Badge>
				<span className="text-[11px] text-muted-foreground font-medium">
					Shared {formatDate(record.uploadedAt)}
				</span>
			</div>

			{isFile ? (
				<div className="flex flex-col gap-2.5 py-1">
					{isImage ? (
						<div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-lg border border-border/70 bg-card/80 p-2.5">
							<a
								href={fileUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="relative group shrink-0 overflow-hidden rounded-md border border-border block"
							>
								<img
									src={fileUrl}
									alt="Attached Prescription Preview"
									className="h-20 w-28 object-cover rounded transition-transform group-hover:scale-105"
								/>
								<span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity text-xs font-semibold gap-1">
									<ExternalLink size={12} /> View
								</span>
							</a>
							<div className="flex flex-col gap-1 min-w-0 flex-1">
								<span className="text-xs font-semibold text-foreground truncate">{fileName}</span>
								<span className="text-[11px] text-muted-foreground">Scanned Prescription / Image Document</span>
								<a
									href={fileUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline mt-1"
								>
									<ExternalLink size={13} /> Open Full Size Image
								</a>
							</div>
						</div>
					) : (
						<div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-card/80 p-3">
							<div className="flex items-center gap-2.5 min-w-0">
								<div className="rounded-md bg-destructive/10 p-2 text-destructive shrink-0">
									<FileText size={20} />
								</div>
								<div className="flex flex-col min-w-0">
									<span className="text-xs font-semibold text-foreground truncate">{fileName}</span>
									<span className="text-[11px] text-muted-foreground">PDF Document</span>
								</div>
							</div>
							<a
								href={fileUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 shrink-0"
							>
								<ExternalLink size={13} /> View PDF
							</a>
						</div>
					)}
				</div>
			) : ref ? (
				<div className="flex flex-col gap-2 text-xs">
					<div className="flex flex-wrap items-center justify-between gap-1.5">
						<div>
							<strong className="text-foreground">Prescribing Doctor:</strong>{" "}
							<span className="font-semibold text-foreground">{doctorLabel}</span>
						</div>
						<div className="text-muted-foreground">
							<strong className="text-foreground/80">Prescription Date:</strong> {formatDate(ref.dateOfAppointment)}
						</div>
					</div>

					<div>
						<strong className="text-foreground">Reason for Visit:</strong>{" "}
						<span className="text-foreground/90">{ref.patientIllness || <span className="italic text-muted-foreground">Not provided</span>}</span>
					</div>

					<div>
						<strong className="text-foreground">Diagnosis:</strong>{" "}
						<span className="text-foreground/90">{ref.diagnosis || <span className="italic text-muted-foreground">Not provided</span>}</span>
					</div>

					{ref.recommendedSupplements?.length > 0 ? (
						<div className="rounded-md bg-card/90 p-2.5 border border-border/60">
							<p className="font-semibold text-foreground mb-2 flex items-center gap-1.5 text-xs">
								<Pill size={12} className="text-(--jh-olive-leaf)" /> Prescribed Medicines ({ref.recommendedSupplements.length}):
							</p>
							<div className="flex flex-col gap-2">
								{ref.recommendedSupplements.map((med, idx) => (
									<div key={med._id || idx} className="flex flex-col gap-1 rounded bg-secondary/40 p-2 border border-border/50 text-[11px]">
										<div>
											<strong className="text-foreground">Medicine Name:</strong>{" "}
											<span className="font-semibold text-foreground">{med.medicineName || "Not provided"}</span>
										</div>
										<div>
											<strong className="text-foreground">Dosage:</strong>{" "}
											<span className="text-foreground/90">{med.dosage || <span className="italic text-muted-foreground">Not provided</span>}</span>
										</div>
										<div>
											<strong className="text-foreground">Instructions:</strong>{" "}
											<span className="text-foreground/90">{med.instructions ? <span className="italic text-muted-foreground">{med.instructions}</span> : <span className="italic text-muted-foreground">Not provided</span>}</span>
										</div>
									</div>
								))}
							</div>
						</div>
					) : (
						<div>
							<strong className="text-foreground">Medicines:</strong>{" "}
							<span className="italic text-muted-foreground">Not provided</span>
						</div>
					)}
				</div>
			) : (
				<span className="text-xs font-medium text-muted-foreground italic">This referenced prescription is no longer available.</span>
			)}

			{record.note ? (
				<div className="border-t border-border/50 pt-2 text-xs">
					<strong className="text-foreground">Patient Note:</strong>{" "}
					<span className="italic text-muted-foreground">&quot;{record.note}&quot;</span>
				</div>
			) : null}
		</div>
	);
};

const PreviousPrescriptionCard = ({ booking }) => {
	const count = booking.recommendedSupplements?.length || 0;

	return (
		<div className="flex flex-col gap-2.5 rounded-lg border border-border/80 bg-secondary/50 p-3.5 shadow-xs transition-all hover:border-primary/40">
			<div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
				<Badge
					variant="outline"
					className="border-accent-foreground/30 bg-accent/40 text-accent-foreground uppercase text-[10px] font-semibold tracking-wider flex items-center gap-1.5"
				>
					<Stethoscope size={12} className="text-primary" /> Past Consultation Record
				</Badge>
				<span className="text-[11px] text-muted-foreground font-medium">
					Prescription Date: {formatDate(booking.dateOfAppointment)}
				</span>
			</div>

			<div className="flex flex-col gap-2 text-xs">
				<div>
					<strong className="text-foreground">Reason for Visit:</strong>{" "}
					<span className="text-foreground/90">{booking.patientIllness || <span className="italic text-muted-foreground">Not provided</span>}</span>
				</div>

				<div>
					<strong className="text-foreground">Diagnosis:</strong>{" "}
					<span className="text-foreground/90">{booking.diagnosis || <span className="italic text-muted-foreground">Not provided</span>}</span>
				</div>

				{count > 0 ? (
					<div className="rounded-md bg-card/90 p-2.5 border border-border/60">
						<p className="font-semibold text-foreground mb-2 flex items-center gap-1.5 text-xs">
							<Pill size={12} className="text-(--jh-olive-leaf)" /> Prescribed Medicines ({count}):
						</p>
						<div className="flex flex-col gap-2">
							{booking.recommendedSupplements.map((med, idx) => (
								<div key={med._id || idx} className="flex flex-col gap-1 rounded bg-secondary/40 p-2 border border-border/50 text-[11px]">
									<div>
										<strong className="text-foreground">Medicine Name:</strong>{" "}
										<span className="font-semibold text-foreground">{med.medicineName || "Not provided"}</span>
									</div>
									<div>
										<strong className="text-foreground">Dosage:</strong>{" "}
										<span className="text-foreground/90">{med.dosage || <span className="italic text-muted-foreground">Not provided</span>}</span>
									</div>
									<div>
										<strong className="text-foreground">Instructions:</strong>{" "}
										<span className="text-foreground/90">{med.instructions ? <span className="italic text-muted-foreground">{med.instructions}</span> : <span className="italic text-muted-foreground">Not provided</span>}</span>
									</div>
								</div>
							))}
						</div>
					</div>
				) : (
					<div>
						<strong className="text-foreground">Medicines:</strong>{" "}
						<span className="italic text-muted-foreground">Not provided</span>
					</div>
				)}

				{booking.doctorsMessage ? (
					<div className="border-t border-border/50 pt-2 text-xs">
						<strong className="text-foreground">Doctor Note:</strong>{" "}
						<span className="italic text-muted-foreground">&quot;{booking.doctorsMessage}&quot;</span>
					</div>
				) : null}
			</div>
		</div>
	);
};

export function PrescriptionHistory({ prescriptions, loading, sharedRecords = [], currentBookingId }) {
	const past = (Array.isArray(prescriptions) ? prescriptions : [])
		.filter((b) => b._id !== currentBookingId)
		.filter((b) => (b.recommendedSupplements || []).length > 0 || b.diagnosis)
		.sort((a, b) => new Date(b.dateOfAppointment) - new Date(a.dateOfAppointment));

	return (
		<Card className="flex flex-col gap-6 p-4.5">
			<div>
				<h3 className="mb-3.5 flex items-center gap-2 border-b-2 border-border pb-2.5 text-base font-bold text-foreground">
					<FileText className="size-[1.15rem] text-primary" />
					Records the Patient Attached ({sharedRecords.length})
				</h3>
				{sharedRecords.length > 0 ? (
					<div className="grid gap-2.5">
						{sharedRecords.map((record, idx) => (
							<SharedRecordCard key={idx} record={record} />
						))}
					</div>
				) : (
					<p className="rounded-lg border border-dashed border-border bg-muted/40 p-5 text-center text-sm text-muted-foreground">
						The patient hasn't attached any external records to this visit.
					</p>
				)}
			</div>

			<div>
				<h3 className="mb-3.5 flex items-center gap-2 border-b-2 border-border pb-2.5 text-base font-bold text-foreground">
					<Stethoscope className="size-[1.15rem] text-primary" />
					Your Previous Prescriptions ({past.length})
				</h3>

				{loading ? (
					<p className="rounded-lg border border-dashed border-border bg-muted/40 p-5 text-center text-sm text-muted-foreground">
						Loading prescription history...
					</p>
				) : past.length === 0 ? (
					<p className="rounded-lg border border-dashed border-border bg-muted/40 p-5 text-center text-sm text-muted-foreground">
						No previous prescriptions for this patient yet.
					</p>
				) : (
					<div className="grid gap-2.5">
						{past.map((booking) => (
							<PreviousPrescriptionCard key={booking._id} booking={booking} />
						))}
					</div>
				)}
			</div>
		</Card>
	);
}
