import Image from "next/image";

export function BrandWordmark({
  className = "h-12 w-auto",
}: { className?: string }) {
  return (
    <Image
      src="/brand/logo.svg"
      alt="Yide Digital"
      width={240}
      height={120}
      className={className}
      priority
    />
  );
}
