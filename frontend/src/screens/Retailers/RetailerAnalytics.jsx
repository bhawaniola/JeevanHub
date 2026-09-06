import { useEffect, useState, useContext } from "react";
import axios from "axios";

import { AuthContext } from "../../context/AuthContext";
import { BACKEND_URL } from "../../config";
import { DashboardShell, DashboardPageHeader } from "@/components/layout/DashboardShell";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatDate } from "@/lib/date";

function RetailerAnalytics() {
	const { auth } = useContext(AuthContext);
	const [orders, setOrders] = useState([]);
	const [stats, setStats] = useState({ total: 0, revenue: 0 });

	useEffect(() => {
		const fetchRetailerOrders = async () => {
			try {
				const response = await axios.get(`${BACKEND_URL}/api/orders`, {
					params: { retailerId: auth?.user?.id },
					headers: {
						Authorization: `Bearer ${auth.token}`,
					},
				});

				const data = response.data || [];
				const totalOrders = data.length;
				const totalRevenue = data.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
				setStats({ total: totalOrders, revenue: totalRevenue });
				setOrders(data);
			} catch (error) {
				console.error("Failed to fetch analytics:", error);
			}
		};

		if (auth?.user?.id) {
			fetchRetailerOrders();
		}
	}, [auth]);

	return (
		<DashboardShell>
			<DashboardPageHeader title="Retailer Analytics" />

			<div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
				<Card className="p-6 text-center">
					<h3 className="text-sm font-semibold text-muted-foreground">Total Orders</h3>
					<p className="mt-2 text-3xl font-bold text-foreground">{stats.total}</p>
				</Card>
				<Card className="p-6 text-center">
					<h3 className="text-sm font-semibold text-muted-foreground">Total Revenue</h3>
					<p className="mt-2 text-3xl font-bold text-foreground">₹ {stats.revenue.toFixed(2)}</p>
				</Card>
			</div>

			<Card className="overflow-hidden p-0">
				<h3 className="border-b border-border px-6 py-4 text-base font-semibold text-foreground">Recent Orders</h3>
				<div className="overflow-x-auto">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Buyer</TableHead>
								<TableHead>Items</TableHead>
								<TableHead>Amount</TableHead>
								<TableHead>Date</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{orders.slice(0, 10).map((order) => (
								<TableRow key={order._id}>
									<TableCell className="font-medium text-foreground">
										{order.buyer?.firstName} {order.buyer?.lastName}
									</TableCell>
									<TableCell>{order.items?.length}</TableCell>
									<TableCell>₹ {order.totalPrice}</TableCell>
									<TableCell>{formatDate(order.createdAt)}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			</Card>
		</DashboardShell>
	);
}

export default RetailerAnalytics;
