# Mobile Onboarding Flow Reference

Source: web app onboarding wizard at `/onboarding`.
Purpose: document the exact data collected, option sets, and persistence targets so the mobile onboarding screens can replicate or extend this flow faithfully.

---

## Overview

The web wizard is a 3-step linear flow with a progress bar (Step N of 3). There is no skip logic and no optional steps except where individual fields are marked optional. On completion the entire payload is submitted in a single POST to `/api/onboarding`. The wizard can also be re-entered by signed-in users who already have a profile; re-onboarding deletes the existing FamilyProfile and recreates it from scratch.

After submission the user lands at `/home` unless a share intent (stored in localStorage under `flokk_share_intent`) was set before sign-up, in which case they are redirected to the shared resource first.

---

## Step 1 -- Family Basics

**Screen title:** "Let's get started."
**Subtitle:** "A few quick details. Takes about 60 seconds."

**Purpose:** Capture the household identity and home base so recommendations can be filtered by proximity and frequency.

### Fields

| Field | Type | Options | Required |
|---|---|---|---|
| familyName | string (free text) | none | No |
| homeCity | string (free text) | none | Yes |
| homeCountry | string (select) | ~100 country names (full list in StepFamilyBasics.tsx) | Yes |
| travelFrequency | enum select (pill buttons) | ONE_TWO, THREE_FIVE, SIX_PLUS | Yes |

**travelFrequency display labels:**
- ONE_TWO = "1-2 times a year"
- THREE_FIVE = "3-5 times a year"
- SIX_PLUS = "6+ times a year"

**Continue gating:** homeCity, homeCountry, and travelFrequency must all be non-empty. familyName is skippable (submits as null).

---

## Step 2 -- Family Members ("Your crew.")

**Screen title:** "Your crew."
**Subtitle:** "Add everyone who travels with you: kids, adults, grandparents, whoever."

**Purpose:** Build the traveler roster with dietary and allergy data per person. Child birth dates drive age-based recommendation scoring.

The step pre-populates with one ADULT card. Users can add or remove any number of adults or children. The Continue button is disabled only if the members array is empty (at least one person required).

### Per-member fields

| Field | Type | Options | Required |
|---|---|---|---|
| role | enum | ADULT, CHILD | Yes (set by which button was pressed) |
| name | string (free text) | none | No |
| birthDate | date string (YYYY-MM-DD) | none | No for ADULT, optional for CHILD |
| dietaryRequirements | string[] (multi-select pill) | see below | No |
| foodAllergies | string[] (multi-select pill) | see below | No |
| allergyNotes | string (textarea) | none | No |

**birthDate notes:** Only shown for CHILD members. The UI uses an HTML date input. Value stored as ISO date string, converted to DateTime at the API layer. The label reads "We use birth date so recommendations stay accurate as your kids grow."

**dietaryRequirements options (DietaryReq enum):**
- VEGETARIAN = "Vegetarian"
- PESCATARIAN = "Pescatarian"
- VEGAN = "Vegan"
- HALAL = "Halal"
- KOSHER = "Kosher"
- GLUTEN_FREE = "Gluten Free"
- NUT_FREE = "Nut Free"
- DAIRY_FREE = "Dairy Free"

*(Note: the DietaryReq enum also contains OTHER but it is not surfaced in the onboarding UI.)*

**foodAllergies options (free string values, not an enum):**
- gluten = "Gluten / Coeliac"
- peanuts = "Peanuts"
- tree_nuts = "Tree nuts"
- dairy = "Dairy / Lactose"
- eggs = "Eggs"
- shellfish = "Shellfish"
- fish = "Fish"
- soy = "Soy"
- sesame = "Sesame"
- sulphites = "Sulphites"

**Skip logic:** No step-level skip. Individual dietary and allergy fields are optional. A user with no dietary restrictions simply leaves all pills unselected.

---

## Step 3 -- Interests ("What excites your family?")

**Screen title:** "What excites your family?"
**Subtitle:** "Pick everything that sounds like you. No wrong answers."

**Purpose:** Seed the DeclaredInterest table so recommendations, discover content, and AI scoring can be personalized immediately.

**Minimum selections:** 3. The Continue button is labelled "N more to continue" until the threshold is met, then changes to "Let's go".

Interests are displayed in a filterable tile grid. The category filter row shows "All" plus the 8 categories below.

### Interest catalog by category

**FOOD (Food and Drink):**
- street_food = "Street Food"
- local_markets = "Local Markets"
- fine_dining = "Fine Dining"
- food_tours = "Food Tours"
- cooking_classes = "Cooking Classes"
- cafes = "Cafes and Coffee"

**OUTDOOR (Outdoors):**
- hiking = "Hiking"
- beaches = "Beaches"
- national_parks = "National Parks"
- cycling = "Cycling"
- water_sports = "Water Sports"
- wildlife = "Wildlife and Nature"

**CULTURE (Culture):**
- museums = "Museums"
- history = "History and Heritage"
- art = "Art and Galleries"
- architecture = "Architecture"
- local_festivals = "Local Festivals"
- music = "Live Music"

**KIDS (Kids and Family):**
- theme_parks = "Theme Parks"
- playgrounds = "Playgrounds and Parks"
- zoos = "Zoos and Aquariums"
- educational = "Educational Activities"
- sports = "Sports and Games"
- hands_on = "Hands-On Experiences"

