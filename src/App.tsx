import axios from "axios";
import { FunctionalComponent, JSX } from "preact";
import { useState, useEffect } from "preact/hooks";
import { API_KEY } from "./shared";
import { NapsterAuthResponse } from "./types";

const tokenUrl = "https://api.napster.com/oauth/access_token";
const napsterAuthUrl = "https://api.napster.com/oauth/authorize";
const redirectPath = "/login_popup.html";
// Secret is here on purpose
// Otherwise would need to run a server.
const apiSecret = "YjUxYzBmODAtNjY1ZS00MjcxLThiYmYtNjVmNjNlODdhZDk4";

const App: FunctionalComponent = () => {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [pluginId, setPluginId] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      switch (event.data.type) {
        case "login":
          setIsSignedIn(true);
          break;
        case "origin":
          setRedirectUri(event.data.origin + redirectPath);
          setPluginId(event.data.pluginId);
          break;
      }
    };
    window.addEventListener("message", onMessage);
    parent.postMessage({ type: "check-login" }, "*");
    () => window.removeEventListener("message", onMessage);
  }, []);

  const onImplicitLogin = async () => {
    const state = { pluginId: pluginId };
    const authUrl = new URL(napsterAuthUrl);
    authUrl.searchParams.append("client_id", API_KEY);
    authUrl.searchParams.append("redirect_uri", redirectUri);
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("state", JSON.stringify(state));
    const newWindow = window.open(authUrl);

    const onMessage = async (url: string) => {
      const returnUrl = new URL(url);
      newWindow.close();
      const error = returnUrl.searchParams.get("error");
      if (error !== null) {
        setMessage(`Error: ${error}`);
        return;
      }
      const params = new URLSearchParams();
      params.append("client_id", API_KEY);
      params.append("client_secret", apiSecret);
      params.append("response_type", "code");
      params.append("grant_type", "authorization_code");
      params.append("redirect_uri", redirectUri);
      params.append("code", returnUrl.searchParams.get("code"));
      const result = await axios.post(tokenUrl, params, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
      setIsSignedIn(true);
      parent.postMessage({ type: "login", auth: result.data }, "*");
    };

    window.onmessage = async (event: MessageEvent) => {
      if (event.source === newWindow) {
        await onMessage(event.data.url);
      } else {
        if (event.data.type === "deeplink") {
          await onMessage(event.data.url);
        }
      }
    };
  };

  const onLogout = () => {
    parent.postMessage("logout", "*");
    setIsSignedIn(false);
  };

  return (
    <>
      {isSignedIn ? (
        <div>
          <button onClick={onLogout}>Logout</button>
        </div>
      ) : (
        <div>
          <button onClick={onImplicitLogin}>Login</button>
        </div>
      )}
      <pre>{message}</pre>
    </>
  );
};

export default App;
