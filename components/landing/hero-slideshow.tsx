import Image from "next/image";

export function HeroSlideshow() {
  return (
    <>
      <Image
        src="/images/hero-banner.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover animate-hero-slide-1"
      />
      <Image
        src="/images/hero-banner-2.jpg"
        alt=""
        fill
        sizes="100vw"
        className="object-cover animate-hero-slide-2"
      />
      <Image
        src="/images/hero-banner-3.jpg"
        alt=""
        fill
        sizes="100vw"
        className="object-cover animate-hero-slide-3"
      />
    </>
  );
}
