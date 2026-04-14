"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { ChevronDown, Search } from "lucide-react";

type Article = { title: string; copy: string };
type Category = { title: string; articles: Article[] };

const CATEGORIES: Category[] = [
  {
    title: "Saving content",
    articles: [
      {
        title: "Save from Social (Instagram, TikTok, Facebook, YouTube)",
        copy: "Instagram: Tap the share icon on any post, reel, or story and select Copy Link. Open Flokk and tap + Save Link, paste the link and save — Flokk extracts the place name, location, and category automatically. TikTok: Tap Share → Copy Link on any video. Open Flokk, tap + Save Link, paste and save. Flokk reads the caption and audio to identify the place. Facebook: Tap the three dots on any post → Copy Link. Open Flokk, tap + Save Link, paste and save. Restaurant pages and event pages work best. YouTube: Tap Share → Copy Link on any travel video. Open Flokk, tap + Save Link, paste and save. Flokk extracts the destination from the title and description.",
      },
      {
        title: "Save from Google Maps or Apple Maps",
        copy: "Google Maps: Find a place and tap Share on the place page. Forward the link to trips@flokktravel.com — Flokk creates a save and sends you a confirmation. Or paste the link directly into Flokk's + Save Link. Both share.google short links and full Google Maps URLs work. Apple Maps: Find a place, tap it, scroll down and tap Share. Forward to trips@flokktravel.com or paste into Flokk's Save Link flow.",
      },
      {
        title: "Save Lodging (Airbnb, Booking.com, Hotels.com)",
        copy: "Copy the listing URL from your browser or tap Share in the app. Forward to trips@flokktravel.com or paste into Flokk's + Save Link. Flokk saves the property name, location, and image. Tip: Once you book, forward your booking confirmation email to trips@flokktravel.com — Flokk will auto-file it into your itinerary with the confirmation code, dates, and property details.",
      },
      {
        title: "Save a Restaurant or Activity",
        copy: "Find the restaurant, tour, or activity on any website — Google Search, Yelp, Tabelog, Viator, GetYourGuide, or a restaurant's own site. Copy the URL and either paste into Flokk's + Save Link or forward to trips@flokktravel.com. Flokk extracts the name, city, and photo automatically. If you have a trip for that city, the save is assigned to it automatically.",
      },
      {
        title: "Save from Notes, iMessage, or WhatsApp",
        copy: "Notes app: If your note contains a URL, tap and hold the link → Share → Mail → send to trips@flokktravel.com. For plain text recommendations, compose an email to trips@flokktravel.com and paste the text — Flokk extracts what it can. iMessage: Tap and hold a message with a link → Forward → send to trips@flokktravel.com. WhatsApp: Tap and hold a message → Share → send to trips@flokktravel.com. Tip: A message like 'try Nobu in London, amazing omakase' will extract the place and city and assign it to your London trip automatically.",
      },
      {
        title: "Forward a Booking Confirmation to trips@flokktravel.com",
        copy: "Forward any travel confirmation email to trips@flokktravel.com and Flokk automatically files it into the right trip. Supported: flight confirmations (any airline, Google Flights, Expedia), hotel confirmations (Booking.com, Hotels.com, Airbnb, any hotel), tour and activity confirmations (GetYourGuide, Viator, Klook), restaurant reservations (OpenTable, Resy). How: Open your confirmation email, forward to trips@flokktravel.com, and Flokk reads the dates, location, and booking reference. It files into the correct trip based on destination and dates. You'll receive a confirmation reply within seconds.",
      },
      {
        title: "Save Anything by Email — trips@flokktravel.com",
        copy: "The fastest way to save anything to Flokk from any device is to forward it to trips@flokktravel.com. Send any URL, booking confirmation, Google Maps link, Airbnb listing, or forwarded recommendation. Flokk extracts the place name, city, category, and photo — and if you have a trip for that destination, assigns it automatically. You'll receive a confirmation email with a link to your save or trip. Send from the email address linked to your Flokk account. One save per email gives the cleanest results.",
      },
      {
        title: "What Happens When You Save",
        copy: "Every time you save a link or forward an email, Flokk automatically: extracts the place name and city from the page content, finds the best photo from Google Places or the original page, tags the save with a category (Food & Drink, Culture, Lodging, Outdoor, and more), geocodes the location so it appears on your trip map, assigns it to a matching trip if you have one for that city or country, and sends a confirmation if you saved via trips@. The original source URL is always preserved.",
      },
      {
        title: "Using the iOS Share Sheet (Coming Soon)",
        copy: "The Flokk iOS app will add Flokk as an option in your iPhone's native share sheet. Once available, saving from Instagram, TikTok, Google Maps, Safari, or any app will be as simple as tapping Share → Flokk. Until the app launches, the fastest alternative is to copy any link and forward it to trips@flokktravel.com — the result is identical. Join the waitlist for early access at flokktravel.com.",
      },
    ],
  },
  {
    title: "Planning trips",
    articles: [
      {
        title: "Creating your first trip",
        copy: "From the home screen, tap the + button or 'New Trip'. Enter your destination and travel dates. Flokk automatically finds a cover photo for your destination. Your trip has five tabs: Saved, Itinerary, Recommended, Packing, and Notes.",
      },
      {
        title: "Adding saves to a trip",
        copy: "From your Saved tab on any trip, tap '+ Save Link' to add a new place. You can also add saves from the Discover page by tapping 'Add to Trip' on any card. Saves appear in your Saved tab until you schedule them into a specific day on your Itinerary.",
      },
      {
        title: "Understanding the itinerary view",
        copy: "The Itinerary tab shows your trip day by day. Each day can have activities, flights, hotels, and restaurants. Items with a set time are shown in chronological order. Flokk automatically adds transit cards between consecutive timed items to show estimated travel time. Drag items to reorder them within a day.",
      },
      {
        title: "Exporting to Apple Maps or Google Maps",
        copy: "On any itinerary item that has a location, tap the transit card or the directions link. On iPhone, this opens Apple Maps with the route pre-loaded. On Android, it opens Google Maps. On desktop, it opens Google Maps in your browser.",
      },
      {
        title: "How to import your booking confirmations",
        copy: "Flokk can automatically read your booking confirmation emails and file them into the right trip — flights, hotels, and trains all supported.\n\nHow it works:\n1. Forward your confirmation email to trips@flokktravel.com\n2. Send it from an email address linked to your Flokk account\n3. Flokk reads the confirmation, extracts the details, and adds them to your trip automatically\n\nTo link an email address, go to Profile → Approved Sender Emails and add the address you book with. You will receive a short verification email to confirm it.\n\nWhat gets imported: Flights (airline, route, times, confirmation code, passengers), Hotels (property name, check-in and check-out dates, confirmation code, total cost), Trains (route, departure and arrival times, confirmation code).\n\nSupported platforms: Booking.com, Expedia, Airbnb, most major airlines, Rail.Ninja, and any standard booking confirmation email.\n\nTips: Forward the original confirmation not a screenshot. If a booking does not import check that your sending address is verified in Profile. One email per forward.",
      },
      {
        title: "How saves are automatically assigned to trips",
        copy: "When you save a place, Flokk checks whether you have an upcoming or active trip matching that destination. If your save is in London and you have a London trip, it's assigned automatically. Matching works by city first, then country. If multiple trips match, Flokk picks the one with the nearest start date. If no trip matches, the save goes to Unorganized — you can assign it manually from the save card or the save detail view. This works for all saves: in-app, URL drops, and emails forwarded to trips@flokktravel.com.",
      },
    ],
  },
  {
    title: "Family profiles",
    articles: [
      {
        title: "Setting up your family profile",
        copy: "Go to Profile from the bottom navigation. Add your family name, home city, and travel preferences. Add each family member under Crew — include their age and interests. Flokk uses this to personalise recommendations and filter content to what's relevant for your family.",
      },
      {
        title: "Adding travelers",
        copy: "In your Profile, tap 'Add crew member'. Enter their name, age, and interests. For children, adding their age helps Flokk filter recommendations for age-appropriate activities. You can edit or remove crew members at any time.",
      },
      {
        title: "How interests affect recommendations",
        copy: "The interests you set for each family member directly influence the Recommended tab on every trip. If your kids love food and culture, Flokk surfaces restaurants and museums first. Dietary requirements like Halal, Kosher, or Vegetarian are treated as hard filters — you will never see recommendations that don't meet them.",
      },
      {
        title: "Editing dietary preferences",
        copy: "In Profile, scroll to Dietary Preferences. Toggle on any requirements that apply to your family — Halal, Kosher, Vegetarian, Vegan, or Gluten-Free. These are applied as hard filters across all recommendations. Any saved place that conflicts with your dietary requirements will be flagged.",
      },
    ],
  },
  {
    title: "Account & settings",
    articles: [
      {
        title: "Updating your email or password",
        copy: "Flokk uses secure authentication via Clerk. To update your email or password, go to Profile → Account Settings. Changes to your email require verification from your new address before they take effect.",
      },
      {
        title: "Notification preferences",
        copy: "Notification preferences are managed in Profile → Settings. You can control email notifications for trip reminders, new recommendations, and community updates. SMS notifications are coming in a future update.",
      },
      {
        title: "Deleting your account",
        copy: "To delete your account, go to Profile → Account Settings → Delete Account. This permanently removes all your trips, saves, and family data. This action cannot be undone. If you just want a break, you can simply stop using the app — your data is always waiting when you return.",
      },
      {
        title: "Exporting your data",
        copy: "To export your trip data, go to any trip and tap the share icon. You can export a full day-by-day itinerary as a shareable link or PDF. Full data export is coming in a future update.",
      },
    ],
  },
  {
    title: "Billing",
    articles: [
      {
        title: "How the free tier works",
        copy: "Flokk's free tier is fully functional. You get up to 50 saves, 3 active trips, basic recommendations, and full access to community trips and Travel Intel. No credit card required. No features are artificially crippled — the free tier is genuinely useful.",
      },
      {
        title: "Upgrading to Pro",
        copy: "Flokk Pro unlocks unlimited saves and trips, advanced AI recommendations, full import history, collaborative trip planning, offline itinerary access, and priority feature access. Go to Profile → Billing to upgrade. Pricing is $4.99/month or $59.99/year.",
      },
      {
        title: "Cancelling your subscription",
        copy: "To cancel, go to Profile → Billing → Cancel Subscription. Your Pro access continues until the end of your current billing period. After that, your account returns to the free tier — all your data is preserved.",
      },
      {
        title: "Getting a refund",
        copy: "If you're not happy with Flokk Pro, contact us within 14 days of purchase for a full refund. Email matt@flokktravel.com with your account email and we'll sort it immediately.",
      },
    ],
  },
  {
    title: "Troubleshooting",
    articles: [
      {
        title: "A link didn't save correctly",
        copy: "If a link saves but shows wrong information, tap the edit icon on the saved item and correct the details manually. If the link fails to extract entirely, try copying the URL directly from your browser's address bar rather than using a share button. Some sites block automated extraction — if this persists, email matt@flokktravel.com with the URL.",
      },
      {
        title: "The app isn't loading",
        copy: "First, try refreshing the page. If the app still won't load, clear your browser cache and try again. If you're on mobile, try switching between WiFi and mobile data. If the problem persists, check status.flokktravel.com for any known issues or email matt@flokktravel.com.",
      },
      {
        title: "My saves disappeared",
        copy: "Saves are tied to your account and sync across all devices. If saves appear missing, make sure you're logged into the correct account. If you recently changed your email address, try logging in with your previous email. If saves are genuinely missing, email matt@flokktravel.com immediately — we can restore from backup.",
      },
      {
        title: "Reporting a bug",
        copy: "To report a bug, email matt@flokktravel.com with a description of what happened, what you expected to happen, and what device and browser you were using. Screenshots are always helpful. We aim to respond within 24 hours and fix critical bugs within 48 hours.",
      },
    ],
  },
];

