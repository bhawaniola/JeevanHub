import { useMemo, useState, useEffect, useContext } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
	AlertCircle,
	CheckCircle2,
	ChevronRight,
	Clock,
	CreditCard,
	ListChecks,
	Loader2,
	Package,
	PackageSearch,
	Search,
	ShoppingBag,
	Star,
	Truck,
	XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/date";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuthContext } from "../../context/AuthContext";
import { BACKEND_URL } from "../../config";

const API_BASE_URL = `${BACKEND_URL}`;
const FALLBACK_IMAGE =
	"https://images.unsplash.com/photo-1638310526160-ce17611bffff?q=80&w=627&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

const STATUS_META = {
	pending: { label: "Pending", variant: "warning", icon: Clock },
	shipped: { label: "Shipped", variant: "default", icon: Truck },
	delivered: { label: "Completed", variant: "success", icon: CheckCircle2 },
	cancelled: { label: "Cancelled", variant: "destructive", icon: XCircle },
};

// Mockup groups statuses into 4 tabs; "shipped" rolls into Pending since it
// isn't done yet, and "delivered" is displayed as Completed.
const TABS = [
	{ id: "all", label: "All Orders", icon: ListChecks, match: () => true },
	{ id: "pending", label: "Pending", icon: Clock, match: (s) => s === "pending" || s === "shipped" },
	{ id: "completed", label: "Completed", icon: CheckCircle2, match: (s) => s === "delivered" },
	{ id: "cancelled", label: "Cancelled", icon: XCircle, match: (s) => s === "cancelled" },
];

