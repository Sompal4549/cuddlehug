import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-24 text-center">
      <p className="text-6xl font-black text-primary">404</p>
      <h1 className="text-2xl font-bold">This page slipped under the sofa</h1>
      <p className="text-muted-foreground">
        The link you followed does not exist — but plenty of huggable bears do.
      </p>
      <div className="flex gap-3">
        <Link href="/">
          <Button>Back home</Button>
        </Link>
        <Link href="/shop">
          <Button variant="outline">Shop teddies</Button>
        </Link>
      </div>
    </div>
  );
}
