import { describe, it, expect } from "vitest";
import { extractYouTubeId } from "./youtube";

describe("extractYouTubeId", () => {
  it("URL /watch?v=", () =>
    expect(extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ"));
  it("URL courte youtu.be", () =>
    expect(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ?t=10")).toBe("dQw4w9WgXcQ"));
  it("URL /embed/", () =>
    expect(extractYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ"));
  it("URL /shorts/", () =>
    expect(extractYouTubeId("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ"));
  it("ID brut", () => expect(extractYouTubeId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ"));
  it("non-YouTube ou vide → null", () => {
    expect(extractYouTubeId("https://vimeo.com/123456")).toBeNull();
    expect(extractYouTubeId("pas une url")).toBeNull();
    expect(extractYouTubeId("")).toBeNull();
    expect(extractYouTubeId(null)).toBeNull();
  });
});
