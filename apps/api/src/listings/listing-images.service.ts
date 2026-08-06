import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type UploadedListingFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@Injectable()
export class ListingImagesService {
  constructor(private readonly config: ConfigService) {}

  private validate(file?: UploadedListingFile) {
    if (!file) throw new BadRequestException("Vui lòng chọn ảnh cần tải lên");
    if (file.size > 8 * 1024 * 1024)
      throw new BadRequestException("Mỗi ảnh không được vượt quá 8 MB");
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.mimetype))
      throw new BadRequestException("Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP");
    const jpeg = file.buffer[0] === 0xff && file.buffer[1] === 0xd8;
    const png = file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const webp = file.buffer.subarray(8, 12).toString("ascii") === "WEBP";
    if (!jpeg && !png && !webp)
      throw new BadRequestException("Nội dung tệp không phải định dạng ảnh hợp lệ");
  }

  async upload(file?: UploadedListingFile) {
    this.validate(file);
    const safeFile = file!;
    const cloudName = this.config.get<string>("CLOUDINARY_CLOUD_NAME");
    const apiKey = this.config.get<string>("CLOUDINARY_API_KEY");
    const apiSecret = this.config.get<string>("CLOUDINARY_API_SECRET");
    if (cloudName && apiKey && apiSecret)
      return this.uploadToCloudinary(safeFile, cloudName, apiKey, apiSecret);
    return this.storeLocally(safeFile);
  }

  private async uploadToCloudinary(
    file: UploadedListingFile,
    cloudName: string,
    apiKey: string,
    apiSecret: string,
  ) {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "tws-listings";
    const signature = createHash("sha1")
      .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
      .digest("hex");
    const body = new FormData();
    body.append("file", new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }), file.originalname);
    body.append("api_key", apiKey);
    body.append("timestamp", String(timestamp));
    body.append("folder", folder);
    body.append("signature", signature);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body,
    });
    const result = (await response.json()) as {
      public_id?: string;
      secure_url?: string;
      width?: number;
      height?: number;
      error?: { message?: string };
    };
    if (!response.ok || !result.public_id || !result.secure_url)
      throw new BadRequestException(result.error?.message ?? "Không thể tải ảnh lên Cloudinary");
    return {
      publicId: result.public_id,
      secureUrl: result.secure_url,
      width: result.width,
      height: result.height,
    };
  }

  private async storeLocally(file: UploadedListingFile) {
    const extension = file.mimetype === "image/png" ? "png" : file.mimetype === "image/webp" ? "webp" : "jpg";
    const id = randomUUID();
    const uploadDirectory = path.resolve(process.cwd(), "uploads", "listings");
    await mkdir(uploadDirectory, { recursive: true });
    await writeFile(path.join(uploadDirectory, `${id}.${extension}`), file.buffer);
    const apiUrl = this.config.get("API_URL", "http://localhost:4000").replace(/\/$/, "");
    return {
      publicId: `local/${id}`,
      secureUrl: `${apiUrl}/uploads/listings/${id}.${extension}`,
    };
  }
}
