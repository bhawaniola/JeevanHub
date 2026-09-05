import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Plus, Pencil, Trash2 } from "lucide-react";

import { AuthContext } from "../../context/AuthContext";
import { BACKEND_URL } from "../../config";
import { DashboardShell, DashboardPageHeader } from "@/components/layout/DashboardShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useConfirm } from "@/context/PromptDialogContext";
import { formatDate } from "@/lib/date";

function HealthBlogs() {
	const { auth } = useContext(AuthContext);
	const doctorId = auth.user ? auth.user.id : null;
	const navigate = useNavigate();
	const confirm = useConfirm();

	const [blogs, setBlogs] = useState([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState(null);

	useEffect(() => {
		if (doctorId) {
			const fetchBlogs = async () => {
				setIsLoading(true);
				try {
					const response = await axios.get(`${BACKEND_URL}/api/blogs/author/doctor/${doctorId}`);
					setBlogs(response.data);
					setError(null);
				} catch (error) {
					console.error("Error fetching blogs:", error);
					setError("Failed to fetch your blogs. Please try again.");
				} finally {
					setIsLoading(false);
				}
			};
			fetchBlogs();
		}
	}, [doctorId]);

	const handleDelete = async (blog) => {
		const confirmed = await confirm({
			title: "Delete this blog?",
			description: `"${blog.title}" will be permanently removed.`,
			danger: true,
		});
		if (!confirmed) return;

		try {
			const token = localStorage.getItem("token");
			await axios.delete(`${BACKEND_URL}/api/blogs/${blog._id}`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			setBlogs((prev) => prev.filter((b) => b._id !== blog._id));
		} catch (err) {
			console.error("Error deleting blog:", err);
			setError("Failed to delete blog. Please try again.");
		}
	};

	return (
		<DashboardShell>
			<DashboardPageHeader
				title="My Health Blogs"
				actions={
					<Button onClick={() => navigate("/health-blogs/new")}>
						<Plus data-icon="inline-start" />
						Blog
					</Button>
				}
			/>

			{error ? (
				<Alert variant="destructive" className="mb-6">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}

			{isLoading ? <p className="text-center text-muted-foreground">Loading your blogs...</p> : null}
			{!isLoading && blogs.length === 0 ? (
				<p className="text-center text-muted-foreground">You haven't published any blogs yet.</p>
			) : null}

			<div className="flex flex-col gap-3">
				{blogs.map((blog, index) => {
					const previewText = blog.description
						? blog.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200)
						: "";
					const wasEdited = blog.updatedAt && blog.createdAt && blog.updatedAt !== blog.createdAt;
					return (
						<Card key={blog._id || index} className="p-4">
							<div className="flex flex-col gap-1">
								<div className="flex flex-wrap items-center gap-2">
									<h2 className="text-base font-semibold text-foreground">{blog.title}</h2>
									{blog.category ? <Badge variant="secondary">{blog.category}</Badge> : null}
									<span className="ml-auto text-xs text-muted-foreground">
										{wasEdited
											? `Updated ${formatDate(blog.updatedAt)}`
											: formatDate(blog.date)}
									</span>
									<Button variant="ghost" size="icon" onClick={() => navigate(`/health-blogs/edit/${blog._id}`)}>
										<Pencil className="size-4" />
									</Button>
									<Button variant="ghost" size="icon" onClick={() => handleDelete(blog)}>
										<Trash2 className="size-4 text-destructive" />
									</Button>
								</div>
								<p className="line-clamp-2 text-sm text-muted-foreground sm:line-clamp-3">{previewText}...</p>
							</div>
						</Card>
					);
				})}
			</div>
		</DashboardShell>
	);
}

export default HealthBlogs;
