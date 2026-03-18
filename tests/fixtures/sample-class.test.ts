/**
 * Fixture test file for testing "test file content scan" matching.
 * Uses flat describe structure with Japanese test names — method names
 * only appear in the code body, not in test names or describe names.
 */
import { SampleService } from "./sample-class";

describe("SampleService", () => {
  it("メインの処理を正しく実行できる", () => {
    const svc = new SampleService("test");
    const result = svc.execute("hello");
    expect(result).toBe("HELLO");
  });

  it("入力を検証できる", () => {
    const svc = new SampleService("test");
    expect(svc.validate("hello")).toBe(true);
    expect(svc.validate("")).toBe(false);
  });

  it("DTOに変換できる", () => {
    const svc = new SampleService("test");
    expect(svc.toDTO()).toEqual({ name: "test" });
  });
});
