import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const displayName = process.env.ADMIN_CREATE_NAME?.trim();
  const email = process.env.ADMIN_CREATE_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_CREATE_PASSWORD;

  if (!displayName || displayName.length < 2)
    throw new Error("Tên admin phải có ít nhất 2 ký tự.");
  if (!email || !/^\S+@\S+\.\S+$/.test(email))
    throw new Error("Email admin không hợp lệ.");
  if (
    !password ||
    password.length < 12 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password)
  )
    throw new Error(
      "Mật khẩu cần ít nhất 12 ký tự, gồm chữ hoa, chữ thường và chữ số.",
    );

  const existing = await prisma.adminCredential.findUnique({
    where: { email },
  });
  if (existing) throw new Error("Email này đã có tài khoản quản trị.");

  const passwordHash = await hash(password, 12);
  const admin = await prisma.user.create({
    data: {
      displayName,
      email,
      role: "ADMIN",
      adminCredential: { create: { email, passwordHash } },
    },
    select: { id: true, displayName: true, email: true },
  });
  console.info(`Đã tạo admin: ${admin.displayName} <${admin.email}>`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
