import ContactForm from "@/components/landing/contact-form";

export default function ContactPage() {
  return (
    <section className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-md mx-auto">
        <h1 className="font-heading text-3xl font-semibold mb-6">Contact Us</h1>
        <ContactForm />
      </div>
    </section>
  );
}