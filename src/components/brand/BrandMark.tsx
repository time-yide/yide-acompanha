import Image from "next/image";

export function BrandMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <Image
      src="/brand/mark.svg"
      alt="Yide Digital"
      width={32}
      height={32}
      className={className}
      priority
    />
  );
}
