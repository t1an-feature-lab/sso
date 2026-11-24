import "server-only";
import { MAX_IMAGE_SIZE_BYTES } from "@/common/image";

type LogoResult = { data: Buffer; mime: string } | { error: string } | null;

export async function readLogo(formData: FormData, fieldName = "logo"): Promise<LogoResult> {
  const file = formData.get(fieldName);
  if (file === null || (typeof file !== "string" && file.size === 0 && !file.name)) return null;
  if (typeof file === "string") return { error: "请选择 PNG、JPEG 或 WebP 图片" };
  if (!file.size) return { error: "图片内容不能为空" };
  if (file.size > MAX_IMAGE_SIZE_BYTES) return { error: "图片大小不能超过 10 MB" };
  const data = Buffer.from(await file.arrayBuffer());
  const png = data.length >= 24 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    data.toString("ascii", 12, 16) === "IHDR";
  const jpeg = data.length >= 4 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  const webp = data.length >= 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP";
  const mime = png ? "image/png" : jpeg ? "image/jpeg" : webp ? "image/webp" : "";
  if (!mime || file.type !== mime) return { error: "图片格式无效，请选择 PNG、JPEG 或 WebP 图片" };
  return { data, mime };
}
