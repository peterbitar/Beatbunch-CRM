"use client";

import { useState, useTransition, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { login, signup } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

function AuthError({ message }: { message: string }) {
  return (
    <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  );
}

function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await login(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <AuthError message={error} />}
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password">Password</Label>
          <a
            href="#"
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            Forgot password?
          </a>
        </div>
        <Input
          id="login-password"
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    if (formData.get("password") !== formData.get("confirmPassword")) {
      setError("Passwords do not match.");
      return;
    }
    startTransition(async () => {
      const result = await signup(formData);
      if (result?.error) setError(result.error);
      if (result?.confirmEmail) setConfirmEmail(true);
    });
  }

  if (confirmEmail) {
    return (
      <div className="rounded-md bg-primary/10 border border-primary/20 px-4 py-5 text-sm text-center space-y-1">
        <p className="font-semibold text-base">Check your email</p>
        <p className="text-muted-foreground">
          We sent a confirmation link to your email address. Click it to activate your account, then sign in.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <AuthError message={error} />}
      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">Password</Label>
        <Input
          id="signup-password"
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-confirm">Confirm password</Label>
        <Input
          id="signup-confirm"
          name="confirmPassword"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}

function CallbackErrorBanner() {
  const searchParams = useSearchParams();
  const callbackError = searchParams.get("error");
  if (!callbackError) return null;
  return (
    <div className="mb-4">
      <AuthError message="Authentication failed. Please try again." />
    </div>
  );
}

function LoginPageInner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      {/* Subtle decorative gradient blob */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        aria-hidden
      >
        <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="w-full max-w-md">
        {/* Logo / branding */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-primary text-primary-foreground text-xl font-bold mb-3 shadow-lg">
            B
          </div>
          <h1 className="text-2xl font-bold tracking-tight">BeatBunch CRM</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your school pipeline
          </p>
        </div>

        <CallbackErrorBanner />

        <Card className="shadow-xl border-border/60">
          <Tabs defaultValue="login">
            <CardHeader className="pb-2">
              <TabsList className="w-full">
                <TabsTrigger value="login" className="flex-1">
                  Sign in
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex-1">
                  Create account
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <TabsContent value="login">
              <CardContent className="pt-4">
                <CardTitle className="text-lg mb-1">Welcome back</CardTitle>
                <CardDescription className="mb-4">
                  Sign in to your BeatBunch CRM account.
                </CardDescription>
                <LoginForm />
              </CardContent>
            </TabsContent>

            <TabsContent value="signup">
              <CardContent className="pt-4">
                <CardTitle className="text-lg mb-1">Get started</CardTitle>
                <CardDescription className="mb-4">
                  Create a new account to access your pipeline.
                </CardDescription>
                <SignupForm />
              </CardContent>
            </TabsContent>

            <CardFooter className="flex-col gap-3 pt-0">
              <div className="flex items-center gap-3 w-full">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">or</span>
                <Separator className="flex-1" />
              </div>
              <p className="text-xs text-center text-muted-foreground">
                By continuing, you agree to BeatBunch&apos;s{" "}
                <a href="#" className="underline underline-offset-2 hover:text-primary">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" className="underline underline-offset-2 hover:text-primary">
                  Privacy Policy
                </a>
                .
              </p>
            </CardFooter>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}
