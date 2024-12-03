import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Canvas } from "./components/Canvas";
import { Modal } from "./components/Modal";
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

export function loadAuth() {
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
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);

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
          onClick={() => setIsAboutModalOpen(true)}
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
          About
        </button>
        <button
          onClick={handleLogout}
          style={{
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
      <Modal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
        title="About the Pixel Art ElectricSQL Demo"
      >
        <p className="mb-4">
          Welcome to Pixel Art demo for <a
            href="https://electric-sql.com/">ElectricSQL</a>, a collaborative
          pixel art canvas where users can create art together in real-time.
        </p>
        <p className="mb-4">
          ElectricSQL provides seamless real-time data synchronization between Postgres tables
          and the game. You simply define your data structures in Postgres and then start syncing into the app.
        </p>
        <p className="mb-4">
          View the source code on <a href="https://github.com/KyleAMathews/electricsql-pixel-art">GitHub</a>.
        </p>
        <div className="mb-4">
          <p>The pixel data is stored in the following Postgres table:</p>
          <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
            <code className="language-sql">{`CREATE TABLE pixels (
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
`}</code>
          </pre>
          <p>And loaded with the <a href="https://electric-sql.com/docs/integrations/react"><code>useShape</code></a> hook:</p>
          <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
            <code className="language-sql">{`const { data: pixels } = useShape({ url, table: 'pixels' })
`}</code>
          </pre>
          <p>That's all you need for real-time syncing from Postgres that scales to millions!</p>
        </div>
      </Modal>
    </div>
  );
}

export default App;
