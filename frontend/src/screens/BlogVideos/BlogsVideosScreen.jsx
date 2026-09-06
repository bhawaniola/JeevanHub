import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, BookOpen, Play, Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { categoryOptions } from "./categoryOptions";
import { BACKEND_URL } from "@/config";
import { formatDate } from "@/lib/date";

const tabs = [
	{ value: "all", label: "All", icon: null },
	{ value: "blog", label: "Blogs", icon: BookOpen },
	{ value: "video", label: "Videos", icon: Play },
];

function BlogsVideosScreen() {
	const [activeTab, setActiveTab] = useState("all");
	const [category, setCategory] = useState("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [blogs, setBlogs] = useState([]);
	const [loading, setLoading] = useState(true);
	const navigate = useNavigate();

	const scrollToContent = () => {
		document.getElementById("content-section")?.scrollIntoView({ behavior: "smooth" });
	};

	useEffect(() => {
		fetch(`${BACKEND_URL}/api/webhook/getAllBlogs/`)
			.then((res) => res.json())
			.then((data) => {
				if (data.blogs) setBlogs(data.blogs);
				setLoading(false);
			})
			.catch((err) => {
				console.error("Error fetching blogs:", err);
				setLoading(false);
			});
	}, []);

	const filteredData = blogs.filter((item) => {
		const matchesTab =
			activeTab === "all" ||
			(activeTab === "blog" && (item.type === "normal" || item.type === "ai")) ||
			(activeTab === "video" && item.type === "Video");

		const contentText = item.description;
		const itemTags = item.type === "normal" ? (item.category ? [item.category] : []) : item.tags;

		const matchesCategory =
			category === "all" || itemTags?.some((tag) => tag.toLowerCase() === category.toLowerCase());

		const matchesSearch =
			item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
			contentText?.toLowerCase().includes(searchQuery.toLowerCase());

		return matchesTab && matchesCategory && matchesSearch;
	});

	return (
		<main className="bg-background">
			<section className="relative flex min-h-[60vh] items-center justify-center overflow-hidden pt-8 pb-12 text-center">
				<img src="/images/blog_bg.jpg" alt="" className="absolute inset-0 -z-20 size-full object-cover" />
				<div className="absolute inset-0 -z-10 bg-white/20" />
				<div className="relative mx-auto w-full max-w-3xl px-4">
					<h1 className="text-balance text-3xl font-bold text-foreground sm:text-4xl">
						Welcome to Our <br className="hidden sm:block" />
						<span className="text-primary">Ayurveda Guide</span>
					</h1>
					<p className="mt-4 text-pretty text-lg text-foreground/80">
						Explore expert articles and videos on Ayurveda,
						<br className="hidden sm:block" /> wellness, and natural living.
					</p>
					<div className="mt-8 flex flex-wrap justify-center gap-4">
						<Button size="lg" onClick={scrollToContent}>
							<BookOpen data-icon="inline-start" />
							Explore Articles
						</Button>
						<Button size="lg" variant="secondary" onClick={scrollToContent}>
							<Play data-icon="inline-start" />
							Watch Videos
						</Button>
					</div>
				</div>
			</section>

			<section id="content-section" className="mx-auto max-w-6xl px-4 py-6">
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 sm:max-w-xs">
						<Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
						<Input
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search blogs and videos..."
							className="h-auto border-0 p-0 shadow-none focus-visible:ring-0"
						/>
					</div>

					<div className="flex items-center gap-2 sm:min-w-52">
						<Filter className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
						<Select value={category} onValueChange={setCategory} items={categoryOptions}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{categoryOptions.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="flex flex-wrap gap-2">
						{tabs.map((tab) => (
							<Button
								key={tab.value}
								variant={activeTab === tab.value ? "default" : "secondary"}
								onClick={() => setActiveTab(tab.value)}
							>
								{tab.icon ? <tab.icon data-icon="inline-start" /> : null}
								{tab.label}
							</Button>
						))}
					</div>
				</div>
			</section>

			<section className="mx-auto max-w-6xl px-4 pb-16">
				{loading ? (
					<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{Array.from({ length: 6 }).map((_, index) => (
							<Skeleton key={index} className="h-80 rounded-xl" />
						))}
					</div>
				) : filteredData.length > 0 ? (
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
						{filteredData.map((item, index) => {
							const rawHtmlContent = item.description;
							const previewText = rawHtmlContent
								? rawHtmlContent.replace(/<[^>]*>/g, "").slice(0, 90)
								: "No content available...";
							const imageUrl = item.image || "/images/blog_img.jpg";
							const itemTags = item.type === "normal" ? (item.category ? [item.category] : []) : item.tags || [];
							const itemAuthor = item.authorName || (item.user ? item.user.name : "Anonymous");

							return (
								<Card key={item._id || index} className="overflow-hidden py-0">
									<div className="relative h-32 sm:h-36">
										<img
											src={imageUrl}
											alt={item.title}
											className="size-full object-cover"
											onError={(e) => {
												e.currentTarget.onerror = null;
												e.currentTarget.src = "/images/blog_img.jpg";
											}}
										/>
									</div>
									<div className="flex flex-1 flex-col gap-1.5 p-3.5 text-center">
										<p className="text-xs text-muted-foreground">{formatDate(item.date)}</p>
										<h3 className="line-clamp-1 text-sm font-bold text-foreground">{item.title}</h3>
										<p className="line-clamp-2 flex-1 text-xs text-muted-foreground">{previewText}...</p>
										<p className="text-xs font-semibold text-foreground">👤 {itemAuthor}</p>
										<div className="flex flex-wrap justify-center gap-1.5">
											{itemTags.slice(0, 2).map((tag) => (
												<Badge key={tag} variant="secondary" className="text-xs">
													#{tag}
												</Badge>
											))}
										</div>
										<Button
											size="sm"
											className="mt-1 self-center"
											onClick={() => navigate(`/blog/${item._id}`, { state: { blog: item } })}
										>
											Read Article
										</Button>
									</div>
								</Card>
							);
						})}
					</div>
				) : (
					<Empty>
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Search />
							</EmptyMedia>
							<EmptyTitle>No content found</EmptyTitle>
							<EmptyDescription>Try a different search term or category filter.</EmptyDescription>
						</EmptyHeader>
					</Empty>
				)}
			</section>
		</main>
	);
}

export default BlogsVideosScreen;
