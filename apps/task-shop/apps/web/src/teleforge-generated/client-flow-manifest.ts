import { defineClientFlowManifest } from "teleforge/web";

export const flowManifest = defineClientFlowManifest(
  [
  {
    "bot": {
      "command": {
        "buttonText": "Open Shop",
        "command": "shop",
        "description": "Browse the shop catalogue",
        "text": "Welcome to the Shop! Select an item below."
      }
    },
    "finalStep": "tracking",
    "id": "shop-catalogue",
    "initialStep": "catalogue",
    "miniApp": {
      "launchModes": [
        "inline",
        "compact",
        "fullscreen"
      ],
      "returnToChat": {
        "stayInChat": true,
        "text": "Back to Shop"
      },
      "route": "/shop",
      "stepRoutes": {
        "checkout": "/shop/checkout",
        "tracking": "/shop/tracking"
      },
      "title": "Shop"
    },
    "state": {
      "orderId": null,
      "selectedItem": null
    },
    "steps": {
      "catalogue": {
        "actions": [
          {
            "id": "task-001",
            "label": "Build Mini App Scaffold — 10★",
            "miniApp": {
              "payload": {
                "selectedItem": "task-001"
              }
            },
            "to": "checkout"
          },
          {
            "id": "task-002",
            "label": "Implement Bot Commands — 15★",
            "miniApp": {
              "payload": {
                "selectedItem": "task-002"
              }
            },
            "to": "checkout"
          },
          {
            "id": "task-003",
            "label": "Add Theme Support — 12★",
            "miniApp": {
              "payload": {
                "selectedItem": "task-003"
              }
            },
            "to": "checkout"
          },
          {
            "id": "task-004",
            "label": "Validate Init Data — 20★",
            "miniApp": {
              "payload": {
                "selectedItem": "task-004"
              }
            },
            "to": "checkout"
          },
          {
            "id": "task-005",
            "label": "Handle WebApp Data — 18★",
            "miniApp": {
              "payload": {
                "selectedItem": "task-005"
              }
            },
            "to": "checkout"
          },
          {
            "id": "task-006",
            "label": "Deploy to Production — 25★",
            "miniApp": {
              "payload": {
                "selectedItem": "task-006"
              }
            },
            "to": "checkout"
          }
        ],
        "message": "Select an item to purchase:",
        "type": "chat"
      },
      "checkout": {
        "screen": "shop.checkout",
        "type": "miniapp"
      },
      "confirmed": {
        "actions": [
          {
            "id": "track-order",
            "label": "Track Order",
            "miniApp": {
              "payload": {}
            },
            "to": "tracking"
          }
        ],
        "message": "",
        "miniApp": {
          "screen": "shop.tracking"
        },
        "type": "chat"
      },
      "tracking": {
        "screen": "shop.tracking",
        "type": "miniapp"
      }
    }
  },
  {
    "bot": {
      "command": {
        "buttonText": "Open Task Shop",
        "command": "start",
        "description": "Open the Task Shop Mini App",
        "text": "Welcome to Task Shop. Browse Teleforge-flavored tasks and check out from the Mini App."
      }
    },
    "finalStep": "completed",
    "id": "task-shop-browse",
    "initialStep": "catalog",
    "miniApp": {
      "launchModes": [
        "inline",
        "compact",
        "fullscreen"
      ],
      "requestWriteAccess": true,
      "returnToChat": {
        "stayInChat": true,
        "text": "Back to Task Shop chat"
      },
      "route": "/",
      "stepRoutes": {
        "cart": "/cart",
        "checkout": "/checkout",
        "detail": "/detail",
        "success": "/success"
      },
      "title": "Task Shop"
    },
    "state": {
      "cart": [],
      "lastOrder": null,
      "selectedTaskId": null
    },
    "steps": {
      "catalog": {
        "screen": "task-shop.catalog",
        "type": "miniapp"
      },
      "detail": {
        "screen": "task-shop.detail",
        "type": "miniapp"
      },
      "cart": {
        "screen": "task-shop.cart",
        "type": "miniapp"
      },
      "checkout": {
        "screen": "task-shop.checkout",
        "type": "miniapp"
      },
      "success": {
        "actions": [
          {
            "id": "return-to-chat",
            "label": "Return to chat",
            "to": "completed"
          }
        ],
        "screen": "task-shop.success",
        "type": "miniapp"
      },
      "completed": {
        "message": "",
        "type": "chat"
      }
    }
  }
]
);
