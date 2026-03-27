export type TaskDifficulty = "Beginner" | "Intermediate" | "Advanced";
export type TaskCategory = "Setup" | "Bot" | "UI" | "Security" | "Integration" | "DevOps";

export interface Task {
  category: TaskCategory;
  description: string;
  difficulty: TaskDifficulty;
  estimatedTime: string;
  id: string;
  price: number;
  title: string;
}

export interface CartItem extends Task {
  quantity: number;
}

export interface OrderItem {
  id: string;
  price: number;
  quantity: number;
  title: string;
}

export interface OrderPayload {
  currency: "Stars";
  items: OrderItem[];
  total: number;
  type: "order_completed";
}

export const mockTasks: Task[] = [
  {
    category: "Setup",
    description: "Create a new Telegram Mini App workspace with the Teleforge CLI.",
    difficulty: "Beginner",
    estimatedTime: "15 min",
    id: "task-001",
    price: 10,
    title: "Build Mini App Scaffold"
  },
  {
    category: "Bot",
    description: "Register slash commands and a start flow with @teleforgex/bot.",
    difficulty: "Beginner",
    estimatedTime: "20 min",
    id: "task-002",
    price: 15,
    title: "Implement Bot Commands"
  },
  {
    category: "UI",
    description: "Adopt theme-aware components that follow Telegram's current palette.",
    difficulty: "Intermediate",
    estimatedTime: "25 min",
    id: "task-003",
    price: 12,
    title: "Add Theme Support"
  },
  {
    category: "Security",
    description: "Verify initData with Telegram's Ed25519 third-party validation flow.",
    difficulty: "Advanced",
    estimatedTime: "30 min",
    id: "task-004",
    price: 20,
    title: "Validate Init Data"
  },
  {
    category: "Integration",
    description: "Send structured order payloads from the Mini App back to the bot.",
    difficulty: "Intermediate",
    estimatedTime: "25 min",
    id: "task-005",
    price: 18,
    title: "Handle WebApp Data"
  },
  {
    category: "DevOps",
    description: "Prepare the app for deployment and hand-off with Teleforge tooling.",
    difficulty: "Intermediate",
    estimatedTime: "40 min",
    id: "task-006",
    price: 25,
    title: "Deploy to Production"
  }
];
