import { useEffect, useState, useOptimistic } from 'react'
import { useShape, getShapeStream } from '@electric-sql/react'
import { v4 as uuidv4 } from 'uuid'
import { Canvas } from './components/Canvas'
import { userShape } from './shapes'
import { User } from './types/schema'
import { matchStream } from './utils/match-stream'
import './App.css'

async function createUser(newUser: Partial<User>) {
  const usersStream = getShapeStream<User>(userShape())

  // Match the insert
  const findUpdatePromise = matchStream({
    stream: usersStream,
    operations: ['insert'],
    matchFn: ({ message }) => message.value.username === newUser.username
  })

  // Post to backend
  const fetchPromise = fetch(`${import.meta.env.VITE_API_URL}/api/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(newUser),
  })

  return await Promise.all([findUpdatePromise, fetchPromise])
}

function App() {
  const [userId, setUserId] = useState<string>('')
  const [username, setUsername] = useState('')
  const [selectedColor, setSelectedColor] = useState('#000000')

  // Initialize shapes
  const { data: users = [], isLoading } = useShape<User>(userShape())
  const [optimisticUsers, addOptimisticUser] = useOptimistic(
    users,
    (currentUsers: User[], newUser: User) => [...currentUsers, newUser]
  )

  const handleLogin = async () => {
    if (!username) return

    const newUser = {
      id: uuidv4(),
      username,
      pixels_placed: 0,
      last_active: new Date(),
      created_at: new Date()
    }

    // Update optimistically
    addOptimisticUser(newUser)
    setUserId(newUser.id)

    // Send to backend
    await createUser(newUser)
  }

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!userId) {
    return (
      <div className="login-container">
        <h1>Pixel Canvas</h1>
        <input
          type="text"
          placeholder="Enter username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button onClick={handleLogin}>Join Canvas</button>
      </div>
    )
  }

  return (
    <div className="app-container">
      <div className="toolbar">
        <input
          type="color"
          value={selectedColor}
          onChange={(e) => setSelectedColor(e.target.value)}
        />
        <span className="username">{username}</span>
      </div>
      <Canvas userId={userId} selectedColor={selectedColor} />
    </div>
  )
}

export default App
