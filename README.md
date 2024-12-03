# Pixel Art ElectricSQL Demo

Welcome to the Pixel Art demo for [ElectricSQL](https://electric-sql.com/), a collaborative pixel art canvas where users can create art together in real-time.

ElectricSQL provides seamless real-time data synchronization between Postgres tables and the game. You simply define your data structures in Postgres and then start syncing into the app.

## Database Schema

The pixel data is stored in the following Postgres table:

```sql
CREATE TABLE pixels (
    x integer NOT NULL,
    y integer NOT NULL,
    color text NOT NULL,
    user_id uuid,
    last_updated timestamptz DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pixels_pkey PRIMARY KEY (x, y),
    CONSTRAINT valid_color CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
    CONSTRAINT valid_coordinates CHECK (x >= -2147483648 AND x <= 2147483647 
        AND y >= -2147483648 AND y <= 2147483647),
    CONSTRAINT pixels_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);
```

And loaded with the [`useShape`](https://electric-sql.com/docs/integrations/react) hook:

```typescript
const { data: pixels } = useShape({ url, table: 'pixels' })
```

That's all you need for real-time syncing from Postgres that scales to millions!

## Features

- Real-time collaborative pixel art canvas
- Simple username-based authentication
- Infinite canvas with zoom and pan controls
- Pixel history tracking with user attribution
- Mobile-friendly touch controls

## Development

Currently it's not very easy to run this yourself locally... file an issue if
you're interested and I'll work on improving this.

## License

MIT
