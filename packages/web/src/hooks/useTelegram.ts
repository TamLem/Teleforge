import { useEffect, useRef, useState } from "react";
import { getTelegramWebApp, isTeleforgeMockInstalled } from "../utils/ssr.js";
import type {
  CloudStorage,
  HapticFeedback,
  PopupParams,
  TelegramPlatform,
  TelegramWebApp,
  ThemeParams,
  WebAppColorScheme,
  WebAppEvent,
  WebAppUser
} from "../types/webapp.js";

interface TelegramSnapshot {
  colorScheme: WebAppColorScheme;
  isExpanded: boolean;
  isMock: boolean;
  platform: TelegramPlatform;
  tg: TelegramWebApp | null;
  themeParams: ThemeParams;
  user: WebAppUser | null;
  userUnsafe: WebAppUser | null;
  version: string;
  viewportHeight: number;
  viewportStableHeight: number;
}

export interface UseTelegramReturn extends TelegramSnapshot {
  cloudStorage: CloudStorage;
  close: () => void;
  expand: () => void;
  hapticFeedback: HapticFeedback;
  isReady: boolean;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  ready: () => void;
  sendData: (data: string) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  showPopup: (params: PopupParams, callback?: (id?: string) => void) => void;
}

const trackedEvents: WebAppEvent[] = ["themeChanged", "viewportChanged"];
const readyInstances = new WeakSet<TelegramWebApp>();

const noopHapticFeedback: HapticFeedback = {
  impactOccurred() {},
  notificationOccurred() {},
  selectionChanged() {}
};

const noopCloudStorage: CloudStorage = {
  getItem(_key, callback) {
    callback?.(null, null);
  },
  getItems(_keys, callback) {
    callback?.(null, {});
  },
  removeItem(_key, callback) {
    callback?.(null, false);
  },
  removeItems(_keys, callback) {
    callback?.(null, false);
  },
  setItem(_key, _value, callback) {
    callback?.(null, false);
  }
};

const serverSnapshot = createSnapshot(null);

export function useTelegram(): UseTelegramReturn {
  const [snapshot, setSnapshot] = useState<TelegramSnapshot>(() => getSnapshot());
  const tgRef = useRef<TelegramWebApp | null>(snapshot.tg);
  const methodsRef = useRef<Omit<UseTelegramReturn, keyof TelegramSnapshot | "isReady">>();
  const [isReady, setIsReady] = useState<boolean>(() => false);

  tgRef.current = snapshot.tg;

  useEffect(() => {
    const tg = getTelegramWebApp();
    const updateSnapshot = () => {
      const next = createSnapshot(tg);
      setSnapshot((current) => (snapshotsEqual(current, next) ? current : next));
    };

    updateSnapshot();

    if (!tg) {
      return;
    }

    for (const event of trackedEvents) {
      tg.onEvent(event, updateSnapshot);
    }

    return () => {
      for (const event of trackedEvents) {
        tg.offEvent(event, updateSnapshot);
      }
    };
  }, []);

  useEffect(() => {
    const tg = snapshot.tg;
    if (!tg) {
      setIsReady(false);
      return;
    }

    if (!readyInstances.has(tg)) {
      tg.ready();
      readyInstances.add(tg);
    }

    setIsReady(true);
  }, [snapshot.tg]);

  if (!methodsRef.current) {
    methodsRef.current = createMethodApi(() => tgRef.current);
  }

  return {
    ...snapshot,
    ...methodsRef.current,
    isReady
  };
}

function getSnapshot(): TelegramSnapshot {
  return createSnapshot(getTelegramWebApp());
}

function createSnapshot(tg: TelegramWebApp | null): TelegramSnapshot {
  const user = tg?.initDataUnsafe?.user ?? null;

  return {
    colorScheme: tg?.colorScheme === "dark" ? "dark" : "light",
    isExpanded: tg?.isExpanded ?? false,
    isMock: isTeleforgeMockInstalled(),
    platform: normalizePlatform(tg?.platform),
    tg,
    themeParams: tg?.themeParams ?? {},
    user,
    userUnsafe: user,
    version: tg?.version ?? "",
    viewportHeight: tg?.viewportHeight ?? 0,
    viewportStableHeight: tg?.viewportStableHeight ?? tg?.viewportHeight ?? 0
  };
}

function snapshotsEqual(left: TelegramSnapshot, right: TelegramSnapshot): boolean {
  return (
    left.tg === right.tg &&
    left.isMock === right.isMock &&
    left.user === right.user &&
    left.userUnsafe === right.userUnsafe &&
    left.platform === right.platform &&
    left.version === right.version &&
    left.colorScheme === right.colorScheme &&
    left.viewportHeight === right.viewportHeight &&
    left.viewportStableHeight === right.viewportStableHeight &&
    left.isExpanded === right.isExpanded &&
    left.themeParams === right.themeParams
  );
}

function normalizePlatform(platform: string | undefined): TelegramPlatform {
  if (platform === "ios" || platform === "android" || platform === "web" || platform === "macos") {
    return platform;
  }

  if (platform === "tdesktop" || platform === "desktop") {
    return "desktop";
  }

  return "unknown";
}

function createMethodApi(getTg: () => TelegramWebApp | null) {
  return {
    cloudStorage: createCloudStorageApi(getTg),
    close() {
      getTg()?.close();
    },
    expand() {
      getTg()?.expand();
    },
    hapticFeedback: createHapticFeedbackApi(getTg),
    openLink(url: string, options?: { try_instant_view?: boolean }) {
      getTg()?.openLink(url, options);
    },
    openTelegramLink(url: string) {
      getTg()?.openTelegramLink(url);
    },
    ready() {
      const tg = getTg();
      if (!tg) {
        return;
      }

      if (!readyInstances.has(tg)) {
        readyInstances.add(tg);
      }
      tg.ready();
    },
    sendData(data: string) {
      getTg()?.sendData(data);
    },
    showAlert(message: string, callback?: () => void) {
      getTg()?.showAlert(message, callback);
    },
    showConfirm(message: string, callback?: (confirmed: boolean) => void) {
      getTg()?.showConfirm(message, callback);
    },
    showPopup(params: PopupParams, callback?: (id?: string) => void) {
      getTg()?.showPopup(params, callback);
    }
  };
}

function createHapticFeedbackApi(getTg: () => TelegramWebApp | null): HapticFeedback {
  return {
    impactOccurred(style) {
      (getTg()?.HapticFeedback ?? noopHapticFeedback).impactOccurred(style);
    },
    notificationOccurred(type) {
      (getTg()?.HapticFeedback ?? noopHapticFeedback).notificationOccurred(type);
    },
    selectionChanged() {
      (getTg()?.HapticFeedback ?? noopHapticFeedback).selectionChanged();
    }
  };
}

function createCloudStorageApi(getTg: () => TelegramWebApp | null): CloudStorage {
  return {
    getItem(key, callback) {
      (getTg()?.CloudStorage ?? noopCloudStorage).getItem(key, callback);
    },
    getItems(keys, callback) {
      (getTg()?.CloudStorage ?? noopCloudStorage).getItems(keys, callback);
    },
    removeItem(key, callback) {
      (getTg()?.CloudStorage ?? noopCloudStorage).removeItem(key, callback);
    },
    removeItems(keys, callback) {
      (getTg()?.CloudStorage ?? noopCloudStorage).removeItems(keys, callback);
    },
    setItem(key, value, callback) {
      (getTg()?.CloudStorage ?? noopCloudStorage).setItem(key, value, callback);
    }
  };
}
