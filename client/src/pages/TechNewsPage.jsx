import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import Card from "../components/Card";
import Button from "../components/Button";
import Badge from "../components/Badge";

const categories = ["All", "Web Development", "AI", "Cloud", "Security", "Mobile", "DevOps"];

export default function TechNewsPage() {
  const [category, setCategory] = useState("All");
  const [posts, setPosts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [error, setError] = useState("");

  async function fetchNews(selectedCategory = category) {
    try {
      const params = selectedCategory === "All" ? {} : { category: selectedCategory };
      const [postsResponse, trendingResponse] = await Promise.all([
        api.get("/posts", { params }),
        api.get("/posts/trending"),
      ]);

      setPosts(postsResponse.data.posts || []);
      setTrending(trendingResponse.data.posts || []);
      setError("");
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to load tech news");
    }
  }

  useEffect(() => {
    fetchNews();
  }, []);

  function handleCategoryChange(nextCategory) {
    setCategory(nextCategory);
    fetchNews(nextCategory);
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] fade-in">
      <div className="space-y-4">
        <Card>
          <h1 className="text-2xl font-semibold">Tech News Feed</h1>
          <p className="text-sm text-text/70 mt-1">Sprint 1 category-filtered feed powered by the Sprint 2 discussion backend.</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((item) => (
              <Button
                key={item}
                variant={item === category ? "primary" : "secondary"}
                onClick={() => handleCategoryChange(item)}
              >
                {item}
              </Button>
            ))}
          </div>
        </Card>

        <div className="space-y-3">
          {posts.map((post) => (
            <Link key={post.id} to={`/discussions/${post.id}`} className="block">
              <Card className="transition hover:border-neon/30 hover:-translate-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold">{post.title}</h2>
                  <Badge tone="pink" className="text-xs px-2 py-1">{post.category}</Badge>
                </div>
                <p className="text-sm text-text/80 mt-2 line-clamp-3">{post.content}</p>
                <p className="text-xs text-text/60 mt-2">By {post.author_name}</p>
                <p className="mt-3 text-xs font-medium text-neon">Read full discussion</p>
              </Card>
            </Link>
          ))}
          {posts.length === 0 && <p className="text-sm text-text/60">No posts in this category yet.</p>}
        </div>
      </div>

      <aside className="card h-fit">
        <h2 className="text-lg font-semibold">Trending Discussions</h2>
        <p className="text-sm text-text/70 mt-1">Top discussions by score and engagement.</p>

        <div className="mt-4 space-y-3">
          {trending.map((post) => (
            <Link key={post.id} to={`/discussions/${post.id}`} className="block">
              <Card className="rounded-xl p-3 bg-surface/80 transition hover:border-neon/30 hover:-translate-y-0.5">
                <p className="text-sm font-medium">{post.title}</p>
                <p className="text-xs text-text/60 mt-1">
                  Score: {post.score} | Comments: {post.comment_count}
                </p>
                <p className="mt-2 text-xs font-medium text-neon">Open discussion</p>
              </Card>
            </Link>
          ))}
          {trending.length === 0 && <p className="text-sm text-text/60">No trending data yet.</p>}
        </div>

        {error && <p className="text-sm text-danger mt-3">{error}</p>}
      </aside>
    </section>
  );
}
