import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";

type Doc = {
  title: string;
  intro: string;
  sections: { heading: string; body: string[] }[];
};

const docs: Record<string, Doc> = {
  about: {
    title: "Our story",
    intro:
      "CuddleHug began in a tiny Bengaluru studio with one sewing machine, a mountain of plush and a simple belief: everyone deserves a hug that lasts.",
    sections: [
      {
        heading: "Handmade in small batches",
        body: [
          "Every bear is cut, stitched and stuffed by a team of eleven craftspeople. Small batches mean we can obsess over seam strength, embroidery symmetry and the exact amount of stuffing that makes a bear huggable rather than floppy.",
          "We run quality checks on eyes, noses and limbs before a bear ever reaches a box.",
        ],
      },
      {
        heading: "Materials we trust",
        body: [
          "Our outer fabric is skin-safe polyester plush tested for colourfastness, and our filling is hypoallergenic hollow fibre that springs back after every squeeze.",
          "Nothing that touches skin contains harmful dyes or small parts that can detach.",
        ],
      },
      {
        heading: "Packing with a conscience",
        body: [
          "Boxes are made from recycled cardboard and we use paper tape instead of plastic. The only plastic you will find is the protective sleeve around the bear.",
        ],
      },
    ],
  },
  contact: {
    title: "Contact us",
    intro: "Questions about an order, a bear, or life in general? We reply within one working day.",
    sections: [
      {
        heading: "Reach us",
        body: [
          "Email: hello@cuddlehug.com",
          "Phone / WhatsApp: +91 98765 43210 (10am–7pm IST, Mon–Sat)",
          "Studio: CuddleHug Studios, Bengaluru, Karnataka, India",
        ],
      },
      {
        heading: "Order support",
        body: [
          "Keep your order number handy (it looks like CH-2026-000012) and we can track, modify or cancel an order before it ships.",
        ],
      },
    ],
  },
  shipping: {
    title: "Shipping & delivery",
    intro: "We ship across India with tracked courier partners. Bears travel fast.",
    sections: [
      {
        heading: "Timelines",
        body: [
          "Metro cities: 2–4 working days. Rest of India: 4–7 working days.",
          "Orders placed before 2pm are packed the same day. Custom gift notes add no extra time.",
        ],
      },
      {
        heading: "Charges",
        body: [
          "Flat ₹79 shipping, free on orders above ₹1,499.",
          "Cash on delivery is available for orders up to ₹10,000 with a ₹29 handling fee waived on prepaid orders.",
        ],
      },
      {
        heading: "Tracking",
        body: [
          "Once your bear leaves the studio you will get an email and a notification with the tracking number, and you can follow progress any time from Your orders.",
        ],
      },
    ],
  },
  returns: {
    title: "Returns & refunds",
    intro: "If the hug is not right, send it back within 7 days of delivery.",
    sections: [
      {
        heading: "What can be returned",
        body: [
          "Unused bears with tags attached, in original packaging, within 7 days of delivery.",
          "Personalised or engraved items cannot be returned unless they arrived damaged.",
        ],
      },
      {
        heading: "How it works",
        body: [
          "Raise a return from Your orders or email hello@cuddlehug.com with your order number.",
          "We arrange a pickup within 2 working days and inspect the item on arrival.",
          "Refunds are credited to the original payment method within 5–7 working days, or to a CuddleHug gift card instantly if you prefer.",
        ],
      },
    ],
  },
  faq: {
    title: "Frequently asked questions",
    intro: "The questions our support team hears most, answered once and for all.",
    sections: [
      {
        heading: "Are the bears washable?",
        body: [
          "Yes. Most bears are hand-washable in cold water with mild detergent. Avoid machine drying — squeeze out water gently and air dry flat to keep the stuffing lofty.",
        ],
      },
      {
        heading: "Are they safe for toddlers?",
        body: [
          "Bears marked 0+ use embroidered eyes instead of plastic safety eyes. For children under 3 we still recommend adult supervision during play.",
        ],
      },
      {
        heading: "Can I add a gift note?",
        body: [
          "Yes — add your message during checkout and we will hand-write it on a CuddleHug card. Prices are never included in the parcel.",
        ],
      },
      {
        heading: "Do you ship internationally?",
        body: [
          "Not yet. We currently ship within India only, and we are working on it for next year.",
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy policy",
    intro: "We collect only what we need to deliver your order and improve your visit.",
    sections: [
      {
        heading: "What we collect",
        body: [
          "Account details (name, email, phone), delivery addresses, order history and basic device information used for security.",
          "We never see or store your card number — payments are processed by Razorpay over an encrypted connection.",
        ],
      },
      {
        heading: "How we use it",
        body: [
          "To process orders, send transactional updates, prevent fraud and, only with your consent, share offers by email.",
        ],
      },
      {
        heading: "Your choices",
        body: [
          "You can request a copy or deletion of your data any time by writing to hello@cuddlehug.com.",
        ],
      },
    ],
  },
  terms: {
    title: "Terms of service",
    intro: "By shopping at CuddleHug you agree to these straightforward terms.",
    sections: [
      {
        heading: "Orders",
        body: [
          "An order is confirmed once payment is authorised or, for COD, once our team calls to verify.",
          "We may cancel orders that fail payment or show fraudulent patterns, with a full refund if money was captured.",
        ],
      },
      {
        heading: "Pricing",
        body: [
          "All prices are in Indian Rupees and include GST where applicable.",
          "In case of a pricing error we will contact you before shipping.",
        ],
      },
      {
        heading: "Liability",
        body: [
          "Our liability for any claim is limited to the value of the order in question.",
        ],
      },
    ],
  },
  care: {
    title: "Care guide",
    intro: "Treat your bear kindly and it will stay huggable for years.",
    sections: [
      {
        heading: "Washing",
        body: [
          "Hand wash in cold water with mild detergent. Do not bleach. Air dry flat away from direct sunlight.",
        ],
      },
      {
        heading: "Storage",
        body: [
          "Store in a breathable cotton bag rather than plastic, and give the bear a gentle fluff before hugging season.",
        ],
      },
      {
        heading: "Repairs",
        body: [
          "Loose seam or lost button? Send us a photo and we will repair it for free within the first year.",
        ],
      },
    ],
  },
};

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(docs).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  const entry = docs[doc];
  return entry ? { title: entry.title, description: entry.intro } : { title: "Not found" };
}

export default async function DocPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const entry = docs[doc];
  if (!entry) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold">{entry.title}</h1>
      <p className="mt-3 text-lg text-muted-foreground">{entry.intro}</p>

      <div className="mt-8 space-y-8">
        {entry.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-semibold">{section.heading}</h2>
            <div className="mt-2 space-y-2">
              {section.body.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-relaxed text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-10 rounded-lg border border-border bg-card p-5">
        <p className="text-sm font-semibold">Still have a question?</p>
        <p className="mt-1 text-sm text-muted-foreground">Our team replies within one working day.</p>
        <div className="mt-3 flex gap-3">
          <Link href="/contact">
            <Button>Contact us</Button>
          </Link>
          <Link href="/shop">
            <Button variant="outline">Back to shop</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
