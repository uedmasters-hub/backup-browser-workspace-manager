/**
 * Auto Group Tabs — the "what is this tab about?" logic.
 *
 * Pure (no browser APIs), so it runs in the background worker and in
 * scripts/autoGroupHarness.ts. Categories become ordinary Chrome tab groups,
 * created through tabGroupService like every other group in the extension.
 *
 * How a tab is placed, strongest signal first:
 *   1. Known site       — a curated list (figma.com → Design, irctc.co.in → Travel…).
 *   2. Site name hint   — words in the site's own name (emedicalls → "medic" → Healthcare).
 *   3. Keywords         — title, search query, URL path and page metadata
 *                         ("flights to goa" → Travel). Needs more than one hit.
 *   4. Same site        — tabs that fit no category but share a site get a
 *                         group named after it (two Acme tabs → "Acme").
 *
 * Sites are compared by registrable domain (app.acme.co.in → acme.co.in) using
 * tldts, an open-source Public Suffix List parser.
 */
import { parse } from "tldts";

import type { TabGroupColor } from "../../types/tab";
import { buildGroupTitle, splitGroupTitle } from "./tabGroupService";

export type CategoryId =
  | "work"
  | "development"
  | "design"
  | "research"
  | "healthcare"
  | "finance"
  | "travel"
  | "social"
  | "ai"
  | "learning"
  | "shopping"
  | "entertainment"
  | "news";

export interface CategoryDef {
  id: CategoryId;
  name: string;
  emoji: string;
  color: TabGroupColor;
  /** Group titles that already mean this category ("Dev", "Money", …). */
  aliases: string;
  /** Sites: "github.com" also matches subdomains; "google.*" any suffix; "/path" narrows. */
  sites: string;
  /** Words in the site's own name that point here (substring of the name). */
  hints: string;
  /** Title / query / path / metadata keywords (whole words; "|" separates phrases). */
  keywords: string;
}

