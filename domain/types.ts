export type Role = "user" | "owner" | "admin";
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  demo: boolean;
}
export interface Restaurant {
  id: string;
  slug: string;
  name: string;
  cuisine: string;
  location: string;
  address: string;
  description: string;
  image: string;
  price: number;
  rating: number;
  chef: string;
  tags: string[];
  slots: string[];
  capacity: number;
  owner: string | null;
  status: "approved" | "pending" | "rejected";
  featured: boolean;
}
export interface Booking {
  id: string;
  restaurantId: string;
  restaurantName: string;
  image: string;
  date: string;
  time: string;
  guests: number;
  occasion: string;
  requests: string;
  status: "pending" | "confirmed" | "cancelled";
  name: string;
  email: string;
  createdAt: number;
}
export interface Availability {
  time: string;
  remaining: number;
}
export interface Dashboard {
  restaurants: Restaurant[];
  bookings: Booking[];
  users: number;
}
