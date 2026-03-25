import { z } from "zod";

const launchModeSchema = z.enum(["inline", "compact", "fullscreen"]);
const semverSchema = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);
const kebabCaseSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const commandSchema = z.object({
  command: z.string().min(1),
  description: z.string().min(1).optional(),
  handler: z.string().min(1).optional()
});

const routeCapabilitiesSchema = z
  .object({
    auth: z.boolean().optional(),
    launchMode: launchModeSchema.optional(),
    payments: z.boolean().optional()
  })
  .strict();

const routeSchema = z
  .object({
    capabilities: routeCapabilitiesSchema.optional(),
    component: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    guards: z.array(z.string().min(1)).optional(),
    launchModes: z.array(launchModeSchema).optional(),
    meta: z
      .object({
        description: z.string().min(1).optional(),
        title: z.string().min(1).optional()
      })
      .strict()
      .optional(),
    path: z.string().min(1).startsWith("/"),
    title: z.string().min(1).optional(),
    ui: z
      .object({
        header: z
          .object({
            hideBackButton: z.boolean().optional(),
            title: z.string().min(1).optional()
          })
          .strict()
          .optional(),
        mainButton: z
          .object({
            text: z.string().min(1),
            visible: z.boolean().optional()
          })
          .strict()
          .optional()
      })
      .strict()
      .optional()
  })
  .strict();

const permissionSchema = z
  .object({
    capability: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    scope: z.string().min(1).optional()
  })
  .strict()
  .superRefine((permission, context) => {
    if (!permission.capability && !permission.scope) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Permission requires either `capability` or `scope`."
      });
    }
  });

const runtimeSchema = z
  .object({
    apiPrefix: z.string().startsWith("/").optional(),
    apiRoutes: z.string().min(1).optional(),
    build: z
      .object({
        basePath: z.string().startsWith("/").optional(),
        outDir: z.string().min(1).optional()
      })
      .strict()
      .optional(),
    mode: z.enum(["spa", "bff"]),
    ssr: z.boolean().optional(),
    webFramework: z.enum(["vite", "nextjs", "custom"])
  })
  .strict();

const botSchema = z
  .object({
    commands: z.array(commandSchema).optional(),
    tokenEnv: z.string().min(1).default("BOT_TOKEN"),
    username: z.string().regex(/^[A-Za-z0-9_]{5,32}$/),
    webhook: z
      .object({
        path: z.string().startsWith("/"),
        secretEnv: z.string().min(1)
      })
      .strict()
  })
  .strict();

const miniAppSchema = z
  .object({
    capabilities: z.array(z.string().min(1)),
    defaultMode: launchModeSchema,
    entryPoint: z.string().min(1),
    launchModes: z.array(launchModeSchema).min(1),
    url: z.string().url().optional()
  })
  .strict()
  .superRefine((miniApp, context) => {
    if (!miniApp.launchModes.includes(miniApp.defaultMode)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "miniApp.defaultMode must be present in miniApp.launchModes.",
        path: ["defaultMode"]
      });
    }
  });

export const manifestSchema = z
  .object({
    $schema: z.string().url().optional(),
    bot: botSchema,
    build: z
      .object({
        outDir: z.string().min(1).optional(),
        publicDir: z.string().min(1).optional()
      })
      .strict()
      .optional(),
    dev: z
      .object({
        httpsPort: z.number().int().positive().optional(),
        port: z.number().int().positive().optional(),
        tunnel: z.boolean().optional()
      })
      .strict()
      .optional(),
    features: z
      .object({
        backButton: z.boolean().optional(),
        cloudStorage: z.boolean().optional(),
        hapticFeedback: z.boolean().optional(),
        payments: z.boolean().optional(),
        settingsButton: z.boolean().optional()
      })
      .strict()
      .optional(),
    id: kebabCaseSchema,
    miniApp: miniAppSchema,
    name: z.string().min(1).max(100),
    permissions: z.array(permissionSchema).optional(),
    routes: z.array(routeSchema).min(1),
    runtime: runtimeSchema,
    security: z
      .object({
        allowedOrigins: z.array(z.string().url()).optional(),
        validateInitData: z.boolean().optional(),
        webhookSecret: z.string().min(1).optional()
      })
      .strict()
      .optional(),
    version: semverSchema
  })
  .strict()
  .superRefine((manifest, context) => {
    if (manifest.runtime.mode === "spa" && manifest.runtime.webFramework !== "vite") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "runtime.mode spa requires runtime.webFramework to be vite.",
        path: ["runtime", "webFramework"]
      });
    }

    if (
      manifest.runtime.mode === "bff" &&
      manifest.runtime.webFramework !== "nextjs" &&
      manifest.runtime.webFramework !== "custom"
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "runtime.mode bff requires runtime.webFramework to be nextjs or custom.",
        path: ["runtime", "webFramework"]
      });
    }
  });