// Order breaks ties: earlier wins.
export const CATEGORIES: CategoryDef[] = [
  {
    id: "work",
    name: "Work",
    emoji: "💼",
    color: "blue",
    aliases: "work|office|job|jobs|email|mail|meetings|productivity|admin",
    sites: `mail.google.com calendar.google.com docs.google.com drive.google.com sheets.google.com
      slides.google.com meet.google.com chat.google.com keep.google.com forms.google.com
      admin.google.com workspace.google.com sites.google.com mail.yahoo.com mail.zoho.com
      outlook.live.com outlook.office.com outlook.office365.com office.com microsoft365.com
      onedrive.live.com sharepoint.com teams.microsoft.com teams.live.com slack.com notion.so
      notion.site atlassian.net atlassian.com trello.com asana.com monday.com clickup.com
      linear.app basecamp.com airtable.com smartsheet.com zoom.us webex.com calendly.com
      cal.com loom.com miro.com mural.co dropbox.com box.com hubspot.com salesforce.com
      force.com lightning.force.com zoho.com zendesk.com freshdesk.com freshworks.com
      intercom.com docusign.com docusign.net coda.io quip.com todoist.com ticktick.com
      wrike.com workday.com myworkday.com bamboohr.com greenhouse.io lever.co gusto.com
      rippling.com keka.com darwinbox.com superhuman.com proton.me fastmail.com
      clockify.me toggl.com harvestapp.com upwork.com fiverr.com naukri.com indeed.com
      glassdoor.com wellfound.com typeform.com jotform.com tally.so pipedrive.com
      freshsales.io zapier.com make.com ifttt.com`,
    hints: "",
    keywords: `meeting|meetings|standup|stand-up|agenda|inbox|roadmap|sprint|backlog|okr|okrs|kpi|kpis|
      timesheet|hiring|recruitment|recruiter|interview|onboarding|stakeholder|stakeholders|quarterly|
      proposal|minutes of meeting|weekly sync|all hands|job description|offer letter`,
  },
  {
    id: "development",
    name: "Development",
    emoji: "💻",
    color: "purple",
    aliases: "dev|development|code|coding|engineering|programming|tech|developer",
    sites: `github.com githubusercontent.com github.dev gitlab.com bitbucket.org stackoverflow.com
      stackexchange.com serverfault.com superuser.com npmjs.com npmjs.org pypi.org crates.io
      pkg.go.dev go.dev rubygems.org packagist.org nuget.org mvnrepository.com
      developer.mozilla.org developer.chrome.com developer.apple.com developer.android.com
      developers.google.com learn.microsoft.com docs.microsoft.com devdocs.io w3schools.com
      web.dev caniuse.com css-tricks.com dev.to hashnode.com hashnode.dev leetcode.com
      hackerrank.com codeforces.com codechef.com codepen.io codesandbox.io stackblitz.com
      replit.com jsfiddle.net vercel.com netlify.com heroku.com render.com railway.app fly.io
      supabase.com firebase.google.com console.firebase.google.com console.cloud.google.com
      cloud.google.com console.aws.amazon.com aws.amazon.com portal.azure.com
      azure.microsoft.com dev.azure.com cloudflare.com dash.cloudflare.com digitalocean.com
      docker.com hub.docker.com kubernetes.io sentry.io datadoghq.com newrelic.com grafana.com
      postman.com swagger.io regex101.com typescriptlang.org react.dev reactjs.org vuejs.org
      angular.dev angular.io svelte.dev nextjs.org nodejs.org deno.com deno.land bun.sh
      python.org rust-lang.org tailwindcss.com vitejs.dev vite.dev webpack.js.org eslint.org
      prettier.io jestjs.io vitest.dev playwright.dev cypress.io storybook.js.org
      readthedocs.io readthedocs.org sourcegraph.com jsdelivr.com unpkg.com bundlephobia.com
      expo.dev reactnative.dev flutter.dev kotlinlang.org gradle.org jetbrains.com
      code.visualstudio.com vscode.dev chromewebstore.google.com/devconsole
      chrome.google.com/webstore/devconsole tiptap.dev zustand.docs.pmnd.rs`,
    hints: "developer|devops|coding|codebase|github|gitlab|stackoverflow",
    keywords: `api|apis|sdk|npm|git|github|pull request|merge request|commit|repository|repo|stack trace|
      exception|typescript|javascript|python|react|node.js|nodejs|docker|kubernetes|css|html|regex|
      json|graphql|webpack|vite|compiler|debugging|debug|deploy|deployment|localhost|endpoint|
      changelog|unit test|unit tests|ci/cd|terraform|lambda|sql|database|postgres|postgresql|
      mongodb|redis|nextjs|next.js|tailwind|frontend|backend|devops|programming|developer|
      developers|code review|chrome extension|manifest v3|npm package|cli`,
  },
  {
    id: "design",
    name: "Design",
    emoji: "🎨",
    color: "pink",
    aliases: "design|designs|ui|ux|ui/ux|ux/ui|inspiration|branding|visual",
    sites: `figma.com dribbble.com behance.net canva.com adobe.com framer.com sketch.com
      invisionapp.com zeplin.io protopie.io spline.design lottiefiles.com rive.app webflow.com
      coolors.co colorhunt.co fonts.google.com fontshare.com fontsinuse.com typewolf.com
      unsplash.com pexels.com pixabay.com freepik.com flaticon.com iconfinder.com
      thenounproject.com lucide.dev heroicons.com fontawesome.com phosphoricons.com
      material.io m3.material.io awwwards.com siteinspire.com land-book.com lapa.ninja
      godly.website mobbin.com pageflows.com uxdesign.cc smashingmagazine.com zeroheight.com
      supernova.io muz.li envato.com creativemarket.com ui8.net uplabs.com designspiration.com
      savee.it cosmos.so are.na relume.io uizard.io screenlane.com collectui.com
      designvault.io refero.design storyset.com undraw.co blush.design iconscout.com`,
    hints: "design|dribbble|font|icons|palette|colour|color|figma",
    keywords: `figma|prototype|prototyping|wireframe|wireframes|mockup|mockups|ui kit|design system|
      design systems|typography|font|fonts|color palette|colour palette|palette|icons|icon set|
      illustration|illustrations|moodboard|logo|branding|brand guidelines|ui design|ux design|
      user interface|interaction design|layout|style guide|component library|figjam|
      visual design|product design|landing page design|dribbble|behance`,
  },
  {
    id: "research",
    name: "Research",
    emoji: "🔬",
    color: "cyan",
    aliases: "research|reading|reading list|read later|reference|references|study|papers|ux research",
    sites: `wikipedia.org wikimedia.org wiktionary.org scholar.google.com arxiv.org
      researchgate.net semanticscholar.org jstor.org sciencedirect.com springer.com nature.com
      science.org ieee.org acm.org ssrn.com ncbi.nlm.nih.gov plos.org frontiersin.org mdpi.com
      wiley.com onlinelibrary.wiley.com tandfonline.com sagepub.com academia.edu
      britannica.com statista.com ourworldindata.org pewresearch.org gartner.com forrester.com
      hbr.org medium.com substack.com archive.org books.google.com zotero.org mendeley.com
      connectedpapers.com dictionary.com merriam-webster.com thesaurus.com
      dictionary.cambridge.org translate.google.com deepl.com wolframalpha.com nngroup.com
      dovetail.com usertesting.com optimalworkshop.com maze.co surveymonkey.com hotjar.com
      lawsofux.com baymard.com uxmatters.com`,
    hints: "research|scholar|journal|science|library|wiki",
    keywords: `research|study|studies|paper|papers|journal|thesis|survey|literature review|analysis|
      whitepaper|white paper|case study|dataset|statistics|findings|citation|encyclopedia|
      usability testing|user research|user interviews|benchmark|meta-analysis|report on`,
  },
  {
    id: "healthcare",
    name: "Healthcare",
    emoji: "🩺",
    color: "red",
    aliases: "health|healthcare|health care|medical|medicine|doctor|doctors|wellness|fitness",
    sites: `webmd.com mayoclinic.org clevelandclinic.org hopkinsmedicine.org nih.gov
      pubmed.ncbi.nlm.nih.gov medlineplus.gov cdc.gov who.int nhs.uk healthline.com
      medicalnewstoday.com drugs.com rxlist.com medscape.com uptodate.com practo.com 1mg.com
      apollo247.com pharmeasy.in netmeds.com lybrate.com mfine.co zocdoc.com teladoc.com
      goodrx.com fitbit.com healthifyme.com cult.fit apollohospitals.com fortishealthcare.com
      maxhealthcare.in manipalhospitals.com narayanahealth.org medanta.org aiims.edu
      pmjay.gov.in abdm.gov.in mohfw.gov.in epic.com mychart.org cerner.com athenahealth.com
      drchrono.com practicefusion.com doximity.com fda.gov ema.europa.eu icmr.gov.in
      cochrane.org bmj.com thelancet.com nejm.org jamanetwork.com myfitnesspal.com
      strava.com headspace.com calm.com`,
    hints: "medic|health|clinic|hospital|pharma|pharmacy|doctor|dental|diagnost|therap|physio|ayurved|wellness",
    keywords: `health|healthcare|medical|medicine|medicines|doctor|doctors|clinic|clinics|hospital|
      hospitals|patient|patients|pharmacy|symptom|symptoms|diagnosis|treatment|prescription|ehr|
      emr|telemedicine|telehealth|dental|dentist|nurse|nursing|vaccine|vaccination|blood test|
      lab report|lab test|mri|x-ray|physiotherapy|ayurveda|homeopathy|cardiology|dermatology|
      pediatric|paediatric|gynecologist|orthopedic|surgery|disease|diabetes|therapy|
      health insurance|doctor appointment|medical records|hipaa`,
  },
  {
    id: "finance",
    name: "Finance",
    emoji: "💰",
    color: "green",
    aliases: "finance|finances|money|banking|bank|investing|investments|invest|tax|taxes|accounts|bills|payments",
    sites: `paypal.com stripe.com razorpay.com paytm.com phonepe.com pay.google.com wise.com
      revolut.com chase.com bankofamerica.com wellsfargo.com citi.com citibank.com
      capitalone.com americanexpress.com discover.com hsbc.com hsbc.co.in barclays.co.uk
      hdfcbank.com hdfc.com icicibank.com sbi.co.in onlinesbi.sbi onlinesbi.com sbicard.com
      axisbank.com kotak.com yesbank.in idfcfirstbank.com indusind.com pnbindia.in
      bankofbaroda.in canarabank.com unionbankofindia.co.in aubank.in federalbank.co.in
      zerodha.com groww.in upstox.com angelone.in dhan.co smallcase.com moneycontrol.com
      tickertape.in screener.in valueresearchonline.com morningstar.com morningstar.in
      investing.com tradingview.com finance.yahoo.com marketwatch.com robinhood.com
      fidelity.com vanguard.com schwab.com etrade.com coinbase.com binance.com wazirx.com
      coindcx.com kraken.com cred.club intuit.com mint.intuit.com xero.com freshbooks.com
      incometax.gov.in gst.gov.in cleartax.in policybazaar.com bankbazaar.com paisabazaar.com
      nerdwallet.com creditkarma.com experian.com cibil.com mfcentral.com camsonline.com
      kfintech.com epfindia.gov.in licindia.in acko.com godigit.com splitwise.com
      economictimes.indiatimes.com/markets economictimes.indiatimes.com/wealth`,
    hints: "bank|finance|invest|insur|loan|wealth|fintech|trading|money|mutualfund|capital",
    keywords: `bank|banking|account statement|statement|invoice|invoices|payment|payments|transaction|
      transactions|credit card|debit card|loan|loans|emi|mortgage|tax|taxes|itr|gst|income tax|
      mutual fund|mutual funds|sip|stock|stocks|shares|nifty|sensex|nasdaq|trading|investment|
      investments|investing|insurance|premium|crypto|bitcoin|ethereum|budget|expense|expenses|
      salary|payroll|upi|net banking|netbanking|fixed deposit|ipo|dividend|wallet|net worth|
      credit score|refund`,
  },
  {
    id: "travel",
    name: "Travel",
    emoji: "✈️",
    color: "orange",
    aliases: "travel|trip|trips|holiday|holidays|vacation|flights|hotels|itinerary",
    sites: `booking.com airbnb.com airbnb.co.in expedia.com hotels.com makemytrip.com goibibo.com
      cleartrip.com ixigo.com yatra.com easemytrip.com irctc.co.in redbus.in abhibus.com
      skyscanner.com skyscanner.net skyscanner.co.in kayak.com google.*/travel google.*/flights
      google.*/maps maps.google.* maps.apple.com tripadvisor.com tripadvisor.in agoda.com
      trivago.com hostelworld.com vrbo.com oyorooms.com treebo.com fabhotels.com marriott.com
      hilton.com hyatt.com ihg.com accor.com tajhotels.com itchotels.com airindia.com
      goindigo.in spicejet.com airasia.com akasaair.com emirates.com qatarairways.com
      etihad.com singaporeair.com lufthansa.com britishairways.com united.com delta.com aa.com
      southwest.com ryanair.com easyjet.com uber.com olacabs.com rapido.bike lyft.com
      rome2rio.com lonelyplanet.com viator.com getyourguide.com klook.com thrillophilia.com
      vfsglobal.com passportindia.gov.in travel.state.gov seatguru.com flightradar24.com
      flightaware.com trainman.in confirmtkt.com railyatri.in wanderlog.com tripit.com
      zoomcar.com`,
    hints: "travel|flight|hotel|holiday|tours|airline|airways|cruise",
    keywords: `flight|flights|airline|airlines|airport|hotel|hotels|resort|resorts|hostel|trip|trips|
      travel|itinerary|vacation|holiday|holidays|visa|passport|train|trains|pnr|boarding pass|
      web check-in|tour|tours|tourism|cruise|car rental|cab|beach|things to do|places to visit|
      sightseeing|hotel booking|bus tickets|train tickets|layover`,
  },
  {
    id: "social",
    name: "Social",
    emoji: "💬",
    color: "yellow",
    aliases: "social|social media|messages|messaging|chat|chats|friends|community",
    sites: `facebook.com fb.com messenger.com instagram.com threads.net threads.com twitter.com
      x.com linkedin.com reddit.com pinterest.com pinterest.co.uk pinterest.ca pinterest.in
      tiktok.com snapchat.com web.whatsapp.com whatsapp.com telegram.org web.telegram.org
      discord.com discord.gg mastodon.social bsky.app tumblr.com quora.com vk.com weibo.com
      sharechat.com meetup.com nextdoor.com producthunt.com`,
    hints: "social|forum|community",
    keywords: `tweet|tweets|retweet|followers|reels|subreddit|group chat|direct messages|
      hashtag|social media`,
  },
  {
    id: "ai",
    name: "AI",
    emoji: "✨",
    color: "grey",
    aliases: "ai|ai tools|assistants|llm|llms|chatbots|genai",
    sites: `chatgpt.com chat.openai.com openai.com claude.ai anthropic.com gemini.google.com
      bard.google.com aistudio.google.com notebooklm.google.com copilot.microsoft.com
      perplexity.ai poe.com character.ai huggingface.co midjourney.com runwayml.com
      elevenlabs.io deepseek.com mistral.ai grok.com x.ai meta.ai you.com phind.com v0.dev
      v0.app lovable.dev bolt.new cursor.com replicate.com together.ai groq.com ollama.com
      leonardo.ai ideogram.ai suno.com gamma.app jasper.ai copy.ai elicit.com consensus.app
      x.com/i/grok`,
    hints: "",
    keywords: `chatgpt|gpt|gpt-4|gpt-5|llm|llms|prompt|prompts|ai assistant|claude|gemini|copilot|
      midjourney|stable diffusion|generative ai|genai|artificial intelligence`,
  },
  {
    id: "learning",
    name: "Learning",
    emoji: "🎓",
    color: "cyan",
    aliases: "learning|learn|courses|course|study|education|classes|tutorials",
    sites: `coursera.org udemy.com edx.org khanacademy.org udacity.com skillshare.com
      pluralsight.com linkedin.com/learning duolingo.com brilliant.org codecademy.com
      datacamp.com freecodecamp.org egghead.io frontendmasters.com scrimba.com educative.io
      masterclass.com domestika.org interaction-design.org uxcel.com byjus.com unacademy.com
      vedantu.com pw.live upgrad.com simplilearn.com greatlearning.in nptel.ac.in
      swayam.gov.in ocw.mit.edu classroom.google.com instructure.com blackboard.com
      quizlet.com chegg.com studocu.com ted.com`,
    hints: "academy|course|school|tutorial|learn",
    keywords: `course|courses|tutorial|tutorials|lesson|lessons|lecture|lectures|certification|
      certificate|bootcamp|quiz|exam|exams|syllabus|online course|masterclass|workshop|webinar`,
  },
  {
    id: "shopping",
    name: "Shopping",
    emoji: "🛍️",
    color: "yellow",
    aliases: "shopping|shop|buy|orders|wishlist|groceries",
    sites: `amazon.* flipkart.com myntra.com ajio.com meesho.com nykaa.com snapdeal.com tatacliq.com
      croma.com reliancedigital.in jiomart.com bigbasket.com blinkit.com zeptonow.com
      swiggy.com zomato.com ebay.com etsy.com walmart.com target.com bestbuy.com costco.com
      aliexpress.com alibaba.com temu.com shein.com ikea.com decathlon.in lenskart.com
      firstcry.com pepperfry.com urbanladder.com apple.com/shop store.google.com
      bhphotovideo.com newegg.com wayfair.com zara.com hm.com uniqlo.com nike.com adidas.com
      adidas.co.in`,
    hints: "shop|deals|bazaar",
    keywords: `buy|cart|checkout|order|orders|shop|shopping|sale|deal|deals|discount|coupon|coupons|
      wishlist|add to cart|track order|free delivery|price drop`,
  },
  {
    id: "entertainment",
    name: "Entertainment",
    emoji: "🎬",
    color: "red",
    aliases: "entertainment|media|watch|watch later|videos|music|fun|movies|games|gaming",
    sites: `youtube.com youtu.be netflix.com primevideo.com hotstar.com jiocinema.com jiohotstar.com
      sonyliv.com zee5.com hulu.com disneyplus.com max.com hbomax.com peacocktv.com
      paramountplus.com crunchyroll.com mubi.com twitch.tv kick.com spotify.com
      music.apple.com tv.apple.com soundcloud.com gaana.com jiosaavn.com wynk.in deezer.com
      tidal.com pandora.com audible.com audible.in imdb.com rottentomatoes.com letterboxd.com
      goodreads.com steampowered.com epicgames.com roblox.com chess.com lichess.org ign.com
      gamespot.com 9gag.com vimeo.com dailymotion.com bookmyshow.com insider.in
      ticketmaster.com`,
    hints: "movie|music|game|anime|film",
    keywords: `watch|movie|movies|trailer|episode|season|series|music|song|songs|playlist|album|
      podcast|podcasts|game|gaming|livestream|live stream|anime|comedy|tv show|web series`,
  },
  {
    id: "news",
    name: "News",
    emoji: "📰",
    color: "grey",
    aliases: "news|headlines|current affairs",
    sites: `news.google.com nytimes.com washingtonpost.com theguardian.com bbc.com bbc.co.uk cnn.com
      reuters.com apnews.com aljazeera.com npr.org foxnews.com nbcnews.com cbsnews.com
      usatoday.com wsj.com ft.com economist.com bloomberg.com theverge.com techcrunch.com
      wired.com arstechnica.com engadget.com thenextweb.com news.ycombinator.com axios.com
      politico.com theatlantic.com newyorker.com time.com forbes.com businessinsider.com
      cnbc.com thehindu.com hindustantimes.com indianexpress.com indiatimes.com ndtv.com
      news18.com indiatoday.in livemint.com business-standard.com thewire.in scroll.in
      theprint.in firstpost.com deccanherald.com thequint.com inshorts.com dailyhunt.in
      news.yahoo.com msn.com flipboard.com feedly.com inoreader.com`,
    hints: "news|times|herald|gazette|tribune|chronicle",
    keywords: `news|breaking news|headlines|live updates|opinion|editorial|election|elections|
      latest news|top stories`,
  },
];

