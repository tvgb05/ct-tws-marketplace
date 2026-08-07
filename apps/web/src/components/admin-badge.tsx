import { ShieldCheck } from "lucide-react";

export function AdminBadge({ role }: { role?: string | null }) {
  if (role !== "ADMIN") return null;
  return (
    <span className="user-admin-badge" title="Tài khoản quản trị cộng đồng">
      <ShieldCheck size={11} /> Quản trị
    </span>
  );
}

export function AdminTaggedText({ text }: { text: string }) {
  const parts = text.split("(ADMIN)");
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, index) => (
        <span key={`${part}-${index}`}>
          {part}
          {index < parts.length - 1 && <AdminBadge role="ADMIN" />}
        </span>
      ))}
    </>
  );
}
