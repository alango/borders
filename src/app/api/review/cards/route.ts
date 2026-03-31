import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { userCountries } from "@/db/schema";
import { eq, and, or, lte, isNull, isNotNull, asc, sql } from "drizzle-orm";
import { COUNTRIES, COUNTRY_MAP } from "@/lib/countries";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(session.user.id);
  const today = new Date().toISOString().split("T")[0];
  const mode = request.nextUrl.searchParams.get("mode"); // "due" | "new" | null

  // Ensure user has country records (lazy seed on first access)
  const existing = await db
    .select({ countryId: userCountries.countryId })
    .from(userCountries)
    .where(eq(userCountries.userId, userId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(userCountries).values(
      COUNTRIES.map((c) => ({ userId, countryId: c.id }))
    );
  }

  let rows;
  if (mode === "due") {
    rows = await db
      .select()
      .from(userCountries)
      .where(
        and(
          eq(userCountries.userId, userId),
          isNotNull(userCountries.lastReviewed),
          lte(userCountries.dueDate, today)
        )
      )
      .orderBy(asc(userCountries.dueDate));
  } else if (mode === "new") {
    rows = await db
      .select()
      .from(userCountries)
      .where(
        and(
          eq(userCountries.userId, userId),
          isNull(userCountries.lastReviewed)
        )
      )
      .orderBy(sql`random()`)
      .limit(20);
  } else {
    // All: due first, then new
    const due = await db
      .select()
      .from(userCountries)
      .where(
        and(
          eq(userCountries.userId, userId),
          isNotNull(userCountries.lastReviewed),
          lte(userCountries.dueDate, today)
        )
      )
      .orderBy(asc(userCountries.dueDate));

    const newCards = await db
      .select()
      .from(userCountries)
      .where(
        and(
          eq(userCountries.userId, userId),
          isNull(userCountries.lastReviewed)
        )
      )
      .orderBy(sql`random()`)
      .limit(20);

    rows = [...due, ...newCards];
  }

  // Enrich with static country data
  const cards = rows
    .map((row) => {
      const country = COUNTRY_MAP.get(row.countryId);
      if (!country) return null;
      return {
        userCountryId: row.id,
        countryId: row.countryId,
        countryName: country.name,
        borderCount: country.borders.length,
        borders: country.borders,
        numericId: country.numericId,
        borderNumericIds: country.borders.map(
          (b) => COUNTRY_MAP.get(b)?.numericId ?? ""
        ),
        intervalDays: row.intervalDays,
        reviewCount: row.reviewCount,
        correctCount: row.correctCount,
        dueDate: row.dueDate,
        lastReviewed: row.lastReviewed,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ cards });
}
