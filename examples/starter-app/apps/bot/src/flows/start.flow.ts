import { defineFlow } from "teleforge/web";

export default defineFlow({
  id: "start",

  command: {
    command: "start",
    description: "Open the starter Mini App",
    handler: async ({ ctx, sign }) => {
      const launch = await sign({
        flowId: "start",
        screenId: "home",
        allowedActions: ["navigate"]
      });

      await ctx.reply("Welcome! Open the Mini App to get started.", {
        reply_markup: {
          inline_keyboard: [[
            { text: "Open App", web_app: { url: launch } }
          ]]
        }
      });
    }
  },

  miniApp: {
    routes: { "/": "home" },
    defaultRoute: "/",
    title: "Starter App"
  },

  actions: {
    navigate: {
      handler: async ({ data }) => {
        return { navigate: (data as Record<string, string>).screenId };
      }
    }
  }
});
