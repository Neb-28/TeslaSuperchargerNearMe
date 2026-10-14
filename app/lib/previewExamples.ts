// Made-up businesses that fill the paid spots nobody holds in the Get featured preview, so a
// business sees the whole lineup (#1 Featured, #2 and #3 Sponsored) with theirs in place. Never
// shown on station pages; the preview says they're examples.
import type { SponsorSlot } from "./featured";
import type { CategoryId } from "./places";

type Example = { businessName: string; kind: string; offerText: string; ctaLabel: string };

export const PREVIEW_EXAMPLES: Record<CategoryId, Record<SponsorSlot, Example>> = {
  food: {
    1: { businessName: "Corner Bistro", kind: "American kitchen · dine in or takeout", offerText: "10% off your order while you charge", ctaLabel: "See menu" },
    2: { businessName: "Spice Route", kind: "Indian restaurant", offerText: "Free mango lassi with any entree", ctaLabel: "Order ahead" },
    3: { businessName: "Main Street Burgers", kind: "Burgers · fast food", offerText: "Free fries while you charge", ctaLabel: "See deals" },
  },
  coffee: {
    1: { businessName: "Daily Grind Coffee", kind: "Espresso bar · pastries", offerText: "Free size upgrade while you charge", ctaLabel: "Order ahead" },
    2: { businessName: "Morning Bakehouse", kind: "Bakery · café", offerText: "Free pastry with any drink", ctaLabel: "See menu" },
    3: { businessName: "Leaf & Bean Tea", kind: "Tea house", offerText: "10% off any drink", ctaLabel: "See deals" },
  },
  grocery: {
    1: { businessName: "Fresh Market", kind: "Grocery store", offerText: "5% off your basket while you charge", ctaLabel: "Shop now" },
    2: { businessName: "Corner Pantry", kind: "Convenience store", offerText: "Free coffee with any snack", ctaLabel: "See deals" },
    3: { businessName: "Green Basket", kind: "Organic grocer", offerText: "$5 off $40 or more", ctaLabel: "Shop now" },
  },
  bars: {
    1: { businessName: "The Tap Room", kind: "Bar · grill", offerText: "Free appetizer with any entree", ctaLabel: "See menu" },
    2: { businessName: "Vine & Barrel", kind: "Wine shop", offerText: "10% off any bottle", ctaLabel: "Shop wines" },
    3: { businessName: "Zero Proof Bar", kind: "Mocktail bar", offerText: "Free mocktail tasting", ctaLabel: "See menu" },
  },
  shops: {
    1: { businessName: "Town Books", kind: "Bookstore · gifts", offerText: "10% off any book while you charge", ctaLabel: "Browse" },
    2: { businessName: "Gadget Corner", kind: "Electronics store", offerText: "Free phone cable with any purchase", ctaLabel: "See deals" },
    3: { businessName: "Paws & Co.", kind: "Pet store", offerText: "Free treat for your dog", ctaLabel: "Visit us" },
  },
  chargers: {
    1: { businessName: "QuickCharge Plaza", kind: "DC fast charging", offerText: "First 15 minutes free", ctaLabel: "Start charging" },
    2: { businessName: "Downtown Garage", kind: "Parking with EV chargers", offerText: "Free parking while you charge", ctaLabel: "See rates" },
    3: { businessName: "Sunny Car Wash", kind: "Car wash", offerText: "$5 off any wash", ctaLabel: "See deals" },
  },
};
