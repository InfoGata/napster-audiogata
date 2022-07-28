import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  CssBaseline,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import axios from "axios";
import { FunctionalComponent, JSX } from "preact";
import { useState, useEffect } from "preact/hooks";
import { API_KEY, TOKEN_SERVER, TOKEN_URL } from "./shared";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { MessageType, UiMessageType } from "./types";
import { VisibilityOff, Visibility } from "@mui/icons-material";

const napsterAuthUrl = "https://api.napster.com/oauth/authorize";
const redirectPath = "/login_popup.html";

const sendUiMessage = (message: UiMessageType) => {
  parent.postMessage(message, "*");
};

const App: FunctionalComponent = () => {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [pluginId, setPluginId] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [message, setMessage] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [useOwnKeys, setUseOwnKeys] = useState(false);

  useEffect(() => {
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
      }
    };
    window.addEventListener("message", onMessage);
    parent.postMessage({ type: "check-login" }, "*");
    () => window.removeEventListener("message", onMessage);
  }, []);

  const onLogin = async () => {
    const state = { pluginId: pluginId };
    const authUrl = new URL(napsterAuthUrl);
    const clientId = useOwnKeys ? apiKey : API_KEY;
    authUrl.searchParams.append("client_id", clientId);
    authUrl.searchParams.append("redirect_uri", redirectUri);
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
      params.append("redirect_uri", redirectUri);
      params.append("code", returnUrl.searchParams.get("code") || "");
      if (useOwnKeys) {
        tokenUrl = TOKEN_URL;
        params.append("client_secret", apiSecret);
      }
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

  const onAccordionChange = (_: any, expanded: boolean) => {
    setShowAdvanced(expanded);
  };

  const onLogout = () => {
    parent.postMessage("logout", "*");
    setIsSignedIn(false);
  };

  const onSaveKeys = () => {
    setUseOwnKeys(!!apiKey);
    sendUiMessage({
      type: "set-keys",
      apiSecret: apiSecret,
      apiKey: apiKey,
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

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleMouseDownPassword = (event: JSX.TargetedEvent) => {
    event.preventDefault();
  };

  return (
    <Box
      sx={{ display: "flex", "& .MuiTextField-root": { m: 1, width: "25ch" } }}
    >
      <CssBaseline />
      {isSignedIn ? (
        <div>
          <Button variant="contained" onClick={onLogout}>
            Logout
          </Button>
        </div>
      ) : (
        <div>
          <Button variant="contained" onClick={onLogin}>
            Login
          </Button>
          <pre>{message}</pre>
          {useOwnKeys && (
            <Typography>
              Using keys set in the Advanced Configuration
            </Typography>
          )}
          <Accordion expanded={showAdvanced} onChange={onAccordionChange}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="panel1d-content"
              id="panel1d-header"
            >
              <Typography>Advanced Configuration</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography>Supplying your own keys:</Typography>
              <Typography>{redirectUri} needs be added Callback URL</Typography>
              <div>
                <TextField
                  label="Api Key"
                  value={apiKey}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setApiKey(value);
                  }}
                />
                <TextField
                  type={showPassword ? "text" : "password"}
                  label="Api Secret "
                  value={apiSecret}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setApiSecret(value);
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle password visibility"
                          onClick={handleClickShowPassword}
                          onMouseDown={handleMouseDownPassword}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </div>
              <Stack spacing={2} direction="row">
                <Button variant="contained" onClick={onSaveKeys}>
                  Save
                </Button>
                <Button variant="contained" onClick={onClearKeys} color="error">
                  Clear
                </Button>
              </Stack>
            </AccordionDetails>
          </Accordion>
        </div>
      )}
    </Box>
  );
};

export default App;
