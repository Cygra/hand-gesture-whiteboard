import { describe, it, expect } from "vitest";
import { getUiText } from "@/lib/i18n";

describe("getUiText", () => {
  it("returns English text by default", () => {
    const text = getUiText("en", "light");
    expect(text.about).toBe("About");
    expect(text.fallOn).toBe("Balloon Float: ON");
    expect(text.windOn).toBe("Gesture Wind: ON");
  });

  it("returns Chinese text for zh locale", () => {
    const text = getUiText("zh", "light");
    expect(text.about).toBe("关于");
    expect(text.fallOn).toBe("气球飘动：开");
  });

  it("returns Japanese text for ja locale", () => {
    const text = getUiText("ja", "light");
    expect(text.about).toBe("概要");
    expect(text.fallOn).toBe("浮遊：オン");
  });

  it("themeButton reflects current theme (en/light → shows Dark option)", () => {
    expect(getUiText("en", "light").themeButton).toBe("Dark");
    expect(getUiText("en", "dark").themeButton).toBe("Light");
  });

  it("themeButton reflects current theme in Chinese", () => {
    expect(getUiText("zh", "light").themeButton).toBe("深色");
    expect(getUiText("zh", "dark").themeButton).toBe("浅色");
  });

  it("themeButton reflects current theme in Japanese", () => {
    expect(getUiText("ja", "light").themeButton).toBe("ダーク");
    expect(getUiText("ja", "dark").themeButton).toBe("ライト");
  });

  it("all three locales have the same set of keys", () => {
    const enKeys = Object.keys(getUiText("en", "light")).sort();
    const zhKeys = Object.keys(getUiText("zh", "light")).sort();
    const jaKeys = Object.keys(getUiText("ja", "light")).sort();
    expect(zhKeys).toEqual(enKeys);
    expect(jaKeys).toEqual(enKeys);
  });
});
