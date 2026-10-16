import type { AssetMetadata, ImageMediaType } from "../domain/models";
import { HttpError, json, readBoundedBody } from "../http";
import type { V1Dependencies } from "./contracts";
import { contentType, requestMediaType } from "./request";

export const MAX_ASSET_BYTES = 20 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_ASSET_BYTES + 64 * 1024;
const IMAGE_TYPES = new Set<ImageMediaType>(["image/jpeg", "image/png"]);

function publicAsset(asset: AssetMetadata): AssetMetadata {
  const { id, mediaType, sizeBytes, createdAt } = asset;
  return { id, mediaType, sizeBytes, createdAt };
}

function hasSignature(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function hasExpectedImageSignature(bytes: Uint8Array, mediaType: ImageMediaType): boolean {
  return mediaType === "image/png"
    ? hasSignature(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    : hasSignature(bytes, [0xff, 0xd8, 0xff]);
}

export async function createAsset(request: Request, dependencies: V1Dependencies): Promise<Response> {
  const type = contentType(request);
  if (requestMediaType(request) !== "multipart/form-data") {
    throw new HttpError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Content-Type must be multipart/form-data.",
    );
  }

  const body = await readBoundedBody(
    request,
    MAX_MULTIPART_BYTES,
    () =>
      new HttpError(413, "PAYLOAD_TOO_LARGE", "Multipart request body is too large.", {
        maxFileBytes: MAX_ASSET_BYTES,
      }),
  );
  let form: FormData;
  try {
    form = await new Request(request.url, {
      method: "POST",
      headers: { "content-type": type },
      body,
    }).formData();
  } catch {
    throw new HttpError(400, "INVALID_MULTIPART", "Request body must be valid multipart data.");
  }

  const entries = [...form.entries()];
  const entry = entries[0];
  if (entries.length !== 1 || !entry || entry[0] !== "file" || !(entry[1] instanceof File)) {
    throw new HttpError(
      400,
      "INVALID_FILE_FIELD",
      "Request body must contain exactly one file field.",
    );
  }

  const file = entry[1];
  if (file.size === 0) {
    throw new HttpError(400, "EMPTY_FILE", "The uploaded file must not be empty.");
  }
  if (file.size > MAX_ASSET_BYTES) {
    throw new HttpError(413, "FILE_TOO_LARGE", "The uploaded file exceeds the 20 MiB limit.", {
      maxBytes: MAX_ASSET_BYTES,
    });
  }
  const mediaType = file.type.toLowerCase();
  if (!IMAGE_TYPES.has(mediaType as ImageMediaType)) {
    throw new HttpError(415, "UNSUPPORTED_FILE_TYPE", "Only JPEG and PNG files are supported.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasExpectedImageSignature(bytes, mediaType as ImageMediaType)) {
    throw new HttpError(
      400,
      "INVALID_FILE_CONTENT",
      "The uploaded bytes do not match the declared image type.",
    );
  }

  const asset = {
    id: dependencies.createId("ast"),
    mediaType: mediaType as ImageMediaType,
    sizeBytes: bytes.byteLength,
    createdAt: dependencies.now().toISOString(),
    bytes,
  };
  await dependencies.assets.put(asset);
  return json({ ok: true, asset: publicAsset(asset) }, 201);
}
