export const filterRestaurants = (
  restaurants: import("./types").Restaurant[],
  query: string,
  cuisine: string,
  location: string,
  price: number,
  minRating: number,
) =>
  restaurants.filter(
    (r) =>
      (!query ||
        `${r.name} ${r.cuisine} ${r.tags.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (!cuisine ||
        r.cuisine === cuisine ||
        r.tags.some((t) => t.toLowerCase() === cuisine.toLowerCase())) &&
      (!location ||
        r.location.toLowerCase().includes(location.toLowerCase())) &&
      (!price || r.price === price) &&
      r.rating >= minRating,
  );
