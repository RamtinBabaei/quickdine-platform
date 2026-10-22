CREATE TRIGGER booking_capacity_guard BEFORE INSERT ON bookings
WHEN NEW.status != 'cancelled'
BEGIN
 SELECT CASE WHEN NEW.guests < 1 OR NEW.guests > 12 OR NEW.guests + COALESCE((SELECT SUM(guests) FROM bookings WHERE tenant=NEW.tenant AND restaurant_id=NEW.restaurant_id AND date=NEW.date AND time=NEW.time AND status != 'cancelled'),0) > NEW.capacity THEN RAISE(ABORT, 'capacity_exceeded') END;
END;
