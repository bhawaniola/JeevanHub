import React, { useState, useEffect } from 'react';
import { History as HistoryIcon, CalendarClock, Clock, Video, Pill, Stethoscope, FileText } from 'lucide-react';

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateReadable } from "@/lib/date";

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

const History = ({ bookings = [] }) => {
	const [upcomingAppointments, setUpcomingAppointments] = useState([]);
	const [pastAppointments, setPastAppointments] = useState([]);

	useEffect(() => {
		const now = new Date();

		const upcoming = (bookings || [])
			.filter((b) => new Date(b.dateOfAppointment) >= now && b.requestAccept !== 'denied')
			.sort((a, b) => new Date(a.dateOfAppointment) - new Date(b.dateOfAppointment))
			.map((b) => {
				const rawDoctor = b.doctorName || "Doctor";
				const doctorName = rawDoctor.startsWith("Dr.") ? rawDoctor : `Dr. ${rawDoctor}`;
				const meetUrl = b.dailyRoomUrl || (b.meetLink && b.meetLink !== "no" ? b.meetLink : "");

				return {
					id: b._id,
					doctor: doctorName,
					date: b.dateOfAppointment,
					time: b.timeSlot ? format12HourTime(b.timeSlot) : "Scheduled Time",
					patientIllness: b.patientIllness,
					meetUrl: meetUrl,
					amountPaid: b.amountPaid,
					status: b.requestAccept,
				};
			});

		const past = (bookings || [])
			.filter((b) => new Date(b.dateOfAppointment) < now || b.requestAccept === 'denied')
			.sort((a, b) => new Date(b.dateOfAppointment) - new Date(a.dateOfAppointment))
			.map((b) => {
				const rawDoctor = b.doctorName || "Doctor";
				const doctorName = rawDoctor.startsWith("Dr.") ? rawDoctor : `Dr. ${rawDoctor}`;

				return {
					id: b._id,
					doctor: doctorName,
					date: b.dateOfAppointment,
					time: b.timeSlot ? format12HourTime(b.timeSlot) : "",
					patientIllness: b.patientIllness,
					diagnosis: b.diagnosis,
					doctorsMessage: b.doctorsMessage,
					medicines: b.recommendedSupplements || [],
					amountPaid: b.amountPaid,
					status: b.requestAccept,
				};
			});

		setUpcomingAppointments(upcoming);
		setPastAppointments(past);
	}, [bookings]);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 font-display text-xl">
					<HistoryIcon size={20} /> Medical History &amp; Appointments
				</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-10">
				{/* Section 1: Upcoming Schedule */}
				<div>
					<h4 className="mb-6 flex items-center gap-2 border-b border-border pb-3 text-base font-semibold text-foreground">
						<CalendarClock size={18} /> Upcoming Schedule
					</h4>
					<div className="flex flex-col gap-4">
						{upcomingAppointments.length > 0 ? (
							upcomingAppointments.map((appt) => (
								<div
									key={appt.id}
									className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-(--jh-radius-md) border border-border bg-secondary/40 p-4.5 transition-shadow hover:shadow-sm"
								>
									<div className="flex items-start gap-4 min-w-0">
										<div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-(--jh-radius-md) bg-accent text-center font-bold text-accent-foreground border border-border/50">
											<span className="text-2xl leading-tight">
												{new Date(appt.date).getDate()}
											</span>
											<span className="text-xs uppercase">
												{new Date(appt.date).toLocaleString("en-US", { month: "short" })}
											</span>
										</div>
										<div className="min-w-0 flex-1">
											<div className="flex flex-wrap items-center gap-2">
												<h5 className="font-display font-semibold text-foreground text-base">{appt.doctor}</h5>
												<Badge variant="secondary" className="text-xs font-semibold">
													{appt.time}
												</Badge>
											</div>
											<p className="text-xs text-muted-foreground mt-1">
												<strong className="text-foreground/80">Reason for Visit:</strong>{" "}
												{appt.patientIllness || <span className="italic">Not specified</span>}
											</p>
											{appt.meetUrl ? (
												<div className="mt-2">
													<a
														href={appt.meetUrl}
														target="_blank"
														rel="noopener noreferrer"
														className="inline-flex items-center gap-1.5 text-xs font-semibold text-(--jh-olive-leaf) hover:underline"
													>
														<Video size={14} /> Join Video Consultation
													</a>
												</div>
											) : (
												<p className="text-xs text-muted-foreground/80 mt-1 flex items-center gap-1">
													<Video size={13} /> Video room link will activate before consultation
												</p>
											)}
										</div>
									</div>

									<div className="shrink-0 self-start sm:self-center text-right">
										<Badge variant={appt.amountPaid === 0 ? "secondary" : "default"} className="text-xs">
											{appt.amountPaid === 0 ? "Free" : `₹${appt.amountPaid}`}
										</Badge>
									</div>
								</div>
							))
						) : (
							<EmptyState icon={CalendarClock} title="No upcoming appointments" description="Scheduled visits will appear here." />
						)}
					</div>
				</div>

				{/* Section 2: Past Visits Timeline */}
				<div>
					<h4 className="mb-6 flex items-center gap-2 border-b border-border pb-3 text-base font-semibold text-foreground">
						<HistoryIcon size={18} /> Past Visits
					</h4>
					{pastAppointments.length > 0 ? (
						<div className="relative border-l-2 border-border pl-6 sm:pl-8 ml-2">
							{pastAppointments.map((visit) => (
								<div key={visit.id} className="relative mb-8 last:mb-0">
									<div className="absolute -left-[1.95rem] sm:-left-[2.45rem] top-1 size-3.5 rounded-full border-[3px] border-primary bg-card" />
									<div className="flex flex-col gap-2.5 rounded-(--jh-radius-md) border border-border bg-card p-4.5 shadow-xs transition-shadow hover:shadow-sm">
										{/* Visit Header */}
										<div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
											<div className="flex flex-wrap items-center gap-2">
												<h5 className="font-semibold text-foreground text-base">{visit.doctor}</h5>
												{visit.status === 'denied' ? (
													<Badge variant="destructive" className="text-xs">Cancelled</Badge>
												) : (
													<Badge variant="secondary" className="text-xs">Completed</Badge>
												)}
											</div>
											<div className="flex items-center gap-2 text-xs text-muted-foreground">
												<span>{formatDateReadable(visit.date)}</span>
												{visit.time ? (
													<>
														<span>•</span>
														<span className="flex items-center gap-1">
															<Clock size={12} /> {visit.time}
														</span>
													</>
												) : null}
											</div>
										</div>

										{/* Reason for Visit */}
										<p className="text-xs text-muted-foreground">
											<strong className="text-foreground">Reason for Visit:</strong>{" "}
											{visit.patientIllness || <span className="italic text-muted-foreground/75">Not specified</span>}
										</p>

										{/* Diagnosis */}
										<p className="text-xs text-muted-foreground">
											<strong className="text-foreground">Diagnosis:</strong>{" "}
											{visit.diagnosis ? visit.diagnosis : <span className="italic text-muted-foreground/75">Not given</span>}
										</p>

										{/* Prescribed Medicines Summary */}
										{visit.medicines.length > 0 ? (
											<div className="mt-1 rounded-md bg-secondary/40 p-3 border border-border/60 text-xs">
												<p className="font-semibold text-foreground mb-2 flex items-center gap-1.5">
													<Pill size={13} className="text-(--jh-olive-leaf)" /> Prescribed Medicines ({visit.medicines.length}):
												</p>
												<div className="flex flex-col gap-2">
													{visit.medicines.map((med, idx) => (
														<div key={med._id || idx} className="flex flex-col gap-1 rounded bg-card/80 p-2.5 border border-border/50">
															<div>
																<strong className="text-foreground">Medicine Name:</strong>{" "}
																<span className="font-semibold text-foreground">{med.medicineName}</span>
															</div>
															{med.dosage ? (
																<div>
																	<strong className="text-foreground">Dosage:</strong>{" "}
																	<span className="text-foreground/90">{med.dosage}</span>
																</div>
															) : null}
															{med.instructions ? (
																<div>
																	<strong className="text-foreground">Instructions:</strong>{" "}
																	<span className="italic text-muted-foreground">{med.instructions}</span>
																</div>
															) : null}
														</div>
													))}
												</div>
											</div>
										) : (
											<p className="text-xs text-muted-foreground">
												<strong className="text-foreground">Medicines:</strong>{" "}
												<span className="italic text-muted-foreground/75">None prescribed</span>
											</p>
										)}

										{/* Doctor Note / Cancellation Reason */}
										{visit.doctorsMessage ? (
											<p className="text-xs text-muted-foreground/90 border-t border-border/40 pt-2 italic">
												<strong className="text-foreground not-italic">Doctor Note:</strong> {visit.doctorsMessage}
											</p>
										) : null}
									</div>
								</div>
							))}
						</div>
					) : (
						<EmptyState icon={HistoryIcon} title="No past visits recorded" />
					)}
				</div>
			</CardContent>
		</Card>
	);
};

export default History;

