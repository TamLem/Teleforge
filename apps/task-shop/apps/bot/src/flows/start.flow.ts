import { defineFlow } from "teleforge";

export default defineFlow({
  id: "gadgetshop-start",

  command: {
    command: "start",
    description: "Open GadgetShop",
    handler: async ({ ctx, sign }) => {
      const catalogLaunch = await sign({
        flowId: "gadgetshop",
        screenId: "catalog",
        subject: {},
        allowedActions: ["addToCart", "removeFromCart", "placeOrder"]
      });

      await ctx.reply(
        "**Welcome to GadgetShop!** \u2014 the latest smartphones, laptops, audio, and accessories.",
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "\uD83D\uDED2 Open Store", web_app: { url: catalogLaunch } }],
              [{ text: "\uD83D\uDCCB Browse Catalogue", callback_data: "browse_catalogue" }]
            ]
          }
        }
      );
    }
  },

  handlers: {
    onCallback: async ({ ctx }) => {
      if (ctx.data === "browse_catalogue") {
        await ctx.answer();
        await ctx.reply("/shop");
      }
    }
  }
});
