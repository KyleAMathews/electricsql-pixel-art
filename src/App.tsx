import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Canvas } from "./components/Canvas";
import { User } from "./types/schema";
import "./App.css";

const STORAGE_KEY = "pixelCanvas_auth";
const EXPIRY_DAYS = 7;

async function createUser(newUser: Partial<User>) {
  // Post to backend
  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(newUser),
  });

  return await response.json();
}

function saveAuth(userId: string, username: string) {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + EXPIRY_DAYS);

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      userId,
      username,
      expiry: expiryDate.toISOString(),
    }),
  );
}

function loadAuth() {
  const auth = localStorage.getItem(STORAGE_KEY);
  if (!auth) return null;

  const { userId, username, expiry } = JSON.parse(auth);
  if (new Date(expiry) < new Date()) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }

  return { userId, username };
}

function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

function App() {
  const savedAuth = loadAuth();
  const [userId, setUserId] = useState<string>(savedAuth?.userId || "");
  const [username, setUsername] = useState(savedAuth?.username || "");
  const [selectedColor, setSelectedColor] = useState("#000000");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!username) return;
    setError(null);
    setIsLoading(true);

    const newUser = {
      id: uuidv4(),
      username,
      pixels_placed: 0,
      last_active: new Date(),
      created_at: new Date(),
    };

    try {
      const response = await createUser(newUser);

      if (!response.success) {
        setError(response.error);
        return;
      }

      setUserId(response.user.id);
      // Save auth info
      saveAuth(response.user.id, username);
    } catch (error) {
      console.error("Error creating user:", error);
      setError("Failed to connect to server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    setUserId("");
    setUsername("");
    setSelectedColor("#000000");
  };

  if (!userId) {
    return (
      <div className="login-container">
        <h1>Pixel Canvas</h1>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await handleLogin();
          }}
        >
          <input
            type="text"
            placeholder="Enter username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isLoading}
          />
          {error && <div className="error-message">{error}</div>}
          <button type="submit" disabled={isLoading || !username.trim()}>
            {isLoading ? "Joining..." : "Join Canvas"}
          </button>
        </form>
      </div>
    );
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
        <button
          onClick={handleLogout}
          style={{
            marginLeft: "auto",
            background: "none",
            border: "none",
            color: "#666",
            fontSize: "12px",
            cursor: "pointer",
            padding: "4px 8px",
          }}
        >
          Logout
        </button>
      </div>
      <Canvas userId={userId} selectedColor={selectedColor} />
    </div>
  );
}

export default App;
