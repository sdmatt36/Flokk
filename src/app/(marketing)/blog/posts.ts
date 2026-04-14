export interface BlogPost {
  slug: string
  title: string
  category: string
  date: string
  readTime: string
  excerpt: string
  content: string
  color: string
  heroImage: string
}

export const POSTS: BlogPost[] = [
  {
    slug: "why-we-built-flokk",
    title: "Why We Built Flokk Instead of Using a Spreadsheet",
    category: "PRODUCT",
    date: "April 2026",
    readTime: "5 min read",
    color: "#f0f4f8",
    heroImage: "https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?w=800",
    excerpt: "Every family has a system. Ours was a Google Sheet with 11 tabs and a column called Matt's Ideas. Here is why that stopped working.",
    content: `I have a confession. Before Flokk existed, our family travel planning system was a Google Sheet with 11 tabs, color-coded rows, and a dedicated column for "Matt's Ideas" that my wife, Jody, and I reviewed every so often.

We were not unique. Every family we talked to had some version of this. A shared note full of links nobody remembered saving. An Instagram saved folder that is 500 videos deep with zero organization. A restaurant recommendation from 2024 that is buried somewhere across emails, texts, WhatsApp, Facebook Messenger, Instagram DMs -- you get the drift.

The problem is not that families are disorganized. The problem is that the tools were never built for how families actually plan trips.

Here is how it actually goes. You are scrolling Instagram in bed while your spouse watches something you have no interest in. Someone on your feed is eating the most incredible bowl of ramen in a tiny Tokyo spot you have never heard of. You save it. You also save the reel your friend posted from Kyoto. You screenshot the hotel someone mentioned in a Facebook group. You drop a Google Maps pin on a neighborhood you read about in an article you half-finished while getting the kids out the door.

Two months later, when you are actually sitting down to plan the trip, none of it is in the same place. You dig through your camera roll, your messages, your emails. You check your Instagram saved folder. You go back through your notes app. You search your browser history. You give up and Google "best ramen Tokyo" like everyone else, starting from scratch as if none of that research ever happened.

That is a broken system. Not because you did anything wrong. Because no tool was connecting the moment of inspiration to the moment of planning.

But saving things was only half the problem.

Even when families managed to corral their saved content into one place, the actual planning work still happened across five other tabs. Someone is building a day-by-day itinerary in Notion. Someone else is tracking costs in a spreadsheet. There is a shared note for packing. There is a group chat for coordinating with the other family coming along. None of it talks to each other. None of it moves with you.

That is the other gap Flokk was built to close.

Once your saves are in Flokk, you can actually build a trip from them. Drag places into a day-by-day itinerary. See everything on a map. Track your budget as you go -- flights, hotels, activities, all of it -- so you are not doing rough math in your head three weeks before departure and hoping for the best. And when you are traveling with another family or coordinating with grandparents, you can share your trip directly so everyone is working from the same plan, not a version that was copy-pasted into a message two weeks ago and has since drifted completely out of date.

Flokk is not a notes app with a travel skin on it. It is the thing that was always missing between "I saw something amazing" and "we actually got there and it was exactly what we hoped."

We built it because we kept losing the good stuff. Because the open browser tabs deserved somewhere better to live. And because planning a family trip should feel like something you are looking forward to, not a project you have to manage.`
  },
  {
    slug: "japan-with-kids",
    title: "Planning a Week in Japan with Two Kids Under 10",
    category: "TRAVEL",
    date: "February 2026",
    readTime: "8 min read",
    color: "#f0f7f4",
    heroImage: "https://images.unsplash.com/photo-1480796927426-f609979314bd?w=800",
    excerpt: "Japan is the best family travel destination on the planet right now. But it is not a trip you want to wing. Here is what actually worked for our family.",
    content: `We are spending the better part of 6 months living in Kamakura, Japan, with our kids, and the number one thing people asked us when they found out was some version of: "Is Japan actually doable with young kids?"

Yes. Emphatically, enthusiastically yes. And not just doable. It might be the best family travel destination on the planet right now.

But it is not a trip you want to wing. Japan rewards people who did a little homework. Not because it is complicated to navigate once you are there, it is actually the easiest country in the world to get around, but because the difference between a good Japan trip and one your kids talk about for the rest of their lives comes down to a handful of decisions you make before you leave.

Here is what actually worked for our family.

## Do the Shinkansen. Do not stress about it.

Every parent I talked to before our first bullet train ride was worried about managing kids and luggage at speed. It ended up being the thing our kids loved most about the entire trip. Get reserved seats. Sit on the right side heading southwest for the Fuji view on a clear day. Bring snacks. That is the full strategy.

## Ramen for breakfast is not only allowed, it is encouraged.

Japan does not operate on Western meal rules. Ramen shops open early. Convenience store onigiri is genuinely good, not gas station food good, actually good. Kids who have strong opinions about food at home will try things in Japan they would refuse anywhere else, partly because everything is presented so carefully and partly because they are too excited about everything to be difficult.

## Throw the nap schedule out on day two.

Jet lag is going to rearrange everyone regardless. Fighting it is exhausting. What worked for us was letting the kids stay up a little later the first couple of days, accepting the early morning wake-ups, and replacing the afternoon nap with an earlier bedtime. By day three everyone was sleeping through the night and we had two hours of quiet time each evening in one of the greatest food cities on earth.

## Build one day with nothing on it.

Japan is so relentlessly good that you will overschedule. Every neighborhood is interesting. Every train stop has something worth looking at. The temptation is to fill every hour and you will regret it. Leave one full day with no plan and let the kids lead. Our best day in Kamakura was an unplanned Tuesday where we followed our son to every vending machine he could find, poking our heads in random doors down alleyways that seemed interesting, and ended up at a beach nobody had booked or knew about.

## What is actually worth booking ahead.

Teamlab Borderless in Tokyo. Yomiuri Giants or Yakult Swallows baseball games. Ghibli Museum if you can get tickets -- the lottery is real, start early. A cooking class if your kids are into food. Everything else you can figure out on the ground. Japan is extremely walkable and extremely forgiving of people who did not plan every meal.

Japan with kids is not a compromise trip where the adults give things up so the kids can have fun. It is one of the rare places where everyone wins. Start saving your links.`
  },
  {
    slug: "15-minute-planning-habit",
    title: "The 15-Minute Trip Planning Habit That Saves Hours Later",
    category: "TIPS",
    date: "February 2026",
    readTime: "4 min read",
    color: "#fdf6f0",
    heroImage: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
    excerpt: "One small habit -- saving links as you find them, not when you need them -- changes everything about how you plan.",
    content: `I used to plan trips the way most people do. Get excited when we decide to go and quick rapid fire search and save some options. Then life gets in the way. Completely ignore it until about six weeks before departure, then spend three consecutive weekends in a panic trying to reconstruct six months of half-remembered recommendations while my wife sent me links I immediately lost.

The trips turned out fine. Not great. Fine. Well, mostly great. But I digress.

The thing that changed everything was treating trip planning less like a project and more like a savings account. A little bit, consistently, over time. By the time you actually need to spend it, it is already there.

The habit is simple: fifteen minutes, once a week, no agenda.

Not "plan the entire Portugal trip tonight." Just open Flokk, look at what you have saved recently, tag the ones that are genuinely good, and drop a few new saves if something caught your eye that week. That is the whole thing. You are done.

What happens over three or four months of doing this is that by the time you are six weeks out from a trip, you already have forty or fifty saved places organized by category with photos and map pins. You are not starting from scratch. You are editing a draft. The difference in stress level is significant.

The other thing that happens is you start learning things about how your family actually travels. You notice you save a lot of outdoor spots and almost no shopping. You realize your kids do better with one big activity per day than two medium ones. You figure out that you always regret the over-scheduled days and never regret the slow ones.

No travel blogger can tell you that about your family. Fifteen minutes a week over the course of a year can.

The families who have the best trips are not the ones who research the hardest in the six weeks before departure. They are the ones who paid quiet attention all year. Start this week.`
  },
  {
    slug: "get-kids-excited",
    title: "How to Get Kids Excited About a Trip Before You Leave",
    category: "FAMILY",
    date: "January 2026",
    readTime: "6 min read",
    color: "#f5f0f7",
    heroImage: "https://images.unsplash.com/photo-1475503572774-15a45e5d60b9?w=800",
    excerpt: "Building anticipation is half the value of a family trip. These are the tools and tricks that work for us.",
    content: `The worst thing you can do before a family trip is keep it a surprise until the morning of departure. The second worst thing is announce it six weeks out with full details and then field the question "are we there yet" on a daily basis for a month and a half before you even get to the airport.

There is a middle path and it works really well.

## Tell them early but give them a job.

Kids who have a role in the planning are invested in a completely different way than kids who are just passengers. The job does not have to be significant. "You are in charge of finding one restaurant we all go to" is enough. "Pick two things you want to do and we will do both" is enough. If they are old enough, let them research and plan a day, with a budget.

Before our Japan trip, our son spent three weeks researching restaurants and watching Somebody Feed Phil. By the time we boarded the plane, he knew more about regional ramen variations than I did. He is ten. He was also the most engaged traveler in our family for the entire trip because he had skin in the game.

## Make the countdown mean something.

Not just a number ticking down on a calendar. One small activity per week leading up to departure that connects to where you are going. Watch a movie set there. Cook one dish from that country. Find it on a map and trace how you get from your house to the airport to the destination. These are not homework assignments. They are just fun, and they make the place feel real before you arrive.

## Show them a map, not a spreadsheet.

Presenting a day-by-day itinerary to a child in any text-based format accomplishes nothing. Showing them a map with pins and saying "we sleep here, then we go here, then we end up here" lands immediately. Kids understand space and sequence. They do not understand columns and rows.

## Give them something that belongs only to the trip.

A journal. A cheap camera. A sketchbook. Something that is theirs and only comes out for travel. Kids who have a way to capture their own version of a trip remember it differently than kids who are along for the ride. Our friend's daughter still has journals from trips she took at six years old. The memories in those are more specific than anything I could have told her to remember.

The goal is not to manufacture excitement. Kids are already excited about trips. The goal is to turn that energy into something useful so by the time you land, everyone feels like a participant.`
  },
  {
    slug: "instagram-into-flokk",
    title: "What Happens When You Share an Instagram Post into Flokk",
    category: "PRODUCT",
    date: "January 2026",
    readTime: "3 min read",
    color: "#fff8f0",
    heroImage: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800",
    excerpt: "You save it to Instagram. Two months later you cannot find it. Here is what happens instead when you share it into Flokk.",
    content: `You are scrolling Instagram on a Sunday morning and someone on your feed posts a video from a rooftop restaurant in Lisbon. The light is perfect, the food looks incredible, and you think "we are going to Portugal next year, I need to remember this place."

So you save it to Instagram. Two months later you cannot find it. Your saved folder has 600 posts in it, zero organization, and no search that works well enough to surface the one restaurant you are thinking of.

Here is what happens instead when you share that same post into Flokk.

You tap the share icon, copy the link, open Flokk, and paste it. That is the last manual step. Everything after that is automatic.

Flokk reads the post. It pulls the caption, the location tags, and the visible text from the video. It sends that content to our AI, which determines that this is a restaurant, that it is in Lisbon, and what the place is most likely called. Then it calls Google Places to confirm the match, pulls the actual restaurant photo, gets the address, and drops a map pin on the location.

By the time you put your phone down you have a saved card with the restaurant name, a real photo, a Lisbon destination tag, a Food and Drink category label, and a map pin. If you have a Portugal or Lisbon trip in Flokk already, it is assigned to it automatically.

The whole process takes about four seconds.

We built it this way because inspiration is perishable. You will not remember that restaurant in six months. You will not find it in your Instagram saved folder when you need it. But if it is in Flokk, searchable and organized by destination, it is there exactly when you need it.

Save it when you see it. Use it when you need it. That is the whole idea.`
  },
  {
    slug: "steal-this-itinerary",
    title: "Your Friend Went to Japan Last Spring. You Just Can't Get the Itinerary Out of Them.",
    category: "PRODUCT",
    date: "April 2026",
    readTime: "5 min read",
    color: "#f0f4f8",
    heroImage: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800",
    excerpt: "The information exists. Your friend lived it. They just have no way to get it to you without it becoming a homework assignment.",
    content: `You know the conversation.

You find out a family you are close with just got back from exactly the trip you are planning. Same kids, roughly the same ages, roughly the same budget, roughly the same tolerance for how much walking a nine-year-old will accept before someone starts crying. You message them immediately. "We are thinking about doing Kyoto in the fall -- can you send me what you did?"

They say absolutely. They are thrilled you asked. They had the best time.

And then life happens.

Two weeks later you send a follow-up. They send back a voice memo in three parts and a screenshot of a Google Maps list that has 40 pins and no context. Your spouse tries to reconstruct it into something usable. You get about halfway through before you give up and open TripAdvisor, where you are now reading reviews from strangers who have nothing in common with you, whose kids are either grown or nonexistent, who rated a restaurant four stars but spent two sentences complaining about the noise -- which, for a family with young children, is actually your entire vibe.

This is the part that has always driven us crazy.

The information exists. Your friend lived it. They have strong opinions about which ryokan was actually worth it, which train pass you do not need, which temple the kids genuinely loved versus which one they trudged through while everyone quietly wished they were at the hotel pool. That knowledge is sitting right there in their head, or scattered across their camera roll, or buried in a group chat from the trip itself. And it is genuinely more useful to you than anything an algorithm is going to surface.

But there is no way to get at it without making it someone's homework assignment.

That is what Flokk's itinerary sharing is built around. When a family plans a trip in Flokk, the whole thing is already structured. The days, the places, the order, the context. And when they are ready to share it, they can make that itinerary public with one tap. Not a dump of 40 unsorted pins. Not a voice memo. The actual trip, organized the way they lived it, available to anyone who wants to steal it.

And steal is the right word. We are not being precious about it. The whole point is that someone who just got back from a week in Hokkaido with a seven and a ten year old has done the research, made the calls, learned what they wished they had known before they left. That is a document worth having. You should absolutely take it, drop it into your own trip, adjust what does not fit, and go.

We call it the itinerary. Travel Instagram calls it an aesthetic. TripAdvisor calls it a review. None of those things are the same as a family you trust saying here is exactly what we did, here is where we ate, here is the one thing we almost skipped that ended up being the highlight of the trip.

That is what lives in Flokk now. Real itineraries, from real families, for the rest of us who are planning the same kinds of trips and just need someone to go first.

Your friend meant to send it to you. Now they already did.`
  }
]
