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
	Package,
	Sparkles,
	Utensils,
	Video,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AuthContext } from "../../context/AuthContext";
import { authFetch } from "../../utils/authFetch";
import { BACKEND_URL } from "../../config";

const TYPE_CONFIG = {
	appointment: {
		label: "Appointment",
		icon: Calendar,
		iconColor: "text-blue-600 dark:text-blue-400",
		badgeClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
	},
	diet: {
		label: "Diet Plan",
		icon: Utensils,
		iconColor: "text-[var(--jh-olive-primary)]",
		badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
	},
	yoga: {
		label: "Yoga Routine",
		icon: Sparkles,
		iconColor: "text-[var(--jh-saffron-warm)]",
		badgeClass: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
	},
	order: {
		label: "Order",
		icon: Package,
		iconColor: "text-[var(--jh-turmeric-gold)]",
		badgeClass: "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300",
	},
	payment: {
		label: "Payment",
		icon: AlertCircle,
		iconColor: "text-emerald-600 dark:text-emerald-400",
		badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
	},
	system: {
		label: "Prescription / System",
		icon: FileText,
		iconColor: "text-muted-foreground",
		badgeClass: "bg-muted text-muted-foreground border-border",
	},
	default: {
		label: "Notification",
		icon: Bell,
		iconColor: "text-muted-foreground",
		badgeClass: "bg-muted text-muted-foreground border-border",
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

const Notification = () => {
	const navigate = useNavigate();
	const { auth } = useContext(AuthContext);
	const patientId = auth?.user?.id;

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
	}, [auth, patientId]);

	const markAsRead = async (id, e) => {
		if (e) e.stopPropagation();
		try {
			const response = await authFetch(`${BACKEND_URL}/api/notifications/${id}/read`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
			});

			if (response.ok) {
				setNotifications((prev) => prev.filter((n) => n._id !== id));
			}
		} catch (err) {
			console.error("Error marking notification as read:", err);
		}
	};

	const markAllAsRead = async () => {
		setMarkingAll(true);
		try {
			const response = await authFetch(`${BACKEND_URL}/api/notifications/read-all`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
			});

			if (response.ok) {
				setNotifications([]);
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
			markAsRead(notification._id);
			return;
		}

		if (notification.type === "diet" || notification.type === "yoga" || notification.type === "system") {
			markAsRead(notification._id);
			navigate("/diet-yoga");
			return;
		}

		if (notification.type === "order") {
			markAsRead(notification._id);
			navigate("/my-orders");
			return;
		}

		if (notification.type === "appointment") {
			markAsRead(notification._id);
			navigate("/appointments");
			return;
		}
	};

	const filteredNotifications = useMemo(() => {
		if (activeTab === "all") return notifications;
		if (activeTab === "appointments") return notifications.filter((n) => n.type === "appointment");
		if (activeTab === "diet-yoga") return notifications.filter((n) => n.type === "diet" || n.type === "yoga");
		if (activeTab === "orders") return notifications.filter((n) => n.type === "order" || n.type === "payment");
		if (activeTab === "system") return notifications.filter((n) => n.type === "system");
		return notifications;
	}, [notifications, activeTab]);

	const counts = useMemo(() => {
		return {
			all: notifications.length,
			appointments: notifications.filter((n) => n.type === "appointment").length,
			dietYoga: notifications.filter((n) => n.type === "diet" || n.type === "yoga").length,
			orders: notifications.filter((n) => n.type === "order" || n.type === "payment").length,
			system: notifications.filter((n) => n.type === "system").length,
		};
	}, [notifications]);

	return (
		<main className="min-h-[85vh] bg-background">
			<div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
				{/* Page Header */}
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<div className="flex items-center gap-2.5">
							<h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Your Notifications</h1>
							{notifications.length > 0 && (
								<Badge className="bg-[var(--jh-olive-primary)] text-white hover:bg-[var(--jh-olive-leaf)]">
									{notifications.length} new
								</Badge>
							)}
						</div>
						<p className="mt-1 text-sm text-muted-foreground">
							Stay updated with your daily wellness routine, consultations, and orders.
						</p>
					</div>

					{notifications.length > 0 && (
						<Button
							variant="outline"
							size="sm"
							onClick={markAllAsRead}
							disabled={markingAll}
							className="flex items-center gap-1.5 self-start border-border text-foreground hover:bg-muted sm:self-auto"
						>
							<CheckCheck className="size-4 text-[var(--jh-olive-primary)]" />
							{markingAll ? "Marking..." : "Mark all as read"}
						</Button>
					)}
				</div>

				{/* Filter Tabs */}
				<div className="mt-6 flex flex-wrap gap-1.5 border-b border-border pb-3">
					<button
						type="button"
						onClick={() => setActiveTab("all")}
						className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
							activeTab === "all"
								? "bg-[var(--jh-olive-primary)] text-white shadow-sm"
								: "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
						}`}
					>
						All ({counts.all})
					</button>

					<button
						type="button"
						onClick={() => setActiveTab("appointments")}
						className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
							activeTab === "appointments"
								? "bg-[var(--jh-olive-primary)] text-white shadow-sm"
								: "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
						}`}
					>
						Appointments ({counts.appointments})
					</button>

					<button
						type="button"
						onClick={() => setActiveTab("diet-yoga")}
						className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
							activeTab === "diet-yoga"
								? "bg-[var(--jh-olive-primary)] text-white shadow-sm"
								: "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
						}`}
					>
						Diet & Yoga ({counts.dietYoga})
					</button>

					<button
						type="button"
						onClick={() => setActiveTab("orders")}
						className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
							activeTab === "orders"
								? "bg-[var(--jh-olive-primary)] text-white shadow-sm"
								: "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
						}`}
					>
						Orders ({counts.orders})
					</button>

					<button
						type="button"
						onClick={() => setActiveTab("system")}
						className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
							activeTab === "system"
								? "bg-[var(--jh-olive-primary)] text-white shadow-sm"
								: "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
						}`}
					>
						Prescriptions ({counts.system})
					</button>
				</div>

				{/* Notifications List */}
				<div className="mt-6">
					{loading ? (
						<div className="py-12 text-center text-sm text-muted-foreground">Loading notifications...</div>
					) : error ? (
						<div className="rounded-lg bg-destructive/10 p-4 text-center text-sm text-destructive">{error}</div>
					) : filteredNotifications.length === 0 ? (
						<EmptyState
							icon={Bell}
							title="No new notifications"
							description={
								activeTab === "all"
									? "You're all caught up! New reminders and updates will appear here."
									: `No unread notifications in ${activeTab.replace("-", " & ")}.`
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
										className="group relative flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-[var(--jh-olive-primary)]/40 hover:shadow-md sm:flex-row sm:items-start"
									>
										<div className="flex flex-1 items-start gap-3.5 min-w-0">
											<div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
												<Icon className={`size-5 ${config.iconColor}`} aria-hidden="true" />
											</div>

											<div className="min-w-0 flex-1">
												<div className="flex flex-wrap items-center gap-2">
													<span className={`rounded px-2 py-0.5 text-[11px] font-semibold border ${config.badgeClass}`}>
														{config.label}
													</span>
													<span className="text-xs text-muted-foreground">
														{formatNotificationTime(notification.createdAt)}
													</span>
												</div>

												<p className="mt-1.5 text-sm text-foreground/90 leading-relaxed break-words">
													{cleanMessage}
												</p>

												{/* Action Buttons if relevant */}
												<div className="mt-3 flex flex-wrap items-center gap-2">
													{meetUrl ? (
														<a
															href={meetUrl}
															target="_blank"
															rel="noopener noreferrer"
															onClick={() => markAsRead(notification._id)}
															className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--jh-olive-primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[var(--jh-olive-leaf)]"
														>
															<Video className="size-3.5" />
															Join Video Call
															<ExternalLink className="size-3 opacity-70" />
														</a>
													) : null}

													{(notification.type === "diet" || notification.type === "yoga" || notification.type === "system") && (
														<button
															type="button"
															onClick={() => handleAction(notification)}
															className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted hover:border-[var(--jh-olive-primary)]"
														>
															View Wellness Plan
														</button>
													)}

													{notification.type === "order" && (
														<button
															type="button"
															onClick={() => handleAction(notification)}
															className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted hover:border-[var(--jh-olive-primary)]"
														>
															View Orders
														</button>
													)}
												</div>
											</div>
										</div>

										{/* Mark as read button */}
										<button
											type="button"
											onClick={(e) => markAsRead(notification._id, e)}
											title="Mark as read"
											aria-label="Mark as read"
											className="self-end sm:self-start shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
		</main>
	);
};

export default Notification;
