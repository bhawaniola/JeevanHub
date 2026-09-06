import { useState, useEffect, useContext } from "react";
import axios from "axios";
import { Bell } from "lucide-react";

import { AuthContext } from "../../context/AuthContext";
import { BACKEND_URL } from "../../config";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { formatDate } from "@/lib/date";

const NotificationBell = () => {
	const [notifications, setNotifications] = useState([]);
	const [unreadCount, setUnreadCount] = useState(0);
	const [isOpen, setIsOpen] = useState(false);
	const { auth } = useContext(AuthContext);

	const fetchNotifications = async () => {
		try {
			const response = await axios.get(`${BACKEND_URL}/api/notifications`, {
				headers: { Authorization: `Bearer ${auth.token}` },
			});

			setNotifications(response.data);
			setUnreadCount(response.data.filter((notif) => !notif.isRead).length);
		} catch (error) {
			console.error("Error fetching notifications:", error);
		}
	};

	useEffect(() => {
		if (auth?.token) {
			fetchNotifications();

			const interval = setInterval(fetchNotifications, 30000);
			return () => clearInterval(interval);
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
			setUnreadCount((prev) => Math.max(0, prev - 1));
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
			setUnreadCount(0);
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

		setIsOpen(false);
	};

	const formatNotificationTime = (dateString) => {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now - date;
		const diffMins = Math.floor(diffMs / 60000);

		if (diffMins < 1) return "Just now";
		if (diffMins < 60) return `${diffMins} min ago`;

		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return `${diffHours} hr ago`;

		const diffDays = Math.floor(diffHours / 24);
		if (diffDays < 7) return `${diffDays} day ago`;

		return formatDate(date);
	};

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger
				render={
					<button className="relative flex size-9 items-center justify-center rounded-full hover:bg-muted">
						<Bell className="size-5" />
						{unreadCount > 0 ? (
							<Badge
								variant="destructive"
								className="absolute -top-0.5 -right-0.5 flex size-4.5 items-center justify-center rounded-full p-0 text-[11px]"
							>
								{unreadCount}
							</Badge>
						) : null}
					</button>
				}
			/>

			<PopoverContent align="end" className="w-80 p-0">
				<div className="flex items-center justify-between border-b border-border px-4 py-3">
					<h3 className="text-sm font-semibold text-foreground">Notifications</h3>
					{unreadCount > 0 ? (
						<Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={markAllAsRead}>
							Mark all as read
						</Button>
					) : null}
				</div>

				<div className="max-h-[350px] overflow-y-auto">
					{notifications.length === 0 ? (
						<div className="p-4 text-center text-sm text-muted-foreground">No notifications yet</div>
					) : (
						notifications.map((notification) => (
							<div
								key={notification._id}
								onClick={() => handleNotificationClick(notification)}
								className={
									notification.isRead
										? "flex cursor-pointer items-start gap-2 border-b border-border px-4 py-3 hover:bg-muted/60"
										: "flex cursor-pointer items-start gap-2 border-b border-border bg-accent px-4 py-3 hover:bg-accent/70"
								}
							>
								<div className="min-w-0 flex-1">
									<h4 className="text-sm font-semibold text-foreground">{notification.title}</h4>
									<p className="mt-0.5 text-xs text-muted-foreground">{notification.message}</p>
									<span className="mt-1.5 block text-[11px] text-muted-foreground">
										{formatNotificationTime(notification.createdAt)}
									</span>
								</div>
								{!notification.isRead ? <div className="mt-1 size-2 shrink-0 rounded-full bg-primary" /> : null}
							</div>
						))
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
};

export default NotificationBell;
