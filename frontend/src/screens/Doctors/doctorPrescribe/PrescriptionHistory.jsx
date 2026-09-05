import { useState } from "react";
import { FileText, Link as LinkIcon, Pill, CalendarDays, Stethoscope, ClipboardList, ChevronRight } from "lucide-react";

import { BACKEND_URL } from "../../../config";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/date";

const BACKEND = BACKEND_URL || "http://localhost:8080";

const SharedRecordCard = ({ record }) => {
	const isFile = record.type === "external_file";
	const ref = record.referencedBookingId;
	const fileUrl = record.fileUrl?.startsWith("http") ? record.fileUrl : `${BACKEND}/${record.fileUrl}`;
	const rawDoctor = ref?.doctorName || "Doctor";
	const doctorLabel = rawDoctor.startsWith("Dr.") ? rawDoctor : `Dr. ${rawDoctor}`;

	return (
		<div className="flex flex-col gap-2.5 rounded-lg border border-border/80 bg-secondary/50 p-3.5 shadow-xs">
			<div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
				<Badge variant="outline" className="border-accent-foreground/30 bg-accent/40 text-accent-foreground uppercase text-[10px] font-semibold tracking-wider">
					{isFile ? "External Document" : "Linked Platform Prescription"}
				</Badge>
				<span className="text-[11px] text-muted-foreground font-medium">
					Shared {formatDate(record.uploadedAt)}
				</span>
			</div>

			{isFile ? (
				<div className="flex flex-col gap-1.5 py-1">
					<a
						href={fileUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
					>
						<FileText size={16} className="shrink-0" /> View Uploaded Prescription Document
					</a>
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

					{ref.diagnosis ? (
						<div>
							<strong className="text-foreground">Diagnosis:</strong>{" "}
							<span className="text-foreground/90">{ref.diagnosis}</span>
						</div>
					) : null}

					{ref.recommendedSupplements?.length > 0 ? (
						<div className="rounded bg-card/80 p-2.5 border border-border/60">
							<p className="font-semibold text-foreground mb-1 flex items-center gap-1.5">
								<Pill size={12} className="text-(--jh-olive-leaf)" /> Prescribed Medicines ({ref.recommendedSupplements.length}):
							</p>
							<div className="flex flex-col gap-1 text-muted-foreground">
								{ref.recommendedSupplements.map((med, idx) => (
									<div key={med._id || idx} className="flex flex-wrap items-center gap-1">
										<span className="font-medium text-foreground">• {med.medicineName}</span>
										{med.dosage ? <span>({med.dosage})</span> : null}
										{med.instructions ? <span className="italic">— {med.instructions}</span> : null}
									</div>
								))}
							</div>
						</div>
					) : (
						<div>
							<strong className="text-foreground">Medicines:</strong>{" "}
							<span className="italic text-muted-foreground">None prescribed</span>
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

export function PrescriptionHistory({ prescriptions, loading, sharedRecords = [], currentBookingId }) {
	const [selected, setSelected] = useState(null);

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
					<div className="flex flex-col gap-2">
						{past.map((booking) => (
							<button
								key={booking._id}
								className="flex w-full flex-col gap-1.5 rounded-lg border border-border bg-muted/40 p-3 text-left transition-all hover:border-primary hover:bg-card"
								onClick={() => setSelected(booking)}
							>
								<div className="flex items-center justify-between">
									<span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
										<CalendarDays size={16} /> {formatDate(booking.dateOfAppointment)}
									</span>
								</div>
								<div className="line-clamp-2 text-sm font-bold text-foreground">
									{booking.diagnosis || <span className="font-medium text-muted-foreground italic">No diagnosis recorded</span>}
								</div>
								<div className="mt-0.5 flex items-center justify-between">
									<Badge variant="secondary" className="gap-1">
										<Pill size={13} /> {booking.recommendedSupplements.length}
									</Badge>
									<ChevronRight size={18} className="shrink-0 text-muted-foreground" />
								</div>
							</button>
						))}
					</div>
				)}
			</div>

			<Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
				<DialogContent className="max-w-lg">
					{selected ? (
						<>
							<DialogHeader>
								<DialogTitle>Prescription — {formatDate(selected.dateOfAppointment)}</DialogTitle>
							</DialogHeader>
							<p className="flex items-center gap-2 text-sm text-foreground/80">
								<Stethoscope size={15} className="shrink-0 text-primary" />
								<strong className="text-foreground">Diagnosis:</strong> {selected.diagnosis || "Not recorded"}
							</p>

							<div className="flex flex-col gap-3.5">
								{selected.recommendedSupplements.length === 0 ? (
									<p className="text-sm text-muted-foreground">No medicines were prescribed on this visit.</p>
								) : (
									selected.recommendedSupplements.map((s, idx) => (
										<div key={s._id || idx} className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-4">
											<div className="flex items-center gap-2 text-base font-bold text-primary">
												<Pill size={16} /> {s.medicineName}
											</div>
											<div className="flex items-start gap-2 text-sm text-muted-foreground">
												<ClipboardList size={14} className="mt-0.5 shrink-0" />
												<span>
													<strong className="text-foreground">Dosage:</strong> {s.dosage || "—"}
												</span>
											</div>
											<div className="flex items-start gap-2 text-sm text-muted-foreground">
												<ClipboardList size={14} className="mt-0.5 shrink-0" />
												<span>
													<strong className="text-foreground">Instructions:</strong> {s.instructions || "—"}
												</span>
											</div>
										</div>
									))
								)}
							</div>
						</>
					) : null}
				</DialogContent>
			</Dialog>
		</Card>
	);
}