function CategorySection({ category, openArticle, onArticleToggle }: {
  category: Category;
  openArticle: string | null;
  onArticleToggle: (title: string) => void;
}) {
  return (
    <div
      style={{
        border: "1px solid #F0F0F0",
        borderRadius: "16px",
        overflow: "hidden",
        backgroundColor: "#fff",
      }}
    >
      {/* Section header — always visible, never toggles */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "24px 28px 0" }}>
        <span style={{ fontSize: "16px", fontWeight: 700, color: "#1B3A5C" }}>{category.title}</span>
        <span style={{ fontSize: "12px", color: "#999", fontWeight: 400 }}>
          {category.articles.length} articles
        </span>
      </div>

      <div style={{ padding: "8px 28px 8px" }}>
        {category.articles.map((article) => (
          <div key={article.title} style={{ borderBottom: "1px solid #F0F0F0" }}>
            <button
              onClick={() => onArticleToggle(article.title)}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 0",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                gap: "12px",
              }}
            >
              <span style={{ fontSize: "14px", fontWeight: 500, color: "#1B3A5C", lineHeight: 1.4 }}>
                {article.title}
              </span>
              <ChevronDown
                size={16}
                style={{
                  color: "#C4664A",
                  flexShrink: 0,
                  transition: "transform 0.2s",
                  transform: openArticle === article.title ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </button>
            {openArticle === article.title && (
              <p style={{ fontSize: "14px", lineHeight: 1.7, color: "#555", margin: "0 0 16px", paddingRight: "28px" }}>
                {article.copy}
              </p>
            )}
          </div>
        ))}
        <div style={{ paddingTop: "16px", paddingBottom: "20px", textAlign: "center" }}>
          <Link
            href="/contact"
            style={{ fontSize: "13px", color: "#C4664A", textDecoration: "none", fontWeight: 500 }}
          >
            Still need help? Contact us →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function HelpPage() {
  const [search, setSearch] = useState("");
  const [openArticle, setOpenArticle] = useState<string | null>(null);

  function handleArticleToggle(title: string) {
    setOpenArticle((prev) => prev === title ? null : title);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return CATEGORIES;
    return CATEGORIES.map((cat) => ({
      ...cat,
      articles: cat.articles.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.copy.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.articles.length > 0);
  }, [search]);

  return (
    <div>
      {/* Hero with search */}
      <section style={{ backgroundColor: "#1B3A5C", padding: "80px 24px" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#C4664A", marginBottom: "16px" }}>
            Help center
          </p>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 600, color: "#fff", maxWidth: "640px", margin: "0 auto 32px", lineHeight: 1.2 }}>
            How can we help?
          </h1>
          <div style={{ maxWidth: "560px", margin: "0 auto", position: "relative" }}>
            <Search
              size={18}
              style={{ position: "absolute", left: "20px", top: "50%", transform: "translateY(-50%)", color: "#999", pointerEvents: "none" }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search articles..."
              style={{
                width: "100%",
                padding: "16px 24px 16px 48px",
                fontSize: "16px",
                border: "none",
                borderRadius: "999px",
                outline: "none",
                color: "#1a1a1a",
                backgroundColor: "#fff",
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />
          </div>
          {search && (
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", marginTop: "12px" }}>
              {filtered.reduce((n, c) => n + c.articles.length, 0)} result
              {filtered.reduce((n, c) => n + c.articles.length, 0) !== 1 ? "s" : ""} for &ldquo;{search}&rdquo;
            </p>
          )}
        </div>
      </section>

      {/* Accordion sections */}
      <section style={{ backgroundColor: "#FAFAFA", padding: "64px 24px" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "64px 0" }}>
              <p style={{ fontSize: "16px", color: "#717171", marginBottom: "16px" }}>
                No articles found for &ldquo;{search}&rdquo;
              </p>
              <Link
                href="/contact"
                style={{ fontSize: "14px", color: "#C4664A", fontWeight: 600, textDecoration: "none" }}
              >
                Ask us directly →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {filtered.map((cat) => (
                <CategorySection
                  key={cat.title}
                  category={cat}
                  openArticle={openArticle}
                  onArticleToggle={handleArticleToggle}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={{ backgroundColor: "rgba(27,58,92,0.04)", padding: "64px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: "640px", margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "28px", fontWeight: 600, color: "#1B3A5C", margin: "0 0 16px" }}>
            Still need help?
          </h2>
          <p style={{ fontSize: "16px", color: "#717171", margin: "0 0 28px" }}>
            We&apos;re a small team and we read every message. Get in touch and we&apos;ll get back to you within 24 hours.
          </p>
          <Link
            href="/contact"
            style={{ display: "inline-block", backgroundColor: "#C4664A", color: "#fff", padding: "12px 28px", borderRadius: "999px", fontSize: "15px", fontWeight: 700, textDecoration: "none" }}
          >
            Contact us &rarr;
          </Link>
        </div>
      </section>
    </div>
  );
}
