import Image from "next/image";
import { ServiceIcon } from "@/components/AppIcon";

export default function BusinessVisual({
  name,
  slug,
  logoUrl,
  className = "h-16 w-16",
}: {
  name: string;
  slug: string;
  logoUrl?: string | null;
  className?: string;
}) {
  return (
    <div className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-50 via-white to-indigo-100 text-blue-700 shadow-sm ${className}`}>
      {logoUrl ? (
        <Image src={logoUrl} alt={`${name} logo`} width={96} height={96} unoptimized className="h-full w-full object-cover" />
      ) : (
        <ServiceIcon slug={slug} size={28} />
      )}
    </div>
  );
}
