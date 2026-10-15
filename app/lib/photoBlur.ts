// Server-only: finds the faces and license plates to blur in a station photo, with Google Cloud
// Vision (GOOGLE_VISION_API_KEY). Three checks per photo: faces, objects (some come back labeled as
// license plates) and text. Plates are also caught as text on a car, since Vision doesn't always
// label the plate itself. Blurring a car badge along with the plate does no harm.
export type Box = { left: number; top: number; width: number; height: number };

type Vertex = { x?: number; y?: number };
type VisionResponse = {
  faceAnnotations?: { boundingPoly?: { vertices?: Vertex[] } }[];
  localizedObjectAnnotations?: { name?: string; boundingPoly?: { normalizedVertices?: Vertex[] } }[];
  textAnnotations?: { description?: string; boundingPoly?: { vertices?: Vertex[] } }[];
  error?: { message?: string };
};

const PLATE = /licen[cs]e plate|registration plate/i;
const VEHICLE = /^(car|vehicle|land vehicle|truck|van|bus|motorcycle|taxi)$/i;
// Extra margin around each area, as a share of its size, so edges of a face or plate don't show.
const PAD = 0.15;

function toBox(vertices: Vertex[] | undefined, scaleX = 1, scaleY = 1): Box | null {
  if (!vertices?.length) return null;
  // Vision leaves out x or y when it's 0.
  const xs = vertices.map((vertex) => (vertex.x ?? 0) * scaleX);
  const ys = vertices.map((vertex) => (vertex.y ?? 0) * scaleY);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}

const centerInside = (box: Box, area: Box) => {
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  return x >= area.left && x <= area.left + area.width && y >= area.top && y <= area.top + area.height;
};

// Padded, whole-pixel areas clipped to the image; tiny ones are dropped.
function finish(box: Box, width: number, height: number): Box | null {
  const left = Math.max(0, Math.floor(box.left - box.width * PAD));
  const top = Math.max(0, Math.floor(box.top - box.height * PAD));
  const right = Math.min(width, Math.ceil(box.left + box.width * (1 + PAD)));
  const bottom = Math.min(height, Math.ceil(box.top + box.height * (1 + PAD)));
  if (right - left < 4 || bottom - top < 4) return null;
  return { left, top, width: right - left, height: bottom - top };
}

// The areas to blur in an image of this size, from one Vision response.
export function blurAreas(response: VisionResponse, width: number, height: number): Box[] {
  const faces = (response.faceAnnotations ?? []).map((face) => toBox(face.boundingPoly?.vertices));
  const objects = (response.localizedObjectAnnotations ?? []).map((object) => ({
    name: object.name ?? "",
    box: toBox(object.boundingPoly?.normalizedVertices, width, height),
  }));
  const plates = objects.filter((object) => PLATE.test(object.name)).map((object) => object.box);
  const vehicles = objects.filter((object) => VEHICLE.test(object.name)).map((object) => object.box).filter((box): box is Box => box !== null);
  // The first text annotation is all the text in the photo together; the rest are single words.
  const words = (response.textAnnotations ?? []).slice(1).map((word) => toBox(word.boundingPoly?.vertices));
  const textOnVehicles = words.filter((box) => box && vehicles.some((vehicle) => centerInside(box, vehicle)));

  return [...faces, ...plates, ...textOnVehicles]
    .filter((box): box is Box => box !== null)
    .map((box) => finish(box, width, height))
    .filter((box): box is Box => box !== null);
}

export function blurConfigured() {
  return Boolean(process.env.GOOGLE_VISION_API_KEY);
}

// Asks Vision about a JPEG; throws when Vision can't be reached or refuses the request.
export async function findBlurAreas(jpeg: Buffer, width: number, height: number): Promise<Box[]> {
  // The key goes in a header, not the URL, so it never shows up in request logs or Sentry traces.
  const response = await fetch("https://vision.googleapis.com/v1/images:annotate", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": process.env.GOOGLE_VISION_API_KEY! },
    body: JSON.stringify({
      requests: [
        {
          image: { content: jpeg.toString("base64") },
          features: [
            { type: "FACE_DETECTION", maxResults: 50 },
            { type: "OBJECT_LOCALIZATION", maxResults: 50 },
            { type: "TEXT_DETECTION" },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Vision answered ${response.status}: ${(await response.text().catch(() => "")).slice(0, 300)}`);
  const body = (await response.json()) as { responses?: VisionResponse[] };
  const result = body.responses?.[0] ?? {};
  if (result.error) throw new Error(`Vision error: ${result.error.message}`);
  return blurAreas(result, width, height);
}
