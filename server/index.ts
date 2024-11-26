import express from 'express'
import postgres from 'postgres'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

const sql = postgres({
  host: 'localhost',
  port: 54321,
  database: 'electric',
  username: 'postgres',
  password: 'password'
})

// Create a new user
app.post('/api/users', async (req, res) => {
  const { id, username, pixels_placed, last_active, created_at } = req.body
  
  try {
    const user = await sql`
      INSERT INTO users (id, username, pixels_placed, last_active, created_at)
      VALUES (${id}, ${username}, ${pixels_placed}, ${last_active}, ${created_at})
      RETURNING *
    `
    res.json(user[0])
  } catch (error) {
    console.error('Error creating user:', error)
    res.status(500).json({ error: 'Failed to create user' })
  }
})

// Update or create a pixel
app.post('/api/pixels', async (req, res) => {
  const { x, y, color, user_id, last_updated } = req.body
  
  try {
    // Using upsert (INSERT ... ON CONFLICT DO UPDATE)
    const pixel = await sql`
      INSERT INTO pixels (x, y, color, user_id, last_updated)
      VALUES (${x}, ${y}, ${color}, ${user_id}, ${last_updated})
      ON CONFLICT (x, y)
      DO UPDATE SET 
        color = EXCLUDED.color,
        user_id = EXCLUDED.user_id,
        last_updated = EXCLUDED.last_updated
      RETURNING *
    `
    
    // Update user's pixels_placed count
    await sql`
      UPDATE users 
      SET pixels_placed = pixels_placed + 1,
          last_active = ${new Date()}
      WHERE id = ${user_id}
    `
    
    res.json(pixel[0])
  } catch (error) {
    console.error('Error updating pixel:', error)
    res.status(500).json({ error: 'Failed to update pixel' })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