const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function categoryById(id: string): CategoryDef | undefined {
  return CATEGORY_BY_ID.get(id as CategoryId);
}

// ---------------------------------------------------------------------------
// Sites
// ---------------------------------------------------------------------------

export interface SiteInfo {
  /** Stable site id: registrable domain ("acme.co.in"), or host:port for local/IP. */
  site: string;
  /** The site's own name ("acme"). */
  label: string;
  host: string;
  /** Hostname without the public suffix ("app.acme"). */
  hostNoSuffix: string;
  /** Label without suffix of the registrable domain ("google" for mail.google.co.in). */
  domainLabel: string;
  subdomain: string;
  suffix: string;
  path: string;
  search: URLSearchParams;
  local: boolean;
}

const LOCAL_SUFFIXES = ["localhost", "local", "test", "internal", "lan", "home.arpa"];

export function siteOf(url: string): SiteInfo | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (!host) return null;

  const p = parse(host, { allowPrivateDomains: true });
  const isLocal =
    Boolean(p.isIp) ||
    LOCAL_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`)) ||
    !host.includes(".");

  if (isLocal || !p.domain || !p.domainWithoutSuffix) {
    const site = u.port ? `${host}:${u.port}` : host;
    return {
      site,
      label: host,
      host,
      hostNoSuffix: host,
      domainLabel: host,
      subdomain: "",
      suffix: "",
      path: u.pathname.toLowerCase(),
      search: u.searchParams,
      local: isLocal,
    };
  }

  const subdomain = (p.subdomain ?? "").replace(/^www\.?/, "");
  return {
    site: p.domain,
    label: p.domainWithoutSuffix,
    host,
    hostNoSuffix: subdomain ? `${subdomain}.${p.domainWithoutSuffix}` : p.domainWithoutSuffix,
    domainLabel: p.domainWithoutSuffix,
    subdomain,
    suffix: p.publicSuffix ?? "",
    path: u.pathname.toLowerCase(),
    search: u.searchParams,
    local: false,
  };
}

interface SiteRule {
  category: CategoryId;
  /** "github.com" (exact host + subdomains) or "google" with anySuffix. */
  host: string;
  anySuffix: boolean;
  path: string;
  specificity: number;
}

const RULES: SiteRule[] = CATEGORIES.flatMap((cat) =>
  cat.sites
    .split(/\s+/)
    .filter(Boolean)
    .map((entry) => {
      const slash = entry.indexOf("/");
      const hostPart = (slash >= 0 ? entry.slice(0, slash) : entry).toLowerCase();
      const path = slash >= 0 ? entry.slice(slash).toLowerCase() : "";
      const anySuffix = hostPart.endsWith(".*");
      const host = anySuffix ? hostPart.slice(0, -2) : hostPart;
      return {
        category: cat.id,
        host,
        anySuffix,
        path,
        specificity: host.split(".").length * 10 + (path ? 5 : 0) + (anySuffix ? 0 : 1),
      };
    })
);

function ruleMatches(rule: SiteRule, s: SiteInfo): boolean {
  const target = rule.anySuffix ? s.hostNoSuffix : s.host;
  if (target !== rule.host && !target.endsWith(`.${rule.host}`)) return false;
  return !rule.path || s.path.startsWith(rule.path);
}

function siteRule(s: SiteInfo): SiteRule | null {
  let best: SiteRule | null = null;
  for (const rule of RULES) {
    if (ruleMatches(rule, s) && (!best || rule.specificity > best.specificity)) best = rule;
  }
  return best;
}

const SEARCH_ENGINES = new Set(["google", "bing", "duckduckgo", "yahoo", "ecosia", "startpage", "yandex", "baidu", "brave", "qwant"]);

/** The query of a search-results page (Google, Bing, DuckDuckGo, YouTube…), if any. */
export function searchQuery(s: SiteInfo): string {
  if (SEARCH_ENGINES.has(s.domainLabel) && (s.path.startsWith("/search") || s.path === "/" || s.path === "/html/")) {
    return s.search.get("q") ?? s.search.get("p") ?? s.search.get("text") ?? s.search.get("wd") ?? "";
  }
  if (s.domainLabel === "youtube") return s.search.get("search_query") ?? "";
  return "";
}

function isSearchPage(s: SiteInfo): boolean {
  return SEARCH_ENGINES.has(s.domainLabel) && searchQuery(s) !== "";
}

// ---------------------------------------------------------------------------
// Categorising
// ---------------------------------------------------------------------------

export interface PageMeta {
  siteName?: string;
  description?: string;
  keywords?: string;
}

export interface TabSignal {
  url: string;
  title: string;
  meta?: PageMeta;
}

export type Strength = "site" | "hint" | "keyword";

export interface Categorized {
  /** "cat:design" or "site:acme.co.in" */
  key: string;
  name: string;
  emoji?: string;
  color: TabGroupColor;
  strength: Strength;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

const KEYWORD_RE = new Map(
  CATEGORIES.map((cat) => {
    const words = cat.keywords
      .split("|")
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .map(escapeRe);
    // Plurals count too ("lab test" matches "lab tests").
    return [cat.id, new RegExp(`(?<![\\p{L}\\p{N}])(?:${words.join("|")})(?:s|es)?(?![\\p{L}\\p{N}])`, "giu")];
  })
);

const HINTS = CATEGORIES.filter((c) => c.hints).map((c) => ({
  id: c.id,
  words: c.hints.split("|").map((w) => w.trim()).filter(Boolean),
}));

function distinctHits(re: RegExp, text: string, cap: number): number {
  if (!text) return 0;
  const seen = new Set<string>();
  for (const m of text.matchAll(re)) {
    seen.add(m[0].toLowerCase().replace(/e?s$/, ""));
    if (seen.size >= cap) break;
  }
  return seen.size;
}

/** "(3) Inbox — Gmail" → "Inbox — Gmail" */
function cleanTitle(title: string): string {
  return title.replace(/^\(\d+\+?\)\s*/, "").replace(/\s+/g, " ").trim();
}

function pathWords(path: string): string {
  return decodeURIComponentSafe(path).replace(/[/_\-+.=]+/g, " ");
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function asCategory(id: CategoryId, strength: Strength): Categorized {
  const c = CATEGORY_BY_ID.get(id)!;
  return { key: `cat:${c.id}`, name: c.name, emoji: c.emoji, color: c.color, strength };
}

/** Minimum score for a keyword-only match (one title word isn't enough). */
const KEYWORD_THRESHOLD = 3;
const HINT_SCORE = 3;

/** Which built-in category a tab belongs to, or null. */
export function categorize(tab: TabSignal): Categorized | null {
  const s = siteOf(tab.url);
  if (!s) return null;

  // Local dev servers.
  if (s.local) return asCategory("development", "site");

  const rule = siteRule(s);
  if (rule) return asCategory(rule.category, "site");

  const scores = new Map<CategoryId, number>();
  const hinted = new Set<CategoryId>();
  const add = (id: CategoryId, n: number) => n && scores.set(id, (scores.get(id) ?? 0) + n);
  const hint = (id: CategoryId, n: number) => {
    add(id, n);
    hinted.add(id);
  };

  // The site's own name ("emedicalls" → "medic"). Search engines say nothing about the tab.
  if (!SEARCH_ENGINES.has(s.domainLabel)) {
    const name = s.domainLabel.toLowerCase();
    for (const { id, words } of HINTS) {
      if (words.some((w) => name.includes(w))) hint(id, HINT_SCORE);
    }
    const first = s.subdomain.split(".")[0];
    if (["api", "developer", "developers", "dev", "devdocs", "sandbox", "staging"].includes(first)) hint("development", HINT_SCORE);
    else if (first === "docs") add("development", 2);
    if (/(^|\.)(edu|ac\.[a-z]{2}|edu\.[a-z]{2})$/.test(s.suffix)) hint("research", HINT_SCORE);
    if (s.suffix === "ai") add("ai", 2);
    if (/(^|\.)gov(\.[a-z]{2})?$/.test(s.suffix) && /health|medic/.test(s.host)) hint("healthcare", HINT_SCORE);
  }

  const title = cleanTitle(tab.title);
  const query = searchQuery(s);
  const path = isSearchPage(s) ? "" : pathWords(s.path);
  const meta = tab.meta ? [tab.meta.siteName, tab.meta.description, tab.meta.keywords].filter(Boolean).join(" ") : "";

  for (const cat of CATEGORIES) {
    const re = KEYWORD_RE.get(cat.id)!;
    add(cat.id, 2 * distinctHits(re, title, 3) + 2 * distinctHits(re, query, 3) + distinctHits(re, path, 2) + distinctHits(re, meta, 3));
  }

  let best: CategoryId | null = null;
  let bestScore = 0;
  for (const cat of CATEGORIES) {
    const score = scores.get(cat.id) ?? 0;
    if (score > bestScore) {
      best = cat.id;
      bestScore = score;
    }
  }
  if (!best || bestScore < KEYWORD_THRESHOLD) return null;
  return asCategory(best, hinted.has(best) ? "hint" : "keyword");
}

/** Built-in category, else the tab's site (for "same site" groups). Null for pages that can't be grouped. */
export function groupKeyForTab(tab: TabSignal): { key: string; category: Categorized | null; site: SiteInfo } | null {
  const s = siteOf(tab.url);
  if (!s) return null;
  const category = categorize(tab);
  if (category) return { key: category.key, category, site: s };
  if (isSearchPage(s)) return null; // a search with no clear topic stays where it is
  return { key: `site:${s.site}`, category: null, site: s };
}

// ---------------------------------------------------------------------------
// Site groups
// ---------------------------------------------------------------------------

const SITE_COLORS: TabGroupColor[] = ["blue", "purple", "cyan", "green", "orange", "pink", "yellow", "red", "grey"];

const alnum = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/**
 * A site's display name: the part of its tab titles that spells the site
 * ("Dashboard | eMedicalls" → "eMedicalls"), else its metadata site name,
 * else the domain name capitalised ("acme" → "Acme").
 */
export function siteName(site: SiteInfo, tabs: TabSignal[]): string {
  const want = alnum(site.label);
  for (const tab of tabs) {
    for (const part of cleanTitle(tab.title).split(/\s+[-|–—·:•]\s+/)) {
      const p = part.trim();
      if (p && p.length <= 40 && alnum(p) === want) return p;
    }
  }
  for (const tab of tabs) {
    const name = tab.meta?.siteName?.trim();
    if (name && name.length <= 40) return name;
  }
  const label = site.label.split(".").pop() ?? site.label;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function siteColor(site: string): TabGroupColor {
  let h = 0;
  for (const ch of site) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SITE_COLORS[h % SITE_COLORS.length];
}

// ---------------------------------------------------------------------------
// Existing groups
// ---------------------------------------------------------------------------

const ALIAS_TO_CATEGORY = new Map<string, CategoryId>();
for (const cat of CATEGORIES) {
  ALIAS_TO_CATEGORY.set(alnum(cat.name), cat.id);
  for (const a of cat.aliases.split("|")) {
    const k = alnum(a);
    if (k && !ALIAS_TO_CATEGORY.has(k)) ALIAS_TO_CATEGORY.set(k, cat.id);
  }
}

/** "💼 Work", "work", "Dev" → the category key it already stands for. */
export function categoryKeyFromTitle(title: string): string | null {
  const { name } = splitGroupTitle(title);
  const id = ALIAS_TO_CATEGORY.get(alnum(name));
  return id ? `cat:${id}` : null;
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

export interface PlanTab {
  id: number;
  windowId: number;
  index: number;
  groupId: number;
  url: string;
  title: string;
  pinned: boolean;
  lastAccessed?: number;
  favicon?: string;
  meta?: PageMeta;
}

export interface PlanGroupInfo {
  id: number;
  windowId: number;
  title: string;
}

export interface PlannedGroup {
  key: string;
  name: string;
  emoji?: string;
  color: TabGroupColor;
  windowId: number;
  /** Join this existing group instead of creating one. */
  groupId?: number;
  /** Title for a new group. */
  title: string;
  tabIds: number[];
  /** Most recent activity among its tabs — newest groups first. */
  newest: number;
}

export interface AutoGroupPlan {
  groups: PlannedGroup[];
  /** Tabs that would move into a group. */
  tabCount: number;
  /** Tabs already in a group of yours — left exactly where they are. */
  keptInGroups: number;
}

export interface PlanInput {
  tabs: PlanTab[];
  groups: PlanGroupInfo[];
  /** Tabs the user placed by hand — never moved. */
  manualTabIds?: Iterable<number>;
  /** Groups this feature made or joined, by id (so a renamed group keeps its category). */
  knownGroupKeys?: Record<number, string>;
  /** A new group needs at least this many tabs (joining an existing one needs 1). */
  minGroupSize?: number;
}

export const MIN_GROUP_SIZE = 2;

const recency = (t: PlanTab) => t.lastAccessed ?? t.id;

/**
 * The key an existing group already stands for: one we made/joined, a title
 * that names a category ("Work", "💻 Dev"), or the name of the site its tabs
 * are on ("Acme" holding acme.com tabs). Null = the user's own group.
 */
export function resolveGroupKey(group: PlanGroupInfo, tabsInGroup: PlanTab[], known?: Record<number, string>): string | null {
  const byTitle = categoryKeyFromTitle(group.title);
  if (byTitle) return byTitle;
  const remembered = known?.[group.id];
  if (remembered) return remembered;
  const { name } = splitGroupTitle(group.title);
  const want = alnum(name);
  if (!want) return null;
  const sites = tabsInGroup.map((t) => siteOf(t.url)).filter((s): s is SiteInfo => s !== null);
  const match = sites.find((s) => alnum(s.label) === want || alnum(siteName(s, tabsInGroup)) === want);
  return match ? `site:${match.site}` : null;
}

/** What "Group tabs" would do: every loose tab into its category, nothing else touched. */
export function planAutoGroups(input: PlanInput): AutoGroupPlan {
  const manual = new Set(input.manualTabIds ?? []);
  const min = input.minGroupSize ?? MIN_GROUP_SIZE;
  const planned: PlannedGroup[] = [];
  let keptInGroups = 0;

  const windows = new Set(input.tabs.map((t) => t.windowId));
  for (const windowId of windows) {
    const tabs = input.tabs.filter((t) => t.windowId === windowId);
    const groups = input.groups.filter((g) => g.windowId === windowId);

    // Existing groups by the key they stand for (the biggest wins on duplicates).
    const existing = new Map<string, { id: number; size: number }>();
    for (const g of groups) {
      const inside = tabs.filter((t) => t.groupId === g.id);
      keptInGroups += inside.length;
      const key = resolveGroupKey(g, inside, input.knownGroupKeys);
      if (!key) continue;
      const prev = existing.get(key);
      if (!prev || inside.length > prev.size) existing.set(key, { id: g.id, size: inside.length });
    }

    const buckets = new Map<string, { tabs: PlanTab[]; category: Categorized | null; site: SiteInfo }>();
    for (const tab of tabs) {
      if (tab.groupId !== -1 || tab.pinned || manual.has(tab.id)) continue;
      const k = groupKeyForTab(tab);
      if (!k) continue;
      const bucket = buckets.get(k.key) ?? { tabs: [], category: k.category, site: k.site };
      bucket.tabs.push(tab);
      buckets.set(k.key, bucket);
    }

    for (const [key, bucket] of buckets) {
      const join = existing.get(key);
      if (!join && bucket.tabs.length < min) continue;
      const sorted = [...bucket.tabs].sort((a, b) => recency(b) - recency(a));
      const name = bucket.category?.name ?? siteName(bucket.site, sorted);
      const emoji = bucket.category?.emoji;
      planned.push({
        key,
        name,
        emoji,
        color: bucket.category?.color ?? siteColor(bucket.site.site),
        windowId,
        groupId: join?.id,
        title: buildGroupTitle(name, emoji),
        tabIds: sorted.map((t) => t.id),
        newest: recency(sorted[0]),
      });
    }
  }

  planned.sort((a, b) => b.newest - a.newest);
  return {
    groups: planned,
    tabCount: planned.reduce((n, g) => n + g.tabIds.length, 0),
    keptInGroups,
  };
}
