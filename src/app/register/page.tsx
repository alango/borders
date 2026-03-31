import Link from "next/link";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  async function register(formData: FormData) {
    "use server";

    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    if (!username || !password) {
      redirect("/register?error=missing-fields");
    }

    if (password.length < 8) {
      redirect("/register?error=password-too-short");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    try {
      await db.insert(users).values({ username, passwordHash });
    } catch {
      redirect("/register?error=username-taken");
    }

    redirect("/login?registered=true");
  }

  return <RegisterForm registerAction={register} searchParams={searchParams} />;
}

async function RegisterForm({
  registerAction,
  searchParams,
}: {
  registerAction: (formData: FormData) => Promise<void>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
          <CardDescription>
            Sign up to start learning country borders
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={registerAction} className="space-y-4">
            {error && (
              <p className="text-sm text-destructive">
                {error === "username-taken" && "Username already taken."}
                {error === "missing-fields" && "All fields are required."}
                {error === "password-too-short" &&
                  "Password must be at least 8 characters."}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                required
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full">
              Register
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
