import { useState, useEffect, useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
	AlertCircle,
	Bell,
	Check,
	CheckCheck,
	Calendar,
	ExternalLink,
	FileText,
	Info,
	MessageSquare,
	Star,
	User,
	Video,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { AuthContext } from "../../context/AuthContext";
import { authFetch } from "../../utils/authFetch";
import { BACKEND_URL } from "../../config";

const TYPE_CONFIG = {
	appointment: {
		label: "Appointment",
		icon: Calendar,
		iconColor: "text-blue-700 dark:text-blue-400",
		borderAccent: "border-l-4 border-l-blue-600",
		badgeClass: "bg-blue-100/80 text-blue-900 border-blue-300 font-bold",
	},
	dispute: {
		label: "Dispute / Issue",
		icon: AlertCircle,
		iconColor: "text-rose-700 dark:text-rose-400",
		borderAccent: "border-l-4 border-l-rose-600",
		badgeClass: "bg-rose-100/80 text-rose-900 border-rose-300 font-bold",
	},
	review: {
		label: "Patient Review",
		icon: Star,
		iconColor: "text-amber-700 dark:text-amber-400",
		borderAccent: "border-l-4 border-l-amber-600",
		badgeClass: "bg-amber-100/80 text-amber-900 border-amber-300 font-bold",
	},
	system: {
		label: "System Alert",
		icon: FileText,
		iconColor: "text-[var(--jh-olive-deep)]",
		borderAccent: "border-l-4 border-l-[var(--jh-olive-leaf)]",
		badgeClass: "bg-[var(--jh-sage-pale)] text-[var(--jh-olive-deep)] border-[var(--jh-line-strong)] font-bold",
	},
	default: {
		label: "Notification",
		icon: Bell,
		iconColor: "text-[var(--jh-ink)]",
		borderAccent: "border-l-4 border-l-[var(--jh-olive-leaf)]",
		badgeClass: "bg-muted text-foreground border-border font-bold",
	},
};

const extractUrl = (text) => {
	if (!text) return null;
	const match = text.match(/https?:\/\/[^\s]+/i);
	return match ? match[0] : null;
};

const formatNotificationTime = (dateStr) => {
	if (!dateStr) return "";
	const date = new Date(dateStr);
	const now = new Date();
	const isToday = date.toDateString() === now.toDateString();

	const timePart = date.toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
	});

	if (isToday) {
		return `Today, ${timePart}`;
	}

	const yesterday = new Date(now);
	yesterday.setDate(now.getDate() - 1);
	if (date.toDateString() === yesterday.toDateString()) {
		return `Yesterday, ${timePart}`;
	}

	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
};

