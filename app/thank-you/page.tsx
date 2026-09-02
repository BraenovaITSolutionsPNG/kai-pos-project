export default function ThankYouPage() {
  return (
    <section className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-primary/20 mx-auto mb-6 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-10 h-10 text-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M20 6L9 17.5 2 9z" />
            <path d="M22 11.5l-5.5 4.5L15 13l-5-4L2 12l6.5 5L22 11.5z" />
          </svg>
        </div>
        <h1 className="font-heading text-3xl font-semibold mb-4">Thank You</h1>
        <p className="text-muted-foreground mb-6">
          We've received your message. The admin will review it and get back to you soon.
        </p>
      </div>
  </section>
  );
}