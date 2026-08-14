import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-4 sm:px-10">
        <Wordmark href="/" />
        <ThemeToggle className="-mr-1" />
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-7 p-6 pb-20">
        {children}
      </div>
    </div>
  );
}
