import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users, userCountries } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = Number(session.user.id);

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) redirect("/login");

  const today = new Date().toISOString().split("T")[0];

  // Seed country records on first visit
  const [seedCheck] = await db
    .select({ count: sql<number>`count(*)` })
    .from(userCountries)
    .where(eq(userCountries.userId, userId));

  if (Number(seedCheck?.count ?? 0) === 0) {
    const { COUNTRIES } = await import("@/lib/countries");
    await db.insert(userCountries).values(
      COUNTRIES.map((c) => ({ userId, countryId: c.id }))
    );
  }

  const [stats] = await db
    .select({
      dueCount: sql<number>`count(*) filter (where ${userCountries.dueDate} <= ${today} and ${userCountries.lastReviewed} is not null)`,
      newCount: sql<number>`count(*) filter (where ${userCountries.lastReviewed} is null)`,
    })
    .from(userCountries)
    .where(eq(userCountries.userId, userId));

  const dueCount = Number(stats?.dueCount ?? 0);
  const newCount = Number(stats?.newCount ?? 0);

  const intervalRows = await db
    .select({
      bucket: sql<string>`case
        when ${userCountries.intervalDays} < 2 then '1d'
        when ${userCountries.intervalDays} < 4 then '2d'
        when ${userCountries.intervalDays} < 8 then '4d'
        when ${userCountries.intervalDays} < 16 then '8d'
        when ${userCountries.intervalDays} < 32 then '16d'
        else '32d+'
      end`,
      count: sql<number>`count(*)`,
    })
    .from(userCountries)
    .where(
      sql`${userCountries.userId} = ${userId} and ${userCountries.lastReviewed} is not null`
    )
    .groupBy(
      sql`case
        when ${userCountries.intervalDays} < 2 then '1d'
        when ${userCountries.intervalDays} < 4 then '2d'
        when ${userCountries.intervalDays} < 8 then '4d'
        when ${userCountries.intervalDays} < 16 then '8d'
        when ${userCountries.intervalDays} < 32 then '16d'
        else '32d+'
      end`
    );

  const bucketOrder = ["1d", "2d", "4d", "8d", "16d", "32d+"];
  const rowMap = new Map(
    intervalRows.map((r) => [r.bucket, Number(r.count)])
  );
  const learnedCount = bucketOrder.reduce(
    (sum, b) => sum + (rowMap.get(b) ?? 0),
    0
  );

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Border Countries</CardTitle>
          <CardDescription>Welcome, {user.username}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            {/* Due for review */}
            <div className="flex flex-1 flex-col gap-2">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold">{dueCount}</p>
                <p className="text-xs text-muted-foreground">Due for review</p>
              </div>
              <Button asChild className="w-full" disabled={dueCount === 0}>
                <Link
                  href="/review?mode=due"
                  className={
                    dueCount === 0 ? "pointer-events-none opacity-50" : ""
                  }
                >
                  Review
                </Link>
              </Button>
            </div>

            {/* New to learn */}
            <div className="flex flex-1 flex-col gap-2">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold">{newCount}</p>
                <p className="text-xs text-muted-foreground">New to learn</p>
              </div>
              <Button
                asChild
                variant="secondary"
                className="w-full"
                disabled={newCount === 0}
              >
                <Link
                  href="/review?mode=new"
                  className={
                    newCount === 0 ? "pointer-events-none opacity-50" : ""
                  }
                >
                  Learn New
                </Link>
              </Button>
            </div>
          </div>

          {/* Interval distribution */}
          {learnedCount > 0 && (
            <div>
              <p className="mb-2 text-xs text-muted-foreground">
                Review intervals ({learnedCount} learned)
              </p>
              <div className="space-y-1">
                {bucketOrder.map((bucket) => {
                  const count = rowMap.get(bucket) ?? 0;
                  if (count === 0) return null;
                  const pct = Math.round((count / learnedCount) * 100);
                  return (
                    <div key={bucket} className="flex items-center gap-2 text-xs">
                      <span className="w-8 text-muted-foreground text-right">
                        {bucket}
                      </span>
                      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-6 text-muted-foreground">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button variant="outline" type="submit" className="w-full">
              Log out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
