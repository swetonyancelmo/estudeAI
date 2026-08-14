import { AuthGuard } from "@/components/auth/auth-guard";
import { AppNav } from "@/components/app-nav";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <AppNav />
      <div className="flex flex-1 flex-col">{children}</div>
    </AuthGuard>
  );
}
