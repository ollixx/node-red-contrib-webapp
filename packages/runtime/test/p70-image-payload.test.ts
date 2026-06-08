import { describe, expect, it } from "vitest";

/**
 * P70 Ebene 2 (wiring-first) — msg.payload → ui-image src conversion.
 * A node-red-native flow can wire a Buffer (e.g. from an HTTP request or a file
 * read) or a Base64/data:-string into a ui-image node. The runtime converts a
 * Buffer to a `data:` URL (content-type from a msg hint or magic-byte sniffing);
 * a string passes through (URL, asset:<id>, or an already-formed data: URL).
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const webappTest = (require("../../../nodes/webapp.js") as { __test__: Record<string, unknown> }).__test__;

const payloadToImageSrc = webappTest.payloadToImageSrc as (
    payload: unknown,
    msg?: Record<string, unknown>
) => string;

describe("P70: payloadToImageSrc (Buffer/Base64 → data:)", () => {
    it("passes a plain URL string through unchanged", () => {
        expect(payloadToImageSrc("https://example.com/p.png")).toBe("https://example.com/p.png");
    });

    it("passes an asset:<id> reference through unchanged", () => {
        expect(payloadToImageSrc("asset:logo")).toBe("asset:logo");
    });

    it("passes an already-formed data: URL through unchanged", () => {
        const dataUrl = "data:image/png;base64,AAAA";
        expect(payloadToImageSrc(dataUrl)).toBe(dataUrl);
    });

    it("converts a PNG Buffer to a data: URL, sniffing the content-type", () => {
        // PNG magic bytes: 89 50 4E 47
        const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
        const out = payloadToImageSrc(png);
        expect(out.startsWith("data:image/png;base64,")).toBe(true);
        expect(out).toContain(png.toString("base64"));
    });

    it("converts a JPEG Buffer to a data: URL", () => {
        const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
        expect(payloadToImageSrc(jpeg).startsWith("data:image/jpeg;base64,")).toBe(true);
    });

    it("honours an explicit content-type hint on the msg over sniffing", () => {
        const buf = Buffer.from([0x00, 0x01, 0x02]);
        const out = payloadToImageSrc(buf, { contentType: "image/webp" });
        expect(out.startsWith("data:image/webp;base64,")).toBe(true);
    });

    it("falls back to image/png for an unrecognised Buffer with no hint", () => {
        const buf = Buffer.from([0x00, 0x01, 0x02, 0x03]);
        expect(payloadToImageSrc(buf).startsWith("data:image/png;base64,")).toBe(true);
    });
});
