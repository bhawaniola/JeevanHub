import { useState, useEffect, useContext } from "react";
import axios from "axios";
import { Package, Wallet, User, Bell } from "lucide-react";

import { AuthContext } from "../../context/AuthContext";
import { BACKEND_URL } from "../../config";
import { DashboardShell, DashboardPageHeader } from "@/components/layout/DashboardShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { formatDate } from "@/lib/date";

const relatedIcon = {
	order: Package,
	payment: Wallet,
	account: User,
	system: Bell,
};

const NotificationsPage = () => {
	const [notifications, setNotifications] = useState([]);
	const [loading, setLoading] = useState(true);
	const { auth } = useContext(AuthContext);

	useEffect(() => {
		const fetchNotifications = async () => {
			try {
				setLoading(true);
				const response = await axios.get(`${BACKEND_URL}/api/notifications`, {
					headers: { Authorization: `Bearer ${auth.token}` },
				});

				setNotifications(response.data);
				setLoading(false);
			} catch (error) {
				console.error("Error fetching notifications:", error);
				setLoading(false);
			}
		};

		if (auth?.token) {
			fetchNotifications();
		}
	}, [auth?.token]);

	const markAsRead = async (notificationId) => {
		try {
			await axios.put(
				`${BACKEND_URL}/api/notifications/${notificationId}/read`,
				{},
				{
					headers: { Authorization: `Bearer ${auth.token}` },
				}
			);

			setNotifications((prevNotifs) => prevNotifs.map((notif) => (notif._id === notificationId ? { ...notif, isRead: true } : notif)));
		} catch (error) {
			console.error("Error marking notification as read:", error);
		}
	};

	const markAllAsRead = async () => {
		try {
			await axios.put(
				`${BACKEND_URL}/api/notifications/read-all`,
				{},
				{
					headers: { Authorization: `Bearer ${auth.token}` },
				}
			);

			setNotifications((prevNotifs) => prevNotifs.map((notif) => ({ ...notif, isRead: true })));
		} catch (error) {
			console.error("Error marking all notifications as read:", error);
		}
	};

	const handleNotificationClick = (notification) => {
		if (!notification.isRead) {
			markAsRead(notification._id);
		}

		if (notification.relatedTo === "order" && notification.relatedId) {
			window.location.href = `/retailer/orders/${notification.relatedId}`;
		}
	};

	const formatNotificationTime = (dateString) => {
		const date = new Date(dateString);
		return date.toLocaleDateString("en-GB", {
			day: "numeric",
			month: "long",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const groupNotificationsByDate = (list) => {
		const groups = {};

		list.forEach((notification) => {
			const date = formatDate(notification.createdAt);
			if (!groups[date]) {
				groups[date] = [];
			}
			groups[date].push(notification);
		});

		return groups;
	};

	const groupedNotifications = groupNotificationsByDate(notifications);
	const hasUnread = notifications.some((notif) => !notif.isRead);

	return (
		<DashboardShell>
			<DashboardPageHeader
				title="Notifications"
				actions={
					hasUnread ? (
						<Button onClick={markAllAsRead}>Mark all as read</Button>
					) : null
				}
			/>

			{loading ? (
				<p className="text-center text-muted-foreground">Loading notifications...</p>
			) : notifications.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Bell />
						</EmptyMedia>
						<EmptyTitle>No notifications</EmptyTitle>
						<EmptyDescription>You don't have any notifications yet.</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				Object.entries(groupedNotifications).map(([date, notifs]) => (
					<div key={date} className="mb-8">
						<h3 className="mb-3 border-b border-border pb-2 text-sm text-muted-foreground">{date}</h3>
						<div className="flex flex-col gap-3">
							{notifs.map((notification) => {
								const Icon = relatedIcon[notification.relatedTo] || Bell;
								return (
									<Card
										key={notification._id}
										onClick={() => handleNotificationClick(notification)}
										className={
											notification.isRead
												? "flex cursor-pointer flex-row items-start gap-4 p-4 transition-transform hover:-translate-y-0.5"
												: "flex cursor-pointer flex-row items-start gap-4 border-primary/30 bg-accent p-4 transition-transform hover:-translate-y-0.5"
										}
									>
										<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
											<Icon className="size-5 text-primary" />
										</div>
										<div className="min-w-0 flex-1">
											<h4 className="font-semibold text-foreground">{notification.title}</h4>
											<p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
											<span className="mt-2 block text-xs text-muted-foreground">{formatDate(notification.createdAt)}</span>
										</div>
										{!notification.isRead ? <div className="mt-1 size-2 shrink-0 rounded-full bg-primary" /> : null}
									</Card>
								);
							})}
						</div>
					</div>
				))
			)}
		</DashboardShell>
	);
};

export default NotificationsPage;
