import { useState, FormEvent } from "react";
import { useAuth } from "@/lib/authContext";
import { useBrand } from "@/lib/brandContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const { login } = useAuth();
  const brand = useBrand();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch (e: any) {
      setErr("Sign-in failed. Check your credentials.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-background px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          {brand.logoUrl ? (
            <img src={brand.logoUrl} alt={brand.name} className="h-10 mx-auto" />
          ) : (
            <div
              className="h-12 w-12 rounded-xl mx-auto grid place-items-center text-white font-semibold"
              style={{ background: brand.color }}
            >
              {brand.logoText}
            </div>
          )}
          <h1 className="text-xl font-semibold tracking-tight">{brand.name}</h1>
          <p className="text-sm text-muted-foreground">{brand.tagline}</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="input-email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              data-testid="input-password"
            />
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button
            type="submit"
            className="w-full"
            disabled={busy}
            data-testid="button-login"
          >
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
