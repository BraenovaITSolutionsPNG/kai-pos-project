import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ThankYouPage() {
  return (
    <section className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto mb-6 flex items-center justify-center text-primary">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="font-heading text-3xl font-semibold mb-4">Thank You</h1>
        <p className="text-muted-foreground mb-6">
          We&apos;ve received your message. Our team will review it and get back to you soon.
        </p>
        <Link
          href="/"
          className={cn(buttonVariants({ size: "default" }))}
        >
          Return to Home
          <ArrowRight className="ml-2 size-4" />
        </Link>
      </div>
    </section>
  );
}