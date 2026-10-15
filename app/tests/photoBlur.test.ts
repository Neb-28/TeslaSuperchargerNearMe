import { describe, expect, it } from "vitest";
import { blurAreas } from "@/lib/photoBlur";

const rect = (left: number, top: number, right: number, bottom: number) => [
  { x: left, y: top },
  { x: right, y: top },
  { x: right, y: bottom },
  { x: left, y: bottom },
];

describe("blurAreas", () => {
  it("pads each face by 15% and keeps it inside the photo", () => {
    expect(blurAreas({ faceAnnotations: [{ boundingPoly: { vertices: rect(100, 100, 200, 200) } }] }, 1000, 800)).toEqual([
      { left: 85, top: 85, width: 130, height: 130 },
    ]);
    // Vision leaves out x/y when they're 0; a face at the corner stays within the photo.
    expect(blurAreas({ faceAnnotations: [{ boundingPoly: { vertices: [{}, { x: 50 }, { x: 50, y: 50 }, { y: 50 }] } }] }, 1000, 800)).toEqual([
      { left: 0, top: 0, width: 58, height: 58 },
    ]);
  });

  it("blurs objects labeled as license plates (positions given as shares of the photo)", () => {
    const plate = { name: "License plate", boundingPoly: { normalizedVertices: rect(0.5, 0.5, 0.6, 0.55) } };
    const tree = { name: "Tree", boundingPoly: { normalizedVertices: rect(0, 0, 0.2, 0.5) } };
    expect(blurAreas({ localizedObjectAnnotations: [plate, tree] }, 1000, 800)).toEqual([{ left: 485, top: 394, width: 130, height: 53 }]);
  });

  it("blurs text on a car (a plate Vision didn't label), but not signs elsewhere", () => {
    const car = { name: "Car", boundingPoly: { normalizedVertices: rect(0.1, 0.4, 0.6, 0.9) } };
    const response = {
      localizedObjectAnnotations: [car],
      textAnnotations: [
        { description: "XZ 411 SUPERCHARGER", boundingPoly: { vertices: rect(0, 0, 1000, 800) } },
        { description: "XZ", boundingPoly: { vertices: rect(200, 600, 240, 620) } },
        { description: "411", boundingPoly: { vertices: rect(245, 600, 290, 620) } },
        { description: "SUPERCHARGER", boundingPoly: { vertices: rect(700, 50, 900, 90) } },
      ],
    };
    expect(blurAreas(response, 1000, 800)).toEqual([
      { left: 194, top: 597, width: 52, height: 26 },
      { left: 238, top: 597, width: 59, height: 26 },
    ]);
  });

  it("finds nothing in an empty response", () => {
    expect(blurAreas({}, 1000, 800)).toEqual([]);
  });
});
