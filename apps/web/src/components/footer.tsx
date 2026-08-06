import Link from "next/link";
import {
  CREATOR_EMAIL,
  CREATOR_FACEBOOK_URL,
  FEEDBACK_FORM_URL,
} from "@/lib/constants";
import { Logo } from "./logo";
export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <Logo />
          <p>Nơi những món đồ tốt tìm thấy người cần chúng.</p>
        </div>
        <div className="footer-links">
          <nav className="footer-navigation" aria-label="Liên kết cuối trang">
            <Link href="/how-it-works">Hướng dẫn mua bán</Link>
            <Link href="/community-guidelines">Quy tắc cộng đồng</Link>
            <a
              href={FEEDBACK_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Báo lỗi & góp ý ↗
            </a>
            <Link href="/privacy">Quyền riêng tư</Link>
            <Link href="/terms">Điều khoản</Link>
          </nav>
          <div className="footer-credit">
            <span>© 2026 Cuồng Tai Nghe TWS Community</span>
            <i>·</i>
            <span>
              Phát triển bởi <strong>Gia Bảo</strong>
            </span>
            <a
              href={CREATOR_FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Facebook ↗
            </a>
            <a href={`mailto:${CREATOR_EMAIL}`}>{CREATOR_EMAIL}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
