import Link from "next/link";
import { notFound } from "next/navigation";
import { POSTS } from "../posts";

const CATEGORY_COLOR: Record<string, string> = {
  PRODUCT: "#C4664A",
  TRAVEL: "#0284c7",
  TIPS: "#d97706",
  FAMILY: "#15803d",
};

function renderContent(content: string) {
  const blocks = content.split("\n\n");
  return blocks.map((block, i) => {
    if (block.startsWith("## ")) {
      return (
        <h2
          key={i}
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "22px",
            fontWeight: 600,
            color: "#1B3A5C",
            margin: "40px 0 16px",
            lineHeight: 1.3,
          }}
        >
          {block.replace(/^## /, "")}
        </h2>
      );
    }
    return (
      <p
        key={i}
        style={{
          fontSize: "17px",
          color: "#333",
          lineHeight: 1.8,
          margin: "0 0 24px",
        }}
      >
        {block.trim()}
      </p>
    );
  });
}

export async function generateStaticParams() {
  return POSTS.map((post) => ({ slug: post.slug }));
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = POSTS.find((p) => p.slug === params.slug);
  if (!post) notFound();

  const categoryColor = CATEGORY_COLOR[post.category] ?? "#717171";

  return (
    <div>
      {/* Nav bar */}
      <div style={{ backgroundColor: "#fff", borderBottom: "1px solid #EEEEEE", padding: "16px 24px" }}>
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>
          <Link
            href="/blog"
            style={{ fontSize: "14px", color: "#C4664A", textDecoration: "none", fontWeight: 500 }}
          >
            &larr; Back to blog
          </Link>
        </div>
      </div>

      {/* Hero image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={post.heroImage}
        alt={post.title}
        style={{ width: "100%", maxHeight: "400px", objectFit: "cover", display: "block" }}
      />

      {/* Article */}
      <article style={{ backgroundColor: "#fff", padding: "64px 24px 96px" }}>
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>
          {/* Category badge */}
          <div style={{ marginBottom: "20px" }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase" as const,
                letterSpacing: "0.1em",
                color: categoryColor,
                backgroundColor: `${categoryColor}14`,
                padding: "4px 12px",
                borderRadius: "999px",
              }}
            >
              {post.category}
            </span>
          </div>

          {/* Title */}
          <h1
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "clamp(28px, 4vw, 40px)",
              fontWeight: 600,
              color: "#1B3A5C",
              margin: "0 0 24px",
              lineHeight: 1.2,
            }}
          >
            {post.title}
          </h1>

          {/* Meta */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "center",
              marginBottom: "48px",
              paddingBottom: "32px",
              borderBottom: "1px solid #EEEEEE",
            }}
          >
            <span style={{ fontSize: "14px", color: "#999" }}>Matt Greene</span>
            <span style={{ fontSize: "14px", color: "#ccc" }}>&bull;</span>
            <span style={{ fontSize: "14px", color: "#999" }}>{post.date}</span>
            <span style={{ fontSize: "14px", color: "#ccc" }}>&bull;</span>
            <span style={{ fontSize: "14px", color: "#999" }}>{post.readTime}</span>
          </div>

          {/* Body */}
          <div>{renderContent(post.content)}</div>

          {/* Footer CTA */}
          <div
            style={{
              marginTop: "64px",
              paddingTop: "40px",
              borderTop: "1px solid #EEEEEE",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: "16px", color: "#717171", marginBottom: "20px" }}>
              Ready to plan your next family trip?
            </p>
            <Link
              href="/sign-up"
              style={{
                display: "inline-block",
                backgroundColor: "#C4664A",
                color: "#fff",
                padding: "12px 28px",
                borderRadius: "999px",
                fontSize: "15px",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Start for free &rarr;
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}
