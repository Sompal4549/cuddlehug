import Link from "next/link";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:py-16">
      <div className="relative hidden overflow-hidden rounded-xl border border-border lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/21_login_teddy.jpg" alt="A CuddleHug teddy waiting for a hug" className="h-full w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/85 to-transparent p-8">
          <p className="text-lg font-semibold text-white">More Happiness. More Hugs.</p>
          <p className="mt-1 text-sm text-white/80">
            Save addresses, track parcels and keep your wishlist close.
          </p>
        </div>
      </div>

      <div className="flex flex-col justify-center">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="text-sm font-semibold text-primary hover:underline">
            ← Back to CuddleHug
          </Link>
          <h1 className="mt-4 text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-5 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
