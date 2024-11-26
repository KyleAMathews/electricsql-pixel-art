-- Remove the old constraint
ALTER TABLE pixels DROP CONSTRAINT valid_coordinates;

-- Add new constraint using INT4 bounds
-- This gives us a range of -2,147,483,648 to 2,147,483,647 for both x and y
-- While still protecting against overflow
ALTER TABLE pixels 
    ADD CONSTRAINT valid_coordinates 
    CHECK (
        x >= -2147483648 AND x <= 2147483647 AND
        y >= -2147483648 AND y <= 2147483647
    );
