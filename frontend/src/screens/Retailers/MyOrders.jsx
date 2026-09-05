import { useState, useEffect, useContext } from "react";
import axios from "axios";

import { AuthContext } from "../../context/AuthContext";
import { BACKEND_URL } from "../../config";
import { DashboardShell, DashboardPageHeader } from "@/components/layout/DashboardShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatDate } from "@/lib/date";

const STATUS_TABS = [
	{ value: "pending", label: "Received" },
	{ value: "accepted", label: "Accepted" },
	{ value: "delivered", label: "Delivered" },
	{ value: "shipped", label: "Shipped" },
	{ value: "rejected", label: "Rejected" },
];

function MyOrders() {
	const [orders, setOrders] = useState([]);
	const [status, setStatus] = useState("pending");
	const { auth } = useContext(AuthContext);
	const retailerId = auth?.user?.id;

	useEffect(() => {
		const fetchOrders = async () => {
			try {
				const response = await axios.get(`${BACKEND_URL}/api/orders/getOrdersByRetailerId/${retailerId}`, {
					headers: { Authorization: `Bearer ${auth.token}` },
				});

				setOrders(response.data.orders || []);
			} catch (error) {
				console.error("Error fetching orders:", error);
			}
		};

		if (retailerId) fetchOrders();
	}, [retailerId, auth.token]);

	const updateOrderStatus = async (orderId, newStatus) => {
		try {
			await axios.put(
				`${BACKEND_URL}/api/orders/status`,
				{
					orderId,
					status: newStatus,
				},
				{
					headers: { Authorization: `Bearer ${auth.token}` },
				}
			);
			setOrders((prevOrders) => prevOrders.map((order) => (order._id === orderId ? { ...order, status: newStatus } : order)));
		} catch (error) {
			console.error("Error updating order status:", error);
		}
	};

	const filteredOrders = orders.filter((order) => order.status === status);

	return (
		<DashboardShell>
			<DashboardPageHeader title="My Orders" />

			<Tabs value={status} onValueChange={setStatus}>
				<TabsList className="mb-6 h-auto flex-wrap">
					{STATUS_TABS.map((tab) => (
						<TabsTrigger key={tab.value} value={tab.value}>
							{tab.label}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>

			{filteredOrders.length === 0 ? (
				<p className="mt-10 text-center text-lg text-muted-foreground">
					No orders found in the <strong className="text-foreground">{status}</strong> category.
				</p>
			) : (
				<div className="flex flex-col gap-6">
					{filteredOrders.map((order) => (
						<Card key={order._id} className="p-6 transition-transform hover:-translate-y-1">
							<p className="mb-2">
								<strong className="text-foreground">Buyer Name:</strong> {order.customerName}
							</p>
							<p className="mb-2">
								<strong className="text-foreground">Order Receiving Date:</strong> {formatDate(order.date)}
							</p>
							<p className="mb-2">
								<strong className="text-foreground">Shipping Address:</strong>{" "}
								{order.shippingAddress
									? `${order.shippingAddress.street}, ${order.shippingAddress.city}, ${order.shippingAddress.state}, ${order.shippingAddress.postalCode}, ${order.shippingAddress.country}`
									: "N/A"}
							</p>
							<p className="mb-2">
								<strong className="text-foreground">Items:</strong>
							</p>

							<div className="mb-3 overflow-x-auto rounded-lg border border-border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Medicine</TableHead>
											<TableHead>Unit Price</TableHead>
											<TableHead>Quantity</TableHead>
											<TableHead>Subtotal</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{order.items.map((item, idx) => (
											<TableRow key={idx}>
												<TableCell>{item.medicineName}</TableCell>
												<TableCell>{item.unitPrice}</TableCell>
												<TableCell>{item.quantity}</TableCell>
												<TableCell>{item.subTotal}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>

							<p className="mb-2">
								<strong className="text-foreground">Order Total:</strong> {order.orderTotal}
							</p>
							<p>
								<strong className="text-foreground">Status:</strong> {order.status}
							</p>

							{(status === "pending" || status === "accepted") && (
								<div className="mt-5 flex items-center gap-3">
									<span className="text-sm text-muted-foreground">Update Status:</span>
									{status === "pending" ? (
										<>
											<Button size="sm" onClick={() => updateOrderStatus(order._id, "accepted")}>
												Accept
											</Button>
											<Button size="sm" variant="destructive" onClick={() => updateOrderStatus(order._id, "rejected")}>
												Reject
											</Button>
										</>
									) : null}
									{status === "accepted" ? (
										<Button size="sm" onClick={() => updateOrderStatus(order._id, "shipped")}>
											Shipped
										</Button>
									) : null}
								</div>
							)}
						</Card>
					))}
				</div>
			)}
		</DashboardShell>
	);
}

export default MyOrders;
