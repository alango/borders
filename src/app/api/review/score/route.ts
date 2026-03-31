import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { userCountries } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { computeNextInterval, computeDueDate } from "@/lib/srs";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  const { userCountryId, correct, intervalOverride } = await request.json();

  if (typeof userCountryId !== "number" || typeof correct !== "boolean") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Get current state
  const [current] = await db
    .select()
    .from(userCountries)
    .where(
      and(
        eq(userCountries.id, userCountryId),
        eq(userCountries.userId, userId)
      )
    )
    .limit(1);

  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();
  const isFirstReview = current.lastReviewed === null;
  const newInterval =
    typeof intervalOverride === "number"
      ? intervalOverride
      : isFirstReview
        ? 1
        : computeNextInterval(current.intervalDays, correct);

  // First review (without override) is due today; subsequent reviews use computed interval
  const dueDateInterval =
    isFirstReview && typeof intervalOverride !== "number" ? 0 : newInterval;
  const newDueDate = computeDueDate(now, dueDateInterval);

  await db
    .update(userCountries)
    .set({
      intervalDays: newInterval,
      lastReviewed: now,
      dueDate: newDueDate.toISOString().split("T")[0],
      reviewCount: current.reviewCount + 1,
      correctCount: correct ? current.correctCount + 1 : current.correctCount,
    })
    .where(eq(userCountries.id, userCountryId));

  return NextResponse.json({ success: true, newInterval, newDueDate });
}
