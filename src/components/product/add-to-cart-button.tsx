"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart/cart-context";

export function AddToCartButton({ slug }: { slug: string }) {
  const t = useTranslations("common");
  const { addItem, openCart } = useCart();
  const [added, setAdded] = useState(false);

  return (
    <Button
      size="lg"
      className="w-full rounded-none bg-night py-7 text-sm tracking-[0.3em] uppercase text-moon transition-colors duration-300 hover:bg-gold hover:text-night sm:w-auto sm:px-14"
      onClick={() => {
        addItem(slug);
        setAdded(true);
        setTimeout(() => {
          openCart();
          setAdded(false);
        }, 450);
      }}
    >
      {added ? (
        <>
          <Check className="me-2 h-4 w-4" /> {t("added")}
        </>
      ) : (
        t("addToCart")
      )}
    </Button>
  );
}
