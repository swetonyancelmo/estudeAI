import { AuthGuard } from "@/components/auth/auth-guard";
import { AppNav } from "@/components/app-nav";
import { Toaster } from "@/components/ui/sonner";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <AppNav />
      <div className="flex flex-1 flex-col">{children}</div>
      <Toaster />
    </AuthGuard>
  );
}
