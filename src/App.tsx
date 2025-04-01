import ky from "ky";
import { createEffect, createSignal } from "solid-js";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./components/ui/accordion";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { API_KEY, TOKEN_SERVER, TOKEN_URL } from "./shared";
import { MessageType, UiMessageType } from "./types";

const napsterAuthUrl = "https://api.napster.com/oauth/authorize";
const redirectPath = "/login_popup.html";

const sendUiMessage = (message: UiMessageType) => {
  parent.postMessage(message, "*");
};

const App = () => {
  const [isSignedIn, setIsSignedIn] = createSignal(false);
  const [pluginId, setPluginId] = createSignal("");
  const [redirectUri, setRedirectUri] = createSignal("");
  const [message, setMessage] = createSignal("");
  const [apiKey, setApiKey] = createSignal("");
  const [apiSecret, setApiSecret] = createSignal("");
  const [useOwnKeys, setUseOwnKeys] = createSignal(false);

  createEffect(() => {
    const onMessage = (event: MessageEvent<MessageType>) => {
      switch (event.data.type) {
        case "login":
          setIsSignedIn(true);
          break;
        case "info":
          setRedirectUri(event.data.origin + redirectPath);
          setPluginId(event.data.pluginId);
          setApiKey(event.data.apiKey);
          setApiSecret(event.data.apiSecret);
          break;
        default:
          const _exhaustive: never = event.data;
          break;
      }
    };
    window.addEventListener("message", onMessage);
    parent.postMessage({ type: "check-login" }, "*");
    () => window.removeEventListener("message", onMessage);
  });

  const onLogin = async () => {
    const state = { pluginId: pluginId };
    const authUrl = new URL(napsterAuthUrl);
    const clientId = useOwnKeys() ? apiKey() : API_KEY;
    authUrl.searchParams.append("client_id", clientId);
    authUrl.searchParams.append("redirect_uri", redirectUri());
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("state", JSON.stringify(state));
    const newWindow = window.open(authUrl);

    const onMessage = async (url: string) => {
      const returnUrl = new URL(url);
      if (newWindow) {
        newWindow.close();
      }
      const error = returnUrl.searchParams.get("error");
      if (error !== null) {
        setMessage(`Error: ${error}`);
        return;
      }
      const params = new URLSearchParams();
      let tokenUrl = TOKEN_SERVER;
      params.append("client_id", clientId);
      params.append("response_type", "code");
      params.append("grant_type", "authorization_code");
      params.append("redirect_uri", redirectUri());
      params.append("code", returnUrl.searchParams.get("code") || "");
      if (useOwnKeys()) {
        tokenUrl = TOKEN_URL;
        params.append("client_secret", apiSecret());
      }
      const result = await ky.post(tokenUrl, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      }).json();
      setIsSignedIn(true);
      parent.postMessage({ type: "login", auth: result }, "*");
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
    sendUiMessage({ type: "logout" });
    setIsSignedIn(false);
  };

  const onSaveKeys = () => {
    setUseOwnKeys(!!apiKey);
    sendUiMessage({
      type: "set-keys",
      apiSecret: apiSecret(),
      apiKey: apiKey(),
    });
  };

  const onClearKeys = () => {
    setApiKey("");
    setApiSecret("");
    setUseOwnKeys(false);
    sendUiMessage({
      type: "set-keys",
      apiSecret: "",
      apiKey: "",
    });
  };

  return (
    <div class="flex">
      <div class="flex flex-col gap-2 w-full">
        {isSignedIn() ? (
          <div>
            <Button onClick={onLogout}>Logout</Button>
          </div>
        ) : (
          <div>
            <Button onClick={onLogin}>Login</Button>
            <pre>{message()}</pre>
            {useOwnKeys() && (
              <p>Using keys set in the Advanced Configuration</p>
            )}
            <Accordion multiple collapsible>
              <AccordionItem value="item-1">
                <AccordionTrigger>Advanced Configuration</AccordionTrigger>

                <AccordionContent>
                  <div class="flex flex-col gap-4 m-4"></div>
                  <p>Supplying your own keys:</p>
                  <p>{redirectUri()} needs be added Callback URL</p>
                  <div>
                    <Input
                      placeholder="Api Key"
                      value={apiKey()}
                      onChange={(e) => {
                        const value = e.currentTarget.value;
                        setApiKey(value);
                      }}
                    />
                    <Input
                      type="password"
                      placeholder="Api Secret "
                      value={apiSecret()}
                      onChange={(e) => {
                        const value = e.currentTarget.value;
                        setApiSecret(value);
                      }}
                    />
                  </div>
                  <div class="flex flex-row gap-2">
                    <Button onClick={onSaveKeys}>Save</Button>
                    <Button onClick={onClearKeys} color="error">
                      Clear
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
