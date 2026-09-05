import { useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { renderTwitterEmbeds } from "@/lib/twitterWidgets";
import { formatDate } from "@/lib/date";

export default function Blog() {
	const { state } = useLocation();
	const { id } = useParams();
	const navigate = useNavigate();
	const blog = state?.blog;
	const contentRef = useRef(null);

	useEffect(() => {
		if (contentRef.current) renderTwitterEmbeds(contentRef.current);
	}, [blog]);

	if (!blog) {
		return (
			<main className="bg-background">
				<p className="mx-auto max-w-2xl px-4 py-16 text-center text-muted-foreground">
					No blog data found for ID: {id}. Maybe refresh?
				</p>
			</main>
		);
	}

	const fullHtmlContent = blog.description || "<h2>Error: Content not found.</h2>";
	const displayDate = formatDate(blog.date, "Date unavailable");
	const mainImageUrl = blog.image;

	return (
		<main className="min-h-screen bg-background">
			<div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
				<Button variant="ghost" className="w-fit" onClick={() => navigate(-1)}>
					<ArrowLeft data-icon="inline-start" />
					Back to blogs
				</Button>

				{mainImageUrl ? (
					<img
						src={mainImageUrl}
						alt={blog.title || "Blog header"}
						className="h-56 w-full rounded-lg object-cover sm:h-72"
						onError={(e) => {
							e.currentTarget.onerror = null;
							e.currentTarget.style.display = "none";
						}}
					/>
				) : null}

				<div className="flex flex-col gap-2">
					<h1 className="font-sans text-4xl font-bold text-foreground">{blog.title}</h1>
					{blog.category ? (
						<p className="font-sans text-xl font-medium text-muted-foreground">{blog.category}</p>
					) : null}
					<p className="text-sm text-muted-foreground">
						By {blog.authorName || "Unknown author"} · {displayDate}
					</p>
				</div>

				<div
					ref={contentRef}
					className="jh-blog-content py-4 leading-relaxed text-foreground [&_a]:cursor-pointer [&_a]:text-primary [&_a]:underline [&_a:hover]:no-underline [&_a:visited]:text-primary/70 [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-secondary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-(--jh-ink-strong) [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-(--jh-ink-strong) [&_h3]:mt-5 [&_h3]:mb-2.5 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-(--jh-ink-strong) [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-lg [&_li]:text-foreground [&_li_p]:my-0 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-3 [&_strong]:font-semibold [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-5"
					dangerouslySetInnerHTML={{ __html: fullHtmlContent }}
				/>
			</div>
		</main>
	);
}
