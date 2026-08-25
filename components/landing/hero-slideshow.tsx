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
        className="object-cover animate-hero-slide-a"
      />
      <Image
        src="/images/hero-banner-2.jpg"
        alt=""
        fill
        sizes="100vw"
        className="object-cover animate-hero-slide-b"
      />
    </>
  );
}