**ENTERTAINMENT:**
- movies = "Cinemas"
- family_kids = "Family and Kids"
- kid_friendly = "Kid Friendly"
- nightlife = "Nightlife"
- shows = "Shows and Theater"
- sports_events = "Sports Events"

**SHOPPING:**
- boutiques = "Boutiques"
- vintage = "Vintage and Thrift"
- souvenirs = "Souvenirs and Gifts"
- antiques = "Antiques"

**WELLNESS:**
- spas = "Spas and Wellness"
- yoga = "Yoga and Meditation"
- hot_springs = "Hot Springs and Onsen"
- slow_travel = "Slow Travel"

**STYLE (Travel Style):**
- luxury = "Luxury Experiences"
- budget_travel = "Budget Travel"
- off_beaten_path = "Off the Beaten Path"
- photography = "Photography Spots"
- road_trips = "Road Trips"
- multi_generational = "Multigenerational Travel"

**Total interests:** 50 across 8 categories.

### Fields submitted

| Field | Type | Constraint | Required |
|---|---|---|---|
| interestKeys | string[] | minimum 3 items | Yes |

---

## API Persistence

### Endpoint

`POST /api/onboarding`

### Request body schema

```
{
  familyName:      string | undefined
  homeCity:        string (min 1)
  homeCountry:     string (min 1)
  travelFrequency: "ONE_TWO" | "THREE_FIVE" | "SIX_PLUS"
  members: [
    {
      role:                 "ADULT" | "CHILD"
      name?:                string
      birthDate?:           string (ISO date, e.g. "2018-04-15")
      dietaryRequirements:  DietaryReq[]
      foodAllergies?:       string[]
      allergyNotes?:        string
    }
  ]
  interestKeys: string[] (min 3)
}
```

### Database writes

**1. FamilyProfile (upsert/replace)**

The route first deletes any existing FamilyProfile for the user (re-onboarding), then creates a new one.

| DB column | Source field | Notes |
|---|---|---|
| userId | resolved from Clerk session | links to User.id |
| familyName | familyName | nullable |
| homeCity | homeCity | |
| homeCountry | homeCountry | |
| travelFrequency | travelFrequency | stored as TravelFrequency enum |

Fields NOT set during onboarding (schema has columns, but wizard does not collect them):
- state, homeCurrency, favoriteAirports, budgetRange, accessibilityNotes, travelStyle, pace, planningStyle

**2. FamilyMember (created per member)**

| DB column | Source | Notes |
|---|---|---|
| familyProfileId | created FamilyProfile.id | |
| role | member.role | ADULT or CHILD |
| name | member.name | nullable |
| birthDate | member.birthDate | converted from ISO string to DateTime; null if not provided |
| dietaryRequirements | member.dietaryRequirements | stored as DietaryReq[] |
| foodAllergies | member.foodAllergies | stored as String[] |
| allergyNotes | member.allergyNotes | nullable |

Fields on FamilyMember NOT collected during onboarding:
- mobilityNotes, passportCountry, passportNumber, citizenshipCountry, passportIssueDate, passportExpiryDate, globalEntry, nexus, redress, ktn, visaNotes, loyaltyPrograms

**3. DeclaredInterest (created per selected key)**

| DB column | Source | Notes |
|---|---|---|
| familyProfileId | created FamilyProfile.id | |
| interestKey | element of interestKeys | |
| category | derived via getCategoryForKey() | mapped from interestKey at write time |
| tier | hardcoded "SIGNUP" | InterestTier enum |
| weight | hardcoded 1.0 | Float |

---

## Post-Onboarding Profile Sections

After onboarding completes the user lands in the Profile at `/profile`. The six sections and which fields the onboarding flow populates are:

| Profile section | Fields populated by onboarding | Fields left blank for user to fill later |
|---|---|---|
| Family | familyName, homeCity, homeCountry, travelFrequency | state, homeCurrency, favoriteAirports, budgetRange, accessibilityNotes, travelStyle, pace, planningStyle, senderEmails |
| Travelers | role, name, birthDate, dietaryRequirements, foodAllergies, allergyNotes (per member) | mobilityNotes, seating preference |
| Travel Docs | (none -- all passport and trusted-traveler fields are blank) | passportCountry, passportNumber, citizenshipCountry, passportIssueDate, passportExpiryDate, globalEntry, nexus, redress, ktn, visaNotes |
| Loyalty | (none) | airline, hotel, and car rental programs |
| Payment | (none) | payment cards |
| Stats | auto-populated from trip and save activity over time | n/a |

Interests are shown on the home page dashboard and on `/profile/interests` (a dedicated edit surface), not in the main Profile section nav.

---

## Fields on FamilyProfile Schema Not Yet Surfaced Anywhere

The following columns exist in the Prisma schema and are not set during onboarding and not yet visible in the web Profile editor. They are available for the mobile onboarding to collect if desired:

- state (home state/province)
- homeCurrency (default USD)
- favoriteAirports (String, free text)
- budgetRange (BUDGET / MID / PREMIUM / LUXURY)
- travelStyle (ADVENTUROUS / BALANCED / RELAXED)
- pace (RELAXED / BALANCED / PACKED)
- planningStyle (STRUCTURED / BALANCED / SPONTANEOUS)
- accessibilityNotes (String, free text)