const DoctorNotification = () => {
	const navigate = useNavigate();
	const { auth } = useContext(AuthContext);
	const doctorId = auth?.user?.id;

	const [notifications, setNotifications] = useState([]);
	const [activeTab, setActiveTab] = useState("all");
	const [loading, setLoading] = useState(true);
	const [markingAll, setMarkingAll] = useState(false);
	const [error, setError] = useState(null);

	const fetchNotifications = async () => {
		if (!auth?.token) {
			setLoading(false);
			return;
		}

		try {
			const response = await authFetch(`${BACKEND_URL}/api/notifications`, {
				method: "GET",
				headers: { "Content-Type": "application/json" },
			});

			if (!response.ok) throw new Error("Failed to fetch notifications");

			const data = await response.json();
			setNotifications(Array.isArray(data) ? data.filter((n) => !n.isRead) : []);
		} catch (err) {
			console.error("Error fetching notifications:", err);
			setError("Could not load notifications.");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchNotifications();

		// Auto-refresh every 30 seconds
		const interval = setInterval(fetchNotifications, 30000);
		return () => clearInterval(interval);
	}, [auth, doctorId]);

	const markAsRead = async (id, e) => {
		if (e) {
			e.preventDefault();
			e.stopPropagation();
		}

		// Optimistic UI update
		setNotifications((prev) => prev.filter((n) => n._id !== id));

		try {
			const response = await authFetch(`${BACKEND_URL}/api/notifications/${id}/read`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
			});

			if (!response.ok) {
				await authFetch(`${BACKEND_URL}/api/notifications/${id}/read`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
				});
			}
		} catch (err) {
			console.error("Error marking notification as read:", err);
		}
	};

	const markAllAsRead = async (e) => {
		if (e) {
			e.preventDefault();
			e.stopPropagation();
		}

		setMarkingAll(true);
		// Optimistic UI update
		setNotifications([]);

		try {
			const response = await authFetch(`${BACKEND_URL}/api/notifications/read-all`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
			});

			if (!response.ok) {
				await authFetch(`${BACKEND_URL}/api/notifications/read-all`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
				});
			}
		} catch (err) {
			console.error("Error marking all notifications as read:", err);
		} finally {
			setMarkingAll(false);
		}
	};

	const handleAction = (notification) => {
		const meetUrl = extractUrl(notification.message);
		if (meetUrl) {
			window.open(meetUrl, "_blank", "noopener,noreferrer");
			return;
		}

		const msgLower = (notification.message || "").toLowerCase();

		if (notification.type === "review" || msgLower.includes("review") || msgLower.includes("rating")) {
			navigate("/doctor-reviews");
			return;
		}

		if (notification.type === "dispute" || msgLower.includes("dispute") || msgLower.includes("refund")) {
			navigate("/appointment-history");
			return;
		}

		if (notification.type === "appointment" || msgLower.includes("appointment") || msgLower.includes("booking")) {
			navigate("/appointment-slots");
			return;
		}

		navigate("/doctor-home");
	};

	const filteredNotifications = useMemo(() => {
		if (activeTab === "all") return notifications;
		if (activeTab === "appointments") {
			return notifications.filter((n) => {
				const msg = (n.message || "").toLowerCase();
				return n.type === "appointment" || msg.includes("appointment") || msg.includes("booking") || msg.includes("consultation");
			});
		}
		if (activeTab === "disputes") {
			return notifications.filter((n) => {
				const msg = (n.message || "").toLowerCase();
				return n.type === "dispute" || msg.includes("dispute") || msg.includes("cancelled") || msg.includes("refund");
			});
		}
		if (activeTab === "reviews") {
			return notifications.filter((n) => {
				const msg = (n.message || "").toLowerCase();
				return n.type === "review" || msg.includes("review") || msg.includes("rating") || msg.includes("feedback");
			});
		}
		if (activeTab === "system") {
			return notifications.filter((n) => n.type === "system");
		}
		return notifications;
	}, [notifications, activeTab]);

	const counts = useMemo(() => {
		return {
			all: notifications.length,
			appointments: notifications.filter((n) => {
				const msg = (n.message || "").toLowerCase();
				return n.type === "appointment" || msg.includes("appointment") || msg.includes("booking") || msg.includes("consultation");
			}).length,
			disputes: notifications.filter((n) => {
				const msg = (n.message || "").toLowerCase();
				return n.type === "dispute" || msg.includes("dispute") || msg.includes("cancelled") || msg.includes("refund");
			}).length,
			reviews: notifications.filter((n) => {
				const msg = (n.message || "").toLowerCase();
				return n.type === "review" || msg.includes("review") || msg.includes("rating") || msg.includes("feedback");
			}).length,
			system: notifications.filter((n) => n.type === "system").length,
		};
	}, [notifications]);

	return (
		<DashboardShell>
			<div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
				{/* Page Header */}
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<div className="flex items-center gap-2.5">
							<h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Doctor Notifications</h1>
							{notifications.length > 0 && (
								<Badge className="bg-[#4a5c28] text-white hover:bg-[#3a4a1f] font-semibold">
									{notifications.length} new
								</Badge>
							)}
						</div>
						<p className="mt-1 text-sm text-muted-foreground">
							Stay updated with consultations, appointment bookings, cancellations, and patient reviews.
						</p>
					</div>

					{notifications.length > 0 && (
						<Button
							variant="outline"
							size="sm"
							onClick={markAllAsRead}
							disabled={markingAll}
							className="flex items-center gap-1.5 self-start border-[var(--jh-line-strong)] bg-white text-foreground hover:bg-[var(--jh-sage-pale)] hover:text-[#4a5c28] font-semibold sm:self-auto cursor-pointer shadow-xs"
						>
							<CheckCheck className="size-4 text-[#4a5c28]" />
							{markingAll ? "Marking..." : "Mark all as read"}
						</Button>
					)}
				</div>

				{/* Filter Tabs */}
				<div className="mt-6 flex flex-wrap gap-2 border-b border-[var(--jh-line)] pb-3">
					<button
						type="button"
						onClick={() => setActiveTab("all")}
						className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
							activeTab === "all"
								? "bg-[#4a5c28] text-white shadow-sm ring-2 ring-[#4a5c28]/20"
								: "border border-[var(--jh-line-strong)] bg-white text-[var(--jh-ink)] hover:bg-[var(--jh-sage-pale)] hover:border-[#4a5c28]"
						}`}
					>
						All ({counts.all})
					</button>

					<button
						type="button"
						onClick={() => setActiveTab("appointments")}
						className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
							activeTab === "appointments"
								? "bg-[#4a5c28] text-white shadow-sm ring-2 ring-[#4a5c28]/20"
								: "border border-[var(--jh-line-strong)] bg-white text-[var(--jh-ink)] hover:bg-[var(--jh-sage-pale)] hover:border-[#4a5c28]"
						}`}
					>
						Appointments ({counts.appointments})
					</button>

					<button
						type="button"
						onClick={() => setActiveTab("disputes")}
						className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
							activeTab === "disputes"
								? "bg-[#4a5c28] text-white shadow-sm ring-2 ring-[#4a5c28]/20"
								: "border border-[var(--jh-line-strong)] bg-white text-[var(--jh-ink)] hover:bg-[var(--jh-sage-pale)] hover:border-[#4a5c28]"
						}`}
					>
						Disputes & Issues ({counts.disputes})
					</button>

					<button
						type="button"
						onClick={() => setActiveTab("reviews")}
						className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
							activeTab === "reviews"
								? "bg-[#4a5c28] text-white shadow-sm ring-2 ring-[#4a5c28]/20"
								: "border border-[var(--jh-line-strong)] bg-white text-[var(--jh-ink)] hover:bg-[var(--jh-sage-pale)] hover:border-[#4a5c28]"
						}`}
					>
						Reviews ({counts.reviews})
					</button>

					<button
						type="button"
						onClick={() => setActiveTab("system")}
						className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
							activeTab === "system"
								? "bg-[#4a5c28] text-white shadow-sm ring-2 ring-[#4a5c28]/20"
								: "border border-[var(--jh-line-strong)] bg-white text-[var(--jh-ink)] hover:bg-[var(--jh-sage-pale)] hover:border-[#4a5c28]"
						}`}
					>
						System ({counts.system})
					</button>
				</div>

				{/* Notifications List */}
				<div className="mt-6">
					{loading ? (
						<div className="py-12 text-center text-sm font-medium text-muted-foreground">Loading notifications...</div>
					) : error ? (
						<div className="rounded-lg bg-destructive/10 p-4 text-center text-sm text-destructive">{error}</div>
					) : filteredNotifications.length === 0 ? (
						<EmptyState
							icon={Bell}
							title="No new notifications"
							description={
								activeTab === "all"
									? "You're all caught up! Patient updates and appointment alerts will appear here."
									: `No unread notifications in ${activeTab}.`
							}
						/>
					) : (
						<ul className="flex flex-col gap-3">
							{filteredNotifications.map((notification) => {
								const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.default;
								const Icon = config.icon;
								const meetUrl = extractUrl(notification.message);
								const cleanMessage = meetUrl
									? notification.message.replace(meetUrl, "").trim()
									: notification.message;

								return (
									<li
										key={notification._id}
										className={`group relative flex flex-col justify-between gap-3.5 rounded-xl border border-[var(--jh-line-strong)] bg-white dark:bg-card p-4.5 shadow-[0_4px_16px_rgba(47,53,36,0.08)] transition-all hover:shadow-[0_8px_24px_rgba(47,53,36,0.12)] hover:border-[#4a5c28] ${config.borderAccent} sm:flex-row sm:items-start`}
									>
										<div className="flex flex-1 items-start gap-3.5 min-w-0">
											<div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--jh-sage-pale)] border border-[var(--jh-line)]">
												<Icon className={`size-5 ${config.iconColor}`} aria-hidden="true" />
											</div>

											<div className="min-w-0 flex-1">
												<div className="flex flex-wrap items-center gap-2">
													<span className={`rounded-md px-2 py-0.5 text-[11px] font-bold border ${config.badgeClass}`}>
														{config.label}
													</span>
													<span className="text-xs font-semibold text-[var(--jh-muted)]">
														{formatNotificationTime(notification.createdAt)}
													</span>
												</div>

												<p className="mt-2 text-sm font-medium text-[var(--jh-ink)] leading-relaxed break-words">
													{cleanMessage}
												</p>

												{/* Action Buttons */}
												<div className="mt-3 flex flex-wrap items-center gap-2">
													{meetUrl ? (
														<a
															href={meetUrl}
															target="_blank"
															rel="noopener noreferrer"
															onClick={() => markAsRead(notification._id)}
															className="inline-flex items-center gap-1.5 rounded-lg bg-[#4a5c28] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#3a4a1f]"
														>
															<Video className="size-3.5" />
															Start Consultation
															<ExternalLink className="size-3 opacity-80" />
														</a>
													) : null}

													<button
														type="button"
														onClick={() => handleAction(notification)}
														className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--jh-line-strong)] bg-[var(--jh-cream)] px-3 py-1.5 text-xs font-semibold text-[var(--jh-olive-deep)] shadow-xs transition-colors hover:bg-[var(--jh-sage-pale)] hover:border-[#4a5c28] cursor-pointer"
													>
														View Details
													</button>
												</div>
											</div>
										</div>

										{/* Mark as read button */}
										<button
											type="button"
											onClick={(e) => markAsRead(notification._id, e)}
											title="Mark as read"
											aria-label="Mark as read"
											className="self-end sm:self-start shrink-0 rounded-full p-2 bg-[var(--jh-sage-pale)]/50 text-[var(--jh-muted)] hover:bg-[#4a5c28] hover:text-white border border-[var(--jh-line-strong)] transition-all cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										>
											<Check className="size-4" />
										</button>
									</li>
								);
							})}
						</ul>
					)}
				</div>
			</div>
		</DashboardShell>
	);
};

export default DoctorNotification;
