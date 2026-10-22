"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Plus,
  UtensilsCrossed,
  Users,
  CalendarDays,
  Check,
  X,
  Pencil,
} from "lucide-react";
import type { User, Restaurant, Dashboard } from "../domain/types";
import { api, Empty, Spinner, ReservationCard } from "./quickdine";
export default function Management({
  user,
  notify,
  refresh,
}: {
  user: User | null;
  notify: (s: string) => void;
  refresh: () => void;
}) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [tab, setTab] = useState("restaurants");
  const [form, setForm] = useState<Restaurant | true | null>(null);
  const [version, setVersion] = useState(0);
  const [coverImage, setCoverImage] = useState("/images/restaurant_3.webp");
  const [uploading, setUploading] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    if (form) el?.showModal();
    return () => el?.close();
  }, [form]);
  async function upload(file: File | undefined) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be smaller than 2 MB");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const res = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const result = (await res.json()) as { image?: string; error?: string };
      if (!res.ok || !result.image)
        throw new Error(result.error ?? "Upload failed");
      setCoverImage(result.image);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = () => {
    setVersion((v) => v + 1);
    refresh();
  };
  useEffect(() => {
    let active = true;
    if (user && user.role !== "user")
      api<Dashboard>("dashboard")
        .then((d) => {
          if (active) setData(d);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [user, version]);
  async function change(path: string, body: unknown) {
    try {
      await api(path, body, "PATCH");
      load();
      notify("Changes saved.");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const body = {
      ...Object.fromEntries(f.entries()),
      price: Number(f.get("price")),
      capacity: Number(f.get("capacity")),
      image: coverImage,
      tags: String(f.get("tags") ?? "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
      slots: String(f.get("slots") ?? "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    };
    try {
      await api(
        form !== true && form ? "restaurants/" + form.id : "restaurants",
        body,
        form !== true && form ? "PATCH" : "POST",
      );
      setForm(null);
      load();
      notify("Your venue has been submitted for review.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!user || user.role === "user")
    return (
      <div className="page">
        <Empty title="Your hospitality workspace">
          <p>
            Sign in with a restaurant owner account to submit your venue, or try
            an isolated management demo from the home page.
          </p>
          <Link className="btn" href="/">
            Explore the demos <ArrowRight size={16} />
          </Link>
        </Empty>
      </div>
    );
  const editing = form !== true && form ? form : null;
  return (
    <div className="page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            {user.role === "admin"
              ? "PLATFORM OVERVIEW"
              : "RESTAURATEUR WORKSPACE"}
          </p>
          <h1>
            {user.role === "admin"
              ? "Behind every great table."
              : "Welcome to your dining room."}
          </h1>
          <p className="muted">
            {user.demo
              ? "Isolated demo workspace. Explore freely; your changes are private."
              : "Manage venues and reservations, thoughtfully."}
          </p>
        </div>
        {user.role === "owner" && (
          <button
            className="btn"
            onClick={() => {
              setCoverImage("/images/restaurant_3.webp");
              setForm(true);
            }}
          >
            <Plus size={16} /> Add a restaurant
          </button>
        )}
      </div>
      {error && !form && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!data ? (
        <Spinner />
      ) : (
        <>
          <div className="stats-grid">
            {[
              [UtensilsCrossed, data.restaurants.length, "Restaurants"],
              [CalendarDays, data.bookings.length, "Reservations"],
              [
                Users,
                user.role === "admin"
                  ? data.users
                  : data.bookings.filter((b) => b.status === "pending").length,
                user.role === "admin" ? "Accounts" : "Awaiting confirmation",
              ],
            ].map(([Icon, value, label]) => {
              const C = Icon as typeof Users;
              return (
                <div className="stat" key={String(label)}>
                  <C size={24} />
                  <strong>{String(value)}</strong>
                  <span>{String(label)}</span>
                </div>
              );
            })}
          </div>
          <div className="tabs">
            <button
              className={tab === "restaurants" ? "selected" : ""}
              onClick={() => setTab("restaurants")}
            >
              Restaurants
            </button>
            <button
              className={tab === "bookings" ? "selected" : ""}
              onClick={() => setTab("bookings")}
            >
              Reservations
            </button>
          </div>
          {tab === "restaurants" ? (
            <div className="venue-list">
              {data.restaurants.length ? (
                data.restaurants.map((r) => (
                  <article className="venue-row" key={r.id}>
                    <img
                      src={r.image}
                      alt=""
                      width="110"
                      height="80"
                      loading="lazy"
                    />
                    <div className="grow">
                      <h3>{r.name}</h3>
                      <p className="muted">
                        {r.cuisine} · {r.location} · {r.capacity} seats
                      </p>
                    </div>
                    <span className={"status " + r.status}>{r.status}</span>
                    {user.role === "admin" && r.owner && (
                      <div className="flex gap-2">
                        {r.status !== "approved" && (
                          <button
                            className="icon-btn"
                            aria-label={"Approve " + r.name}
                            onClick={() =>
                              change("restaurants/" + r.id, {
                                status: "approved",
                              })
                            }
                          >
                            <Check size={17} />
                          </button>
                        )}
                        {r.status !== "rejected" && (
                          <button
                            className="icon-btn"
                            aria-label={"Reject " + r.name}
                            onClick={() =>
                              change("restaurants/" + r.id, {
                                status: "rejected",
                              })
                            }
                          >
                            <X size={17} />
                          </button>
                        )}
                      </div>
                    )}
                    {user.role === "owner" && (
                      <button
                        className="text-link"
                        onClick={() => {
                          setCoverImage(r.image);
                          setForm(r);
                        }}
                      >
                        <Pencil size={14} /> Edit
                      </button>
                    )}
                  </article>
                ))
              ) : (
                <Empty title="Your first table starts here">
                  <p>Add your restaurant to begin the review process.</p>
                </Empty>
              )}
            </div>
          ) : data.bookings.length ? (
            <div className="booking-list">
              {data.bookings.map((b) => (
                <ReservationCard
                  key={b.id}
                  booking={b}
                  manager
                  onChange={(id, status) =>
                    change("bookings/" + id, { status })
                  }
                />
              ))}
            </div>
          ) : (
            <Empty title="A quiet moment before service">
              <p>Reservations for your restaurants will appear here.</p>
              {user.demo && (
                <Link className="btn" href="/search">
                  Create a test reservation
                </Link>
              )}
            </Empty>
          )}
        </>
      )}
      {form && (
        <dialog
          ref={dialog}
          className="venue-form"
          onCancel={() => setForm(null)}
          aria-labelledby="venue-title"
        >
          <div className="flex justify-between items-center">
            <h2 id="venue-title">
              {editing ? "Edit your venue" : "A new dining destination."}
            </h2>
            <button aria-label="Close venue form" onClick={() => setForm(null)}>
              <X />
            </button>
          </div>
          <p className="muted">
            Submissions and changes are reviewed before appearing in discovery.
          </p>
          <form onSubmit={submit}>
            <label className="field">
              Restaurant cover image
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => upload(e.target.files?.[0])}
              />
            </label>
            <p className="small muted">
              JPEG, PNG or WebP, up to 2 MB. Or select a curated cover below.
            </p>
            <div className="cover-choices">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  type="button"
                  key={n}
                  aria-label={"Use cover " + n}
                  aria-pressed={coverImage === `/images/restaurant_${n}.webp`}
                  onClick={() => setCoverImage(`/images/restaurant_${n}.webp`)}
                >
                  <img
                    src={`/images/restaurant_${n}-450.webp`}
                    alt=""
                    width="80"
                    height="60"
                  />
                </button>
              ))}
            </div>
            {uploading && <p role="status">Uploading your cover…</p>}
            {coverImage.startsWith("/api/") && (
              <img
                className="uploaded-cover"
                src={coverImage}
                alt="Your uploaded restaurant cover"
                width="300"
                height="180"
              />
            )}

            <div className="form-grid">
              {[
                ["name", "Restaurant name"],
                ["chef", "Head chef"],
                ["location", "City / neighborhood"],
                ["address", "Full address"],
              ].map(([key, label]) => (
                <label className="field" key={key}>
                  {label}
                  <input
                    name={key}
                    required
                    minLength={key === "address" ? 5 : 2}
                    maxLength={key === "address" ? 200 : 100}
                    defaultValue={
                      editing?.[
                        key as "name" | "chef" | "location" | "address"
                      ] ?? ""
                    }
                  />
                </label>
              ))}
              <label className="field">
                Cuisine
                <select
                  name="cuisine"
                  defaultValue={editing?.cuisine ?? "Italian"}
                >
                  {[
                    "Italian",
                    "French",
                    "Japanese",
                    "Vegetarian",
                    "Steakhouse",
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Price range
                <select name="price" defaultValue={editing?.price ?? 3}>
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {"$".repeat(n)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Seats per service
                <input
                  name="capacity"
                  type="number"
                  min={2}
                  max={300}
                  required
                  defaultValue={editing?.capacity ?? 30}
                />
              </label>
            </div>
            <label className="field">
              Dining tags (comma separated, up to 6)
              <input
                name="tags"
                maxLength={180}
                placeholder="Rooftop, Romantic, Tasting menu"
                defaultValue={editing?.tags.join(", ") ?? ""}
              />
            </label>
            <label className="field">
              Dinner service times (comma separated)
              <input
                name="slots"
                required
                pattern="[0-9:, ]+"
                placeholder="17:00, 18:00, 19:00, 20:00, 21:00"
                defaultValue={
                  editing?.slots.join(", ") ??
                  "17:00, 18:00, 19:00, 20:00, 21:00"
                }
              />
            </label>
            <p className="small muted">
              Use 24-hour times between 10:00 and 23:45 in 15-minute increments.
            </p>
            <label className="field">
              Restaurant description
              <textarea
                name="description"
                minLength={30}
                maxLength={2000}
                rows={4}
                required
                defaultValue={editing?.description ?? ""}
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="btn" disabled={busy || uploading}>
              {busy ? "Submitting…" : "Submit for review"}{" "}
              <ArrowRight size={16} />
            </button>
          </form>
        </dialog>
      )}
    </div>
  );
}