const OrderHistory = () => {
	const [orders, setOrders] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [activeTab, setActiveTab] = useState("all");
	const [searchTerm, setSearchTerm] = useState("");
	const { auth } = useContext(AuthContext);
	const userId = auth?.user?.id;
	const navigate = useNavigate();
	const [reportingId, setReportingId] = useState(null);

	// Fairness/escrow: the retailer's payout for a paid order is held for a
	// window after delivery — this is the patient's chance to flag "paid but
	// never received it" before that hold auto-releases.
	const handleReportIssue = async (order) => {
		const reason = window.prompt("What went wrong with this order? (e.g. never received the medicines)");
		if (!reason || !reason.trim()) return;
		setReportingId(order._id);
		try {
			await axios.post(
				`${API_BASE_URL}/api/orders/${order._id}/dispute`,
				{ reason },
				{ headers: { Authorization: `Bearer ${auth.token}` } }
			);
			alert("Thanks — we've flagged this and will review it before any payout goes out.");
		} catch (err) {
			alert(err.response?.data?.message || "Could not report this issue. Please try again.");
		} finally {
			setReportingId(null);
		}
	};

	useEffect(() => {
		const fetchOrders = async () => {
			try {
				setLoading(true);
				const response = await axios.get(`${API_BASE_URL}/api/orders/getOrdersByBuyerId/${userId}`, {
					headers: { Authorization: `Bearer ${auth.token}` },
				});
				setOrders(response.data.orders || []);
				setLoading(false);
			} catch (error) {
				if (error.response?.status === 404) {
					// No orders yet -- not a failure, just an empty list.
					setOrders([]);
				} else {
					console.error("Error fetching orders:", error);
					setError("Failed to load your orders. Please try again later.");
				}
				setLoading(false);
			}
		};

		if (userId) fetchOrders();
	}, [userId, auth.token]);

	const getImageUrl = (imagePath) => {
		if (!imagePath) return FALLBACK_IMAGE;
		if (imagePath.startsWith("http")) return imagePath;
		if (imagePath.startsWith("/")) return `${API_BASE_URL}${imagePath}`;
		return `${API_BASE_URL}/${imagePath}`;
	};

	const tabCounts = useMemo(() => {
		const counts = {};
		TABS.forEach((tab) => {
			counts[tab.id] = orders.filter((o) => tab.match(o.orderStatus?.toLowerCase())).length;
		});
		return counts;
	}, [orders]);

	const visibleOrders = useMemo(() => {
		const activeTabDef = TABS.find((t) => t.id === activeTab) || TABS[0];
		const term = searchTerm.trim().toLowerCase();
		return orders.filter((order) => {
			if (!activeTabDef.match(order.orderStatus?.toLowerCase())) return false;
			if (!term) return true;
			const idMatch = order._id.slice(-6).toLowerCase().includes(term);
			const itemMatch = order.items.some((item) => item.medicineId?.name?.toLowerCase().includes(term));
			return idMatch || itemMatch;
		});
	}, [orders, activeTab, searchTerm]);

	return (
		<main className="bg-background">
			<div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<span className="flex size-12 shrink-0 items-center justify-center rounded-(--jh-radius-md) bg-(--jh-turmeric-gold)/20 text-(--jh-bark-brown)">
							<ShoppingBag className="size-6" aria-hidden="true" />
						</span>
						<div>
							<h1 className="font-display text-3xl text-foreground sm:text-4xl">Your Orders</h1>
							{!loading && !error ? (
								<p className="mt-0.5 text-sm text-muted-foreground">
									{orders.length} order{orders.length === 1 ? "" : "s"} placed
								</p>
							) : null}
						</div>
					</div>

					{!loading && !error && orders.length > 0 ? (
						<div className="relative w-full max-w-xs">
							<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								type="search"
								placeholder="Search orders..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="pl-9"
							/>
						</div>
					) : null}
				</div>

				{!loading && !error && orders.length > 0 ? (
					<Card className="mt-6 p-2">
						<Tabs value={activeTab} onValueChange={setActiveTab}>
							<TabsList variant="line" className="w-full justify-start gap-1 p-1">
								{TABS.map((tab) => (
									<TabsTrigger key={tab.id} value={tab.id} className="gap-1.5 px-3 py-1.5">
										<tab.icon className="size-4" aria-hidden="true" />
										{tab.label}
										<Badge variant="secondary" className="ml-1">
											{tabCounts[tab.id] ?? 0}
										</Badge>
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>
					</Card>
				) : null}

				{loading ? (
					<div className="mt-10 flex flex-col items-center gap-3 py-16 text-muted-foreground">
						<Loader2 className="size-8 animate-spin" />
						<p>Loading your orders...</p>
					</div>
				) : error ? (
					<div className="mt-10 flex flex-col items-center gap-3 py-16 text-destructive">
						<AlertCircle className="size-8" />
						<p>{error}</p>
					</div>
				) : orders.length === 0 ? (
					<div className="mt-10">
						<EmptyState
							icon={PackageSearch}
							title="No orders yet"
							description="Medicines you order will show up here so you can track them from purchase to delivery."
							action={<Button onClick={() => navigate("/medicines")}>Shop now</Button>}
						/>
					</div>
				) : visibleOrders.length === 0 ? (
					<div className="mt-10">
						<EmptyState
							icon={PackageSearch}
							title="No matching orders"
							description="Try a different search term or switch tabs."
						/>
					</div>
				) : (
					<div className="mt-6 flex flex-col gap-5">
						{visibleOrders.map((order) => {
							const statusKey = order.orderStatus?.toLowerCase();
							const statusMeta = STATUS_META[statusKey] || { label: order.orderStatus, variant: "secondary", icon: Package };
							const StatusIcon = statusMeta.icon;
							const canViewDetail = statusKey === "shipped" || statusKey === "delivered";

							return (
								<Card key={order._id}>
									<CardContent className="flex flex-col gap-4">
										<div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
											<div className="flex items-start gap-3">
												<span className="flex size-10 shrink-0 items-center justify-center rounded-(--jh-radius-md) bg-(--jh-turmeric-gold)/20 text-(--jh-bark-brown)">
													<Package className="size-5" aria-hidden="true" />
												</span>
												<div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
													<div>
														<p className="text-xs text-muted-foreground">Order placed</p>
														<p className="font-medium text-foreground">{formatDate(order.createdAt)}</p>
													</div>
													<div>
														<p className="text-xs text-muted-foreground">Total</p>
														<p className="font-medium text-foreground">₹{(Number(order.totalPrice) || 0).toFixed(2)}</p>
													</div>
													<div>
														<p className="text-xs text-muted-foreground">Order #</p>
														<p className="font-medium text-foreground">{order._id.slice(-6)}</p>
													</div>
												</div>
											</div>
											<Badge variant={statusMeta.variant} className="gap-1">
												<StatusIcon className="size-3.5" aria-hidden="true" />
												{statusMeta.label}
											</Badge>
										</div>

										{order.retailers?.length > 0 ? (
											<p className="text-sm text-muted-foreground">Sold by {order.retailers.join(", ")}</p>
										) : null}

										<ul className="flex flex-col gap-3">
											{order.items.map((item, index) => {
												const medicineImage = item.medicineId?.images?.[0];
												return (
													<li key={index} className="flex items-center gap-3">
														<img
															src={medicineImage ? getImageUrl(medicineImage) : FALLBACK_IMAGE}
															alt={item.medicineId?.name}
															onError={(e) => {
																e.target.onerror = null;
																e.target.src = FALLBACK_IMAGE;
															}}
															className="size-14 shrink-0 rounded-(--jh-radius-md) object-cover"
														/>
														<div className="min-w-0 flex-1">
															<p className="truncate text-sm font-medium text-foreground">{item.medicineId?.name}</p>
															<p className="text-xs text-muted-foreground">
																₹{(Number(item.medicineId?.price) || 0).toFixed(2)} × {item.quantity}
															</p>
														</div>
														<p className="shrink-0 text-sm font-semibold text-foreground">
															₹{(Number(item.subTotal) || 0).toFixed(2)}
														</p>
													</li>
												);
											})}
										</ul>

										{statusKey === "delivered" && order.review ? (
											<div className="rounded-(--jh-radius-md) bg-secondary/60 p-3">
												<h4 className="text-xs font-semibold text-muted-foreground">Your feedback</h4>
												<div className="mt-1 flex gap-0.5">
													{[1, 2, 3, 4, 5].map((i) => (
														<Star
															key={i}
															size={16}
															className={
																i <= order.review.rating
																	? "fill-(--jh-turmeric-gold) text-(--jh-turmeric-gold)"
																	: "text-border"
															}
														/>
													))}
												</div>
												{order.review.comment ? <p className="mt-1 text-sm text-foreground">{order.review.comment}</p> : null}
												{order.review.deliveredAt ? (
													<p className="mt-1 text-xs text-muted-foreground">
														Delivered on {formatDate(order.review.deliveredAt)}
													</p>
												) : null}
											</div>
										) : null}

										<div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
											<div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
												<span className="flex items-center gap-1.5">
													<Truck className="size-3.5" aria-hidden="true" />
													Payment method: {order.paymentMethod === "cashOnDelivery" ? "Cash on delivery" : "Online payment"}
												</span>
												<span className="flex items-center gap-1.5">
													<CreditCard className="size-3.5" aria-hidden="true" />
													Payment status: {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
												</span>
											</div>

											<div className="flex items-center gap-2">
												{order.payoutStatus === "held" ? (
													<Button
														size="sm"
														variant="ghost"
														title="Flag a problem with this order before payout to the retailer is released"
														onClick={() => handleReportIssue(order)}
														disabled={reportingId === order._id}
													>
														{reportingId === order._id ? "Reporting…" : "Report an Issue"}
													</Button>
												) : null}

												{canViewDetail ? (
													<Button
														size="sm"
														className="gap-1.5 bg-(--jh-bark-brown) text-primary-foreground hover:bg-(--jh-bark-brown)/90"
														onClick={() => navigate(`/BuyerFeedback/${order._id}`)}
													>
														<Package className="size-4" aria-hidden="true" />
														{statusKey === "shipped" ? "Update order status" : "View order"}
														<ChevronRight className="size-4" aria-hidden="true" />
													</Button>
												) : null}
											</div>
										</div>
									</CardContent>
								</Card>
							);
						})}
					</div>
				)}
			</div>
		</main>
	);
};

export default OrderHistory;
