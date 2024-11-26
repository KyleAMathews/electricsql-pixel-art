import { useEffect, useState } from 'react'
import { useShape, getShapeStream } from '@electric-sql/react'
import { v4 as uuidv4 } from 'uuid'
import { Canvas } from './components/Canvas'
import { userShape } from './shapes'
import { User } from './types/schema'
import { matchStream } from './utils/match-stream'
import './App.css'

async function createUser(newUser: Partial<User>) {
  // Post to backend
  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(newUser),
  })

  return await response.json()
}

function App() {
  const [userId, setUserId] = useState<string>('')
  const [username, setUsername] = useState('')
  const [selectedColor, setSelectedColor] = useState('#000000')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Initialize shapes
  const { data: users = [], isLoading: usersLoading } = useShape<User>(userShape())

  const handleLogin = async () => {
    if (!username) return
    setError(null)
    setIsLoading(true)

    const newUser = {
      id: uuidv4(),
      username,
      pixels_placed: 0,
      last_active: new Date(),
      created_at: new Date()
    }

    try {
      const response = await createUser(newUser)
      
      if (!response.success) {
        setError(response.error)
        return
      }
      
      setUserId(response.user.id)
    } catch (error) {
      console.error('Error creating user:', error)
      setError('Failed to connect to server. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (usersLoading) {
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
          disabled={isLoading}
        />
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        <button 
          onClick={handleLogin} 
          disabled={isLoading}
        >
          {isLoading ? 'Joining...' : 'Join Canvas'}
        </button>
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
