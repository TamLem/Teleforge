import { defineClientFlowManifest } from "teleforge/web";

export const flowManifest = defineClientFlowManifest(
  [
  {
    "bot": {
      "command": {
        "buttonText": "Open Starter App",
        "command": "start",
        "description": "Open the Starter App",
        "text": "Starter App is ready. Open the Mini App to inspect Telegram theme, user data, and MainButton behavior."
      }
    },
    "finalStep": "home",
    "id": "start",
    "initialStep": "home",
    "miniApp": {
      "launchModes": [
        "inline",
        "compact",
        "fullscreen"
      ],
      "route": "/"
    },
    "state": {},
    "steps": {
      "home": {
        "screen": "home",
        "type": "miniapp"
      }
    }
  }
]
);
