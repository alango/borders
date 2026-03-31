import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ReviewSession } from "./review-session";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { mode } = await searchParams;
  const reviewMode =
    mode === "due" ? "due" : mode === "new" ? "new" : undefined;

  return <ReviewSession mode={reviewMode} />;
}
