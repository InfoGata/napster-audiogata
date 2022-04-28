import axios from "axios";
import { FunctionalComponent, JSX } from "preact";
import { useState, useEffect } from "preact/hooks";
import { API_KEY } from "./shared";
import { NapsterAuthResponse } from "./types";

const tokenUrl = "https://api.napster.com/oauth/token";
// Secret is here on purpose
// Otherwise would need to run a server.
const apiSecret = "YjUxYzBmODAtNjY1ZS00MjcxLThiYmYtNjVmNjNlODdhZDk4";

const App: FunctionalComponent = () => {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      switch (event.data.type) {
        case "login":
          const auth: NapsterAuthResponse = event.data.auth;
          setUsername(auth.username);
          setIsSignedIn(true);
          break;
      }
    };
    window.addEventListener("message", onMessage);
    console.log("whats going on");
    parent.postMessage({ type: "check-login" }, "*");
    () => window.removeEventListener("message", onMessage);
  }, []);

  const onPasswordLogin = async () => {
    const params = new URLSearchParams();
    params.append("username", username);
    params.append("password", password);
    params.append("grant_type", "password");
    const result = await axios.post<NapsterAuthResponse>(tokenUrl, params, {
      auth: {
        username: API_KEY,
        password: apiSecret,
      },
    });
    parent.postMessage({ type: "login", auth: result.data }, "*");
    setIsSignedIn(true);
  };

  const onLogout = () => {
    setIsSignedIn(false);
  };

  const onChangeUserName = (event: JSX.TargetedEvent<HTMLInputElement>) => {
    setUsername(event.currentTarget.value);
  };

  const onChangePassword = (event: JSX.TargetedEvent<HTMLInputElement>) => {
    setPassword(event.currentTarget.value);
  };

  return (
    <>
      {isSignedIn ? (
        <div>
          <p>Logged in as {username}</p>
          <button onClick={onLogout}>Logout</button>
        </div>
      ) : (
        <div>
          <input
            type="text"
            value={username}
            onInput={onChangeUserName}
            placeholder="Username"
          />
          <input
            type="password"
            value={password}
            onInput={onChangePassword}
            placeholder="Password"
          />
          <button onClick={onPasswordLogin}>Password Login</button>
        </div>
      )}
    </>
  );
};

export default App;
