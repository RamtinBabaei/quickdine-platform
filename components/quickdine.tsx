"use client";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  lazy,
  Suspense,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Search,
  MapPin,
  CalendarDays,
  Users,
  Star,
  UtensilsCrossed,
  Fish,
  Leaf,
  Beef,
  Building2,
  Croissant,
  Menu,
  X,
  Check,
  ShieldCheck,
  Clock,
  ChevronRight,
  ArrowLeft,
  LogOut,
  LayoutDashboard,
} from "lucide-react";
import type {
  Restaurant,
  User,
  Booking,
  Availability,
  Role,
} from "../domain/types";
import { filterRestaurants } from "../domain/discovery";
const Management = lazy(() => import("./management"));
export async function api<T>(
  path: string,
  body?: unknown,
  method = "POST",
): Promise<T> {
  const res = await fetch(
    "/api/" + path,
    body === undefined
      ? { credentials: "same-origin" }
      : {
          method,
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await res.json();
  if (!res.ok)
    throw new Error(
      typeof data === "object" && data !== null && "error" in data
        ? String(data.error)
        : "Request failed",
    );
  return data as T;
}
export const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};
export const prettyDate = (date: string) =>
  new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <UtensilsCrossed size={32} />
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function Spinner() {
  return (
    <div className="loading" role="status">
      <span className="spinner" /> Finding something exceptional…
    </div>
  );
}
export function ReservationCard({
  booking: b,
  onChange,
  manager = false,
}: {
  booking: Booking;
  onChange: (id: string, status: "confirmed" | "cancelled") => void;
  manager?: boolean;
}) {
  return (
    <article className="reservation-card">
      <img src={b.image} alt="" width="160" height="130" loading="lazy" />
      <div className="grow">
        <div className="flex justify-between gap-4">
          <p className="eyebrow">{b.id}</p>
          <span className={"status " + b.status}>{b.status}</span>
        </div>
        <h3>{b.restaurantName}</h3>
        <p className="muted">
          {prettyDate(b.date)} · {b.time} · {b.guests} guests
        </p>
        {manager && (
          <p className="small">
            {b.name} · {b.email}
          </p>
        )}
        {b.occasion && <p className="small">Occasion: {b.occasion}</p>}
        {b.requests && <p className="small">Note: {b.requests}</p>}
        <div className="flex gap-4 mt-4">
          {manager && b.status === "pending" && (
            <button
              className="text-link"
              onClick={() => onChange(b.id, "confirmed")}
            >
              Confirm reservation <Check size={14} />
            </button>
          )}
          {b.status !== "cancelled" && (
            <button
              className="text-link text-red-700"
              onClick={() => onChange(b.id, "cancelled")}
            >
              Cancel reservation
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
const cuisines = [
  ["Italian", UtensilsCrossed],
  ["Japanese", Fish],
  ["French", Croissant],
  ["Rooftop", Building2],
  ["Steakhouse", Beef],
  ["Vegetarian", Leaf],
] as const;
export default function QuickDine() {
  const router = useRouter();
  const pathname = usePathname();
  const path = pathname ?? "/";
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [demoEnabled, setDemoEnabled] = useState(false);
  const [auth, setAuth] = useState<"login" | "register" | null>(null);
  const [toast, setToast] = useState("");
  const [mobile, setMobile] = useState(false);
  const [version, setVersion] = useState(0);
  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    let active = true;
    Promise.all([
      api<{ restaurants: Restaurant[] }>("restaurants"),
      api<{ user: User | null; demoEnabled: boolean }>("me"),
    ])
      .then(([r, m]) => {
        if (active) {
          setRestaurants(r.restaurants);
          setUser(m.user);
          setDemoEnabled(m.demoEnabled);
          setLoadError("");
        }
      })
      .catch((e) => {
        if (active) setLoadError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [version]);
  const refresh = () => setVersion((v) => v + 1);
  async function demo(role: Role) {
    try {
      const d = await api<{ user: User }>("auth/demo", { role });
      setUser(d.user);
      refresh();
      router.push(role === "user" ? "/search" : "/manage");
      notify("Your private demo workspace is ready.");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function logout() {
    try {
      await api("auth/logout", {});
      setUser(null);
      refresh();
      router.push("/");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  const restaurant = path.startsWith("/restaurant/")
    ? restaurants.find((r) => r.slug === path.split("/")[2])
    : null;
  const isHome = path === "/";
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className={"header " + (isHome ? "over-hero" : "")}>
        <div className="nav-wrap">
          <Link className="brand" href="/" aria-label="QuickDine home">
            <UtensilsCrossed size={24} />
            <span>
              QuickDine<span className="brand-dot">.</span>
            </span>
          </Link>
          <nav
            className={"nav " + (mobile ? "nav-open" : "")}
            aria-label="Main navigation"
          >
            <Link
              href="/"
              className={isHome ? "active" : ""}
              onClick={() => setMobile(false)}
            >
              Discover
            </Link>
            <Link
              href="/search"
              className={path === "/search" ? "active" : ""}
              onClick={() => setMobile(false)}
            >
              Restaurants
            </Link>
            <button
              onClick={() => {
                setMobile(false);
                if (user) router.push("/bookings");
                else setAuth("login");
              }}
            >
              My bookings
            </button>
            {user && user.role !== "user" && (
              <Link href="/manage">Management</Link>
            )}
          </nav>
          <div className="nav-actions">
            {user ? (
              <>
                <span className="user-name">{user.name.split(" ")[0]}</span>
                <button aria-label="Sign out" onClick={logout}>
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <>
                <button className="sign-in" onClick={() => setAuth("login")}>
                  Sign in
                </button>
                <button
                  className="btn nav-signup"
                  onClick={() => setAuth("register")}
                >
                  Sign up <ArrowRight size={14} />
                </button>
              </>
            )}
            <button
              className="mobile-toggle"
              aria-label="Toggle menu"
              aria-expanded={mobile}
              onClick={() => setMobile(!mobile)}
            >
              {mobile ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      {user?.demo ? (
        <div className="demo-banner">
          <ShieldCheck size={14} /> Portfolio demo · Your changes are saved in
          an isolated workspace <button onClick={logout}>Exit demo</button>
        </div>
      ) : (
        <div className="demo-banner">
          <UtensilsCrossed size={13} /> Portfolio demo · Illustrative
          restaurants. No real tables are reserved.
        </div>
      )}
      <main id="main">
        {loadError ? (
          <div className="page">
            <Empty title="We couldn’t load the dining room">
              <p>{loadError}</p>
              <button className="btn" onClick={refresh}>
                Try again
              </button>
            </Empty>
          </div>
        ) : isHome ? (
          <>
            <section className="hero">
              <img
                src="/images/hero.webp"
                srcSet="/images/hero-768.webp 768w, /images/hero-1200.webp 1200w, /images/hero.webp 1800w"
                sizes="100vw"
                alt="An elegant candlelit restaurant dining room"
                width="1800"
                height="1200"
                fetchPriority="high"
              />
              <div className="hero-shade" />
              <div className="hero-content">
                <p className="eyebrow gold">
                  <span /> EXQUISITE DINING EXPERIENCES
                </p>
                <h1>
                  Curation for the
                  <br />
                  discerning <em>palate.</em>
                </h1>
                <p className="hero-sub">
                  Remarkable restaurants. Exceptional moments. Your table
                  awaits.
                </p>
                <SearchForm
                  onSearch={(params) => router.push("/search?" + params)}
                />
                <div className="hero-trust">
                  <span>
                    <ShieldCheck size={15} /> Handpicked restaurants
                  </span>
                  <span>
                    <Check size={15} /> No booking fees
                  </span>
                  <span>
                    <Clock size={15} /> Real-time availability
                  </span>
                </div>
              </div>
              <div className="hero-bottom">
                <span>GOOD TASTE STARTS HERE</span>
                <span>SCROLL TO DISCOVER ↓</span>
              </div>
            </section>
            <section className="section cuisine-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">CURATED SELECTION</p>
                  <h2>
                    A world of <em>flavor.</em>
                  </h2>
                </div>
                <Link className="text-link" href="/search">
                  Explore all <ArrowRight size={17} />
                </Link>
              </div>
              <div className="cuisine-grid">
                {cuisines.map(([name, Icon]) => (
                  <Link
                    key={name}
                    href={"/search?cuisine=" + name}
                    className="cuisine-tile"
                  >
                    <Icon size={29} strokeWidth={1.25} />
                    <span>{name === "Japanese" ? "Sushi" : name}</span>
                  </Link>
                ))}
              </div>
            </section>
            <section className="section pt-0">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">
                    THE TABLES EVERYONE IS TALKING ABOUT
                  </p>
                  <h2>
                    Trending fine <em>dining.</em>
                  </h2>
                </div>
                <Link className="text-link" href="/search">
                  View collection <ArrowRight size={17} />
                </Link>
              </div>
              {loading ? (
                <Spinner />
              ) : (
                <div className="restaurant-grid">
                  {restaurants
                    .filter((r) => r.featured)
                    .slice(0, 3)
                    .map((r) => (
                      <RestaurantCard key={r.id} restaurant={r} />
                    ))}
                </div>
              )}
            </section>
            <section className="membership section">
              <div className="membership-photo">
                <img
                  src="/images/membership.webp"
                  alt="Chef plating an exquisite fine dining dish"
                  width="1000"
                  height="900"
                  loading="lazy"
                />
                <span>THE ART OF DINING WELL</span>
              </div>
              <div className="membership-copy">
                <p className="eyebrow gold">BEYOND THE RESERVATION</p>
                <h2>
                  Some evenings
                  <br />
                  deserve something
                  <br />
                  <em>extraordinary.</em>
                </h2>
                <p>
                  Find the intimate chef’s counter, the rooftop at golden hour,
                  the table you’ll remember. We bring the most remarkable dining
                  rooms a little closer.
                </p>
                <div className="member-feature">
                  <UtensilsCrossed />
                  <div>
                    <h4>Thoughtfully curated</h4>
                    <p>Distinctive venues with a story worth discovering.</p>
                  </div>
                </div>
                <div className="member-feature">
                  <CalendarDays />
                  <div>
                    <h4>Your evening, effortless</h4>
                    <p>
                      Live availability and all your reservations in one place.
                    </p>
                  </div>
                </div>
                <Link className="btn light" href="/search">
                  Find your next experience <ArrowRight size={16} />
                </Link>
              </div>
            </section>
            {demoEnabled && (
              <section className="section demo-section">
                <p className="eyebrow">BUILT FOR EVERY SIDE OF THE TABLE</p>
                <h2>
                  Take a seat. <em>Try the experience.</em>
                </h2>
                <p className="muted">
                  Explore working reservations and hospitality tools in your own
                  private demo.
                </p>
                <div className="demo-grid">
                  {(["user", "owner", "admin"] as Role[]).map((r, i) => (
                    <button
                      className="demo-card"
                      key={r}
                      onClick={() => demo(r)}
                    >
                      {i === 0 ? (
                        <Users />
                      ) : i === 1 ? (
                        <UtensilsCrossed />
                      ) : (
                        <LayoutDashboard />
                      )}
                      <h3>
                        {
                          [
                            "The diner",
                            "The restaurateur",
                            "The administrator",
                          ][i]
                        }
                      </h3>
                      <p>
                        {
                          [
                            "Find a table and manage your reservations.",
                            "List a venue and manage incoming bookings.",
                            "Review submissions and monitor the platform.",
                          ][i]
                        }
                      </p>
                      <span className="text-link">
                        Explore {r === "user" ? "diner" : r} demo{" "}
                        <ArrowRight size={16} />
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
            <Newsletter notify={notify} />
          </>
        ) : path === "/search" ? (
          <SearchPage restaurants={restaurants} loading={loading} />
        ) : restaurant ? (
          <RestaurantPage
            restaurant={restaurant}
            user={user}
            onSignIn={() => setAuth("login")}
            notify={notify}
          />
        ) : path === "/bookings" ? (
          <BookingsPage
            user={user}
            onSignIn={() => setAuth("login")}
            notify={notify}
          />
        ) : path === "/manage" ? (
          <Suspense fallback={<Spinner />}>
            <Management user={user} notify={notify} refresh={refresh} />
          </Suspense>
        ) : loading ? (
          <Spinner />
        ) : path.startsWith("/info/") ? (
          <InfoPage slug={path.split("/")[2]} />
        ) : (
          <div className="page">
            <Empty title="This table hasn’t been set">
              <Link className="btn" href="/search">
                Discover restaurants
              </Link>
            </Empty>
          </div>
        )}
      </main>
      <Footer />
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {auth && (
        <AuthModal
          mode={auth}
          setMode={setAuth}
          onSuccess={(u) => {
            setUser(u);
            setAuth(null);
            refresh();
            notify("Welcome, " + u.name.split(" ")[0] + ".");
          }}
        />
      )}
    </>
  );
}
function SearchForm({
  onSearch,
  compact = false,
}: {
  onSearch: (params: string) => void;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(tomorrow);
  const [guests, setGuests] = useState("2");
  return (
    <form
      className={"search-form " + (compact ? "compact" : "")}
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(
          new URLSearchParams({ q: query, location, date, guests }).toString(),
        );
      }}
    >
      <label>
        <Search size={19} />
        <span className="sr-only">Restaurant or cuisine</span>
        <input
          placeholder="Restaurant or cuisine"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <label>
        <MapPin size={19} />
        <span className="sr-only">Location</span>
        <input
          placeholder="Manhattan, New York"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </label>
      <label className="date-field">
        <CalendarDays size={18} />
        <span className="sr-only">Dining date</span>
        <input
          type="date"
          value={date}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <label className="guests-field">
        <Users size={18} />
        <span className="sr-only">Party size</span>
        <select value={guests} onChange={(e) => setGuests(e.target.value)}>
          {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "guest" : "guests"}
            </option>
          ))}
        </select>
      </label>
      <button className="btn" type="submit">
        Find a table <ArrowRight size={16} />
      </button>
    </form>
  );
}
function RestaurantCard({
  restaurant: r,
  date,
  guests,
}: {
  restaurant: Restaurant;
  date?: string;
  guests?: string;
}) {
  return (
    <Link
      className="restaurant-card"
      href={
        "/restaurant/" +
        r.slug +
        (date ? "?" + new URLSearchParams({ date, guests: guests ?? "2" }) : "")
      }
    >
      <div className="card-photo">
        <img
          src={r.image}
          srcSet={
            r.image.startsWith("/images/")
              ? `${r.image.replace(".webp", "-450.webp")} 450w, ${r.image} 900w`
              : undefined
          }
          sizes="(max-width: 600px) 88vw, (max-width: 800px) 44vw, 30vw"
          alt={r.name + " dining room"}
          width="900"
          height="600"
          loading="lazy"
        />
        {r.featured && <span className="card-badge">CURATOR’S CHOICE</span>}
        <span className="card-arrow">
          <ArrowRight size={20} />
        </span>
      </div>
      <div className="card-meta">
        <span>
          {r.cuisine} <span className="dot">·</span> {"$".repeat(r.price)}
        </span>
        <span className="rating">
          <Star size={13} fill="currentColor" />
          {r.rating || "New"}
        </span>
      </div>
      <h3>{r.name}</h3>
      <p className="card-location">
        <MapPin size={13} />
        {r.location}
      </p>
      <div className="card-bottom">
        <span>{r.tags[0] ?? "New opening"}</span>
        <span>
          Reserve a table <ChevronRight size={13} />
        </span>
      </div>
    </Link>
  );
}
function SearchPage({
  restaurants,
  loading,
}: {
  restaurants: Restaurant[];
  loading: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [location, setLocation] = useState(params.get("location") ?? "");
  const [cuisine, setCuisine] = useState(params.get("cuisine") ?? "");
  const [price, setPrice] = useState(0);
  const [rating, setRating] = useState(0);
  const [sort, setSort] = useState("recommended");
  const [date, setDate] = useState(params.get("date") ?? tomorrow());
  const [guests, setGuests] = useState(params.get("guests") ?? "2");
  const filtered = filterRestaurants(
    restaurants,
    query,
    cuisine,
    location,
    price,
    rating,
  ).sort((a, b) =>
    sort === "rating"
      ? b.rating - a.rating
      : sort === "price"
        ? a.price - b.price
        : 0,
  );
  return (
    <div className="page">
      <div className="page-intro">
        <p className="eyebrow">DISCOVER YOUR NEXT FAVORITE</p>
        <h1>
          Extraordinary tables.
          <br />
          <em>Yours to discover.</em>
        </h1>
        <p className="muted">
          A thoughtfully chosen collection of exceptional dining experiences.
        </p>
      </div>
      <div className="search-layout">
        <aside className="filter-panel">
          <div className="flex justify-between items-center">
            <h3>Refine your search</h3>
            <button
              className="text-link"
              onClick={() => {
                setQuery("");
                setLocation("");
                setCuisine("");
                setPrice(0);
                setRating(0);
              }}
            >
              Reset
            </button>
          </div>
          <label className="field">
            Search
            <input
              placeholder="Restaurant or cuisine"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="field">
            Location
            <input
              placeholder="City or neighborhood"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </label>
          <label className="field">
            Cuisine
            <select
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
            >
              <option value="">All cuisines</option>
              {cuisines.map(([c]) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Price range
            <select value={price} onChange={(e) => setPrice(+e.target.value)}>
              <option value={0}>Any price</option>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {"$".repeat(n)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Minimum rating
            <select value={rating} onChange={(e) => setRating(+e.target.value)}>
              <option value={0}>All ratings</option>
              <option value={4.5}>4.5 and above</option>
              <option value={4.8}>4.8 and above</option>
            </select>
          </label>
          <label className="field">
            Dining date
            <input
              type="date"
              value={date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="field">
            Guests
            <select value={guests} onChange={(e) => setGuests(e.target.value)}>
              {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                <option key={n} value={n}>
                  {n} guests
                </option>
              ))}
            </select>
          </label>
        </aside>
        <div>
          <div className="results-header">
            <p>
              <strong>{filtered.length}</strong> exceptional restaurants
            </p>
            <label>
              Sort by{" "}
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="recommended">Recommended</option>
                <option value="rating">Highest rated</option>
                <option value="price">Price: low to high</option>
              </select>
            </label>
          </div>
          {loading ? (
            <Spinner />
          ) : filtered.length ? (
            <div className="restaurant-grid search-results">
              {filtered.map((r) => (
                <RestaurantCard
                  key={r.id}
                  restaurant={r}
                  date={date}
                  guests={guests}
                />
              ))}
            </div>
          ) : (
            <Empty title="A different flavor awaits">
              <p>Try a different cuisine, location, or price range.</p>
              <button
                className="btn"
                onClick={() => {
                  setQuery("");
                  setLocation("");
                  setCuisine("");
                  setPrice(0);
                  setRating(0);
                  router.replace("/search");
                }}
              >
                Clear filters
              </button>
            </Empty>
          )}
        </div>
      </div>
    </div>
  );
}
function RestaurantPage({
  restaurant: r,
  user,
  onSignIn,
  notify,
}: {
  restaurant: Restaurant;
  user: User | null;
  onSignIn: () => void;
  notify: (s: string) => void;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [date, setDate] = useState(params.get("date") ?? tomorrow());
  const [guests, setGuests] = useState(Number(params.get("guests")) || 2);
  const [slots, setSlots] = useState<Availability[]>([]);
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [occasion, setOccasion] = useState("");
  const [requests, setRequests] = useState("");
  const [busy, setBusy] = useState(false);
  const [bookingId, setBookingId] = useState("");
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        setLoading(true);
        setTime("");
        setError("");
      }
    });
    api<{ slots: Availability[] }>(
      "availability?" +
        new URLSearchParams({
          restaurantId: r.id,
          date,
          guests: String(guests),
        }),
    )
      .then((d) => {
        if (active) setSlots(d.slots);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [r.id, date, guests]);
  async function reserve(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      onSignIn();
      return;
    }
    setBusy(true);
    try {
      const data = await api<{ id: string }>("bookings", {
        restaurantId: r.id,
        date,
        time,
        guests,
        occasion,
        requests,
      });
      setBookingId(data.id);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="detail-photo">
        <img
          src={r.image}
          alt={r.name + " restaurant interior"}
          width="1800"
          height="1000"
          fetchPriority="high"
        />
        <div />
        <Link href="/search" className="back-link">
          <ArrowLeft size={16} /> All restaurants
        </Link>
        <div className="detail-title">
          <p className="eyebrow">
            {r.cuisine} · {"$".repeat(r.price)} · {r.location}
          </p>
          <h1>{r.name}</h1>
          <p>
            <Star size={15} fill="currentColor" /> {r.rating || "New opening"}{" "}
            <span>Thoughtfully selected by QuickDine</span>
          </p>
        </div>
      </div>
      <div className="page detail-grid">
        <div>
          <p className="eyebrow">A SENSE OF PLACE</p>
          <h2>
            An evening to <em>remember.</em>
          </h2>
          <p className="description">{r.description}</p>
          <div className="tags">
            {r.tags.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
          <div className="detail-facts">
            <div>
              <UtensilsCrossed />
              <p className="eyebrow">AT THE HELM</p>
              <h4>Chef {r.chef}</h4>
            </div>
            <div>
              <MapPin />
              <p className="eyebrow">FIND US</p>
              <h4>{r.address}</h4>
            </div>
            <div>
              <Clock />
              <p className="eyebrow">DINNER SERVICE</p>
              <h4>
                {r.slots[0]} — {r.slots[r.slots.length - 1]}
              </h4>
            </div>
          </div>
          <div className="policy-box">
            <ShieldCheck />
            <div>
              <h4>A little peace of mind.</h4>
              <p>
                Your table request is saved instantly. The restaurant confirms
                your reservation. You can cancel from My bookings at any time.
                No payment is collected.
              </p>
            </div>
          </div>
        </div>
        <aside className="booking-widget">
          {bookingId ? (
            <div className="booking-success">
              <span className="success-icon">
                <Check size={32} />
              </span>
              <p className="eyebrow">YOU’RE ON THE LIST</p>
              <h2>
                Your evening
                <br />
                <em>starts here.</em>
              </h2>
              <p>Your request at {r.name} has been received.</p>
              <strong>{bookingId}</strong>
              <p>
                {prettyDate(date)} · {time}
                <br />
                {guests} guests · Awaiting confirmation
              </p>
              <button className="btn" onClick={() => router.push("/bookings")}>
                View my bookings <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <form onSubmit={reserve}>
              <p className="eyebrow">YOUR TABLE AWAITS</p>
              <h3>Make a reservation</h3>
              <div className="booking-fields">
                <label className="field">
                  Date
                  <input
                    required
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
                <label className="field">
                  Party size
                  <select
                    value={guests}
                    onChange={(e) => setGuests(+e.target.value)}
                  >
                    {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                      <option key={n} value={n}>
                        {n} guests
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="field-title">Available times</p>
              {loading ? (
                <Spinner />
              ) : error ? (
                <p role="alert" className="error">
                  {error}
                </p>
              ) : slots.length ? (
                <div className="time-slots">
                  {slots.map((s) => (
                    <button
                      type="button"
                      key={s.time}
                      className={time === s.time ? "selected" : ""}
                      onClick={() => setTime(s.time)}
                      aria-pressed={time === s.time}
                    >
                      {s.time}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted">
                  No tables for this party size. Try another date.
                </p>
              )}
              <label className="field">
                Occasion <span className="muted">(optional)</span>
                <select
                  value={occasion}
                  onChange={(e) => setOccasion(e.target.value)}
                >
                  <option value="">Just a lovely evening</option>
                  <option>Birthday</option>
                  <option>Anniversary</option>
                  <option>Date night</option>
                  <option>Business dinner</option>
                </select>
              </label>
              <label className="field">
                Special requests <span className="muted">(optional)</span>
                <textarea
                  maxLength={1000}
                  rows={3}
                  placeholder="Dietary needs, seating preferences…"
                  value={requests}
                  onChange={(e) => setRequests(e.target.value)}
                />
              </label>
              <button
                className="btn w-full"
                disabled={!time || busy || loading}
              >
                {busy
                  ? "Reserving your table…"
                  : user
                    ? "Request reservation"
                    : "Sign in to reserve"}{" "}
                <ArrowRight size={16} />
              </button>
              <p className="booking-disclaimer">
                <ShieldCheck size={13} /> No booking fees. No payment required.
              </p>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
function BookingsPage({
  user,
  onSignIn,
  notify,
}: {
  user: User | null;
  onSignIn: () => void;
  notify: (s: string) => void;
}) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    if (user)
      api<{ bookings: Booking[] }>("bookings")
        .then((d) => {
          if (active) setBookings(d.bookings);
        })
        .catch((e) => notify(e.message))
        .finally(() => {
          if (active) setLoading(false);
        });
    return () => {
      active = false;
    };
  }, [user, version, notify]);
  async function update(id: string, status: "confirmed" | "cancelled") {
    try {
      await api("bookings/" + id, { status }, "PATCH");
      setVersion((v) => v + 1);
      notify("Reservation updated.");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  const visible = bookings.filter(
    (b) => filter === "all" || b.status === filter,
  );
  return (
    <div className="page narrow">
      <p className="eyebrow">YOUR DINING JOURNAL</p>
      <h1>
        Good evenings.
        <br />
        <em>All in one place.</em>
      </h1>
      <p className="muted mb-8">Your upcoming tables and memorable moments.</p>
      {!user ? (
        <Empty title="Your reservations are waiting">
          <button className="btn" onClick={onSignIn}>
            Sign in to view bookings
          </button>
        </Empty>
      ) : (
        <>
          <div className="tabs">
            {["all", "pending", "confirmed", "cancelled"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={filter === f ? "selected" : ""}
              >
                {f}
              </button>
            ))}
          </div>
          {loading ? (
            <Spinner />
          ) : visible.length ? (
            <div className="booking-list">
              {visible.map((b) => (
                <ReservationCard key={b.id} booking={b} onChange={update} />
              ))}
            </div>
          ) : (
            <Empty title="Your next great evening is ahead">
              <p>When you reserve a table, you’ll find it here.</p>
              <Link className="btn" href="/search">
                Find a table <ArrowRight size={16} />
              </Link>
            </Empty>
          )}
        </>
      )}
    </div>
  );
}
function AuthModal({
  mode,
  setMode,
  onSuccess,
}: {
  mode: "login" | "register";
  setMode: (v: "login" | "register" | null) => void;
  onSuccess: (u: User) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const data = await api<{ user: User }>("auth/" + mode, {
        email: f.get("email"),
        password: f.get("password"),
        ...(mode === "register"
          ? { name: f.get("name"), role: f.get("owner") ? "owner" : "user" }
          : {}),
      });
      onSuccess(data.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="auth-dialog"
      aria-labelledby="auth-title"
      onCancel={() => setMode(null)}
      onClick={(e) => {
        if (e.target === dialog.current) setMode(null);
      }}
    >
      <button
        className="dialog-close"
        aria-label="Close sign in"
        onClick={() => setMode(null)}
      >
        <X size={20} />
      </button>
      <div className="brand">
        <UtensilsCrossed size={22} />
        QuickDine.
      </div>
      <p className="eyebrow mt-8">A SEAT AT SOMETHING SPECIAL</p>
      <h2 id="auth-title">
        {mode === "login" ? "Welcome back." : "Your table awaits."}
      </h2>
      <div className="tabs">
        {(["login", "register"] as const).map((m) => (
          <button
            type="button"
            key={m}
            className={mode === m ? "selected" : ""}
            onClick={() => {
              setMode(m);
              setError("");
            }}
          >
            {m === "login" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>
      <form onSubmit={submit}>
        {mode === "register" && (
          <label className="field">
            Full name
            <input
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={80}
            />
          </label>
        )}
        <label className="field">
          Email address
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            name="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            required
            minLength={10}
            maxLength={128}
          />
        </label>
        {mode === "register" && (
          <>
            <p className="small muted">Use at least 10 characters.</p>
            <label className="checkbox-label">
              <input type="checkbox" name="owner" /> I manage a restaurant
            </label>
          </>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="btn w-full mt-6" disabled={busy}>
          {busy
            ? "Please wait…"
            : mode === "login"
              ? "Sign in"
              : "Create account"}{" "}
          <ArrowRight size={16} />
        </button>
      </form>
      <p className="small muted mt-5">
        By continuing, you accept our{" "}
        <Link href="/info/terms" onClick={() => setMode(null)}>
          terms of use
        </Link>
        .
      </p>
    </dialog>
  );
}
function Newsletter({ notify }: { notify: (s: string) => void }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await api("newsletter", { email: f.get("email") });
      setDone(true);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="newsletter section">
      <div>
        <p className="eyebrow">ALWAYS IN GOOD TASTE</p>
        <h2>
          A little inspiration.
          <br />
          <em>Delivered occasionally.</em>
        </h2>
        <p className="muted">
          Join the list for new openings and seasonal dining discoveries.
        </p>
      </div>
      {done ? (
        <p className="newsletter-success" role="status">
          <Check /> You’re on the list. Your preference is saved.
        </p>
      ) : (
        <form onSubmit={submit}>
          <label className="sr-only" htmlFor="newsletter-email">
            Email address
          </label>
          <input
            id="newsletter-email"
            name="email"
            type="email"
            required
            placeholder="Your email address"
            maxLength={254}
          />
          <button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Join the list"} <ArrowRight size={18} />
          </button>
        </form>
      )}
    </section>
  );
}
function Footer() {
  return (
    <footer className="footer section">
      <div className="footer-top">
        <div>
          <Link href="/" className="brand">
            <UtensilsCrossed size={24} />
            QuickDine.
          </Link>
          <p>
            For the love of good food.
            <br />
            And the moments around it.
          </p>
        </div>
        <div>
          <p className="eyebrow">EXPLORE</p>
          <Link href="/search">Our restaurants</Link>
          <Link href="/bookings">My reservations</Link>
          <Link href="/info/about">About QuickDine</Link>
        </div>
        <div>
          <p className="eyebrow">FOR RESTAURATEURS</p>
          <Link href="/info/partner">Partner with us</Link>
          <Link href="/manage">Management portal</Link>
          <Link href="/info/privacy">Privacy policy</Link>
        </div>
        <div className="footer-note">
          <span>MADE FOR MEMORABLE EVENINGS</span>
          <UtensilsCrossed size={38} strokeWidth={1} />
        </div>
      </div>
      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()} QuickDine. A portfolio application by
          Ramtin Babaei.
        </span>
        <Link href="/info/terms">Terms of use</Link>
        <Link href="/info/privacy">Privacy</Link>
      </div>
    </footer>
  );
}
function InfoPage({ slug }: { slug: string }) {
  const content: Record<string, [string, string[]]> = {
    about: [
      "A love of extraordinary dining.",
      [
        "QuickDine is a full-stack portfolio application by Ramtin Babaei, inspired by the GreatStack multi-restaurant reference. Its restaurant listings are illustrative, and reservations made here are demonstration records.",
        "Discover curated venues, check capacity, and explore reservation management across diner, restaurant owner, and administrator roles.",
      ],
    ],
    partner: [
      "Give your restaurant a place at the table.",
      [
        "Create an account and select “I manage a restaurant”. Then open the Management portal to submit your venue, service details, and capacity.",
        "Restaurant submissions are reviewed by an administrator. Once approved, your venue appears in discovery and can accept reservations. Profile edits return your venue to review.",
      ],
    ],
    terms: [
      "Terms of use",
      [
        "This is a portfolio demonstration. Restaurants and reservations are illustrative. No real table is reserved, no payment is accepted, and no restaurant is contacted.",
        "You may create an account to explore the application. Do not submit sensitive or payment information. Demo workspaces are isolated from the shared registered-user workspace.",
      ],
    ],
    privacy: [
      "Your privacy, considered.",
      [
        "The application stores the name and email you provide, a salted password hash, your restaurant submissions, and reservation details. Authentication uses an HttpOnly session cookie.",
        "Newsletter signup records an email preference; this demo does not send emails. We do not use advertising cookies. Avoid submitting sensitive information to this portfolio application.",
      ],
    ],
  };
  const [title, paragraphs] = content[slug] ?? content.about;
  return (
    <div className="page narrow info-page">
      <p className="eyebrow">QUICKDINE</p>
      <h1>{title}</h1>
      {paragraphs.map((p) => (
        <p key={p}>{p}</p>
      ))}
      <Link className="text-link" href="/">
        Back to discover <ArrowRight size={16} />
      </Link>
    </div>
  );
}
