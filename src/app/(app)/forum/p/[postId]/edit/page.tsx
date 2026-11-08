import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { getForumViewer } from "@/server/forum";
import { editPost } from "@/server/actions/forum";
import { PostForm } from "@/components/forum/PostForm";

export const metadata: Metadata = { title: "Edit question", robots: { index: false } };

export default function EditPostPage({ params }: { params: Promise<{ postId: string }> }) {
  return (
    <div className="mx-auto max-w-[760px] px-4 pb-24 pt-10 font-sans sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Edit question</h1>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <Edit params={params} />
      </Suspense>
    </div>
  );
}

async function Edit({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  await requireUser(`/forum/p/${postId}/edit`);
  const viewer = (await getForumViewer())!;
  const post = await db.forumPost.findUnique({
    where: { id: postId },
    include: { category: { select: { slug: true } }, tags: { select: { tag: { select: { slug: true } } } } },
  });
  if (!post || post.status === "DELETED") notFound();
  const isAuthor = post.authorId === viewer.id;
  if (!isAuthor && !viewer.canEditOthers && !viewer.canEditTags) notFound();
  const categories = await db.forumCategory.findMany({ orderBy: { order: "asc" }, select: { slug: true, name: true } });
  return (
    <div className="mt-6">
      {!isAuthor && !viewer.canEditOthers ? <p className="mb-4 text-sm text-muted">You can edit this question&apos;s tags.</p> : null}
      <PostForm
        action={editPost.bind(null, post.id)}
        categories={categories}
        initial={{ title: post.title, body: post.body, category: post.category.slug, tags: post.tags.map((t) => t.tag.slug).join(", ") }}
        canMarkPriority={false}
        uploadsEnabled={Boolean(process.env.BLOB_READ_WRITE_TOKEN)}
        userId={viewer.id}
        submitLabel="Save changes"
        textLocked={!isAuthor && !viewer.canEditOthers}
      />
    </div>
  );
}
